var Stream = require('./stream.js'),
    ajax = require('./ajax.js'),
    meta = require('./meta.js'),
    util = require('./util.js'),
    log = require('minilog')('mg/cache');

var cache = {},
    callbacks = {};

// returns an plain array (multiple items) or a plain object (single item)
function unwrapJSONAPI(name, data) {
  // expect { modelName: [ { .. model .. }, .. ]}
  var key = meta.get(name, 'plural');
  if(data[key].length == 1) {
    return data[key][0];
  } else {
    return data[key];
  }
}

// returns an plain array (multiple items) or a plain object (single item)
function unwrapBackboneAPI(name, data) {
  if(typeof data === 'string') {
    throw new Error('Unexpected string: ' + data);
  }
  return data;
}

function unwrap(name, data) {
  return unwrapBackboneAPI(name, data);
}

// Lookup from cache by id
exports.local = function local(name, id) {
  return (cache[name] && cache[name][id] ? cache[name][id] : false);
};

// Get all ids
exports.keys = function(name) {
  return (cache[name] ? Object.keys(cache[name]) : []);
};

// Location-unaware `get model`
exports.get = function get(name, id, onDone) {
  var item = exports.local(name, id);
  if(item) {
    log.debug('Fulfilling .get() from local cache', name, id);
    return onDone(undefined, item);
  }
  // do remote fetch if not locally available
  if(!meta.get(name, 'url')) throw new Error(name + ' does not have a definition.');

  var uri = exports.uri(name, id);
  exports.fetch(name, uri, onDone);
};

exports.uri = function(name, id) {
// assume url + id for get by Id
  var base = meta.result(name, 'url'),
      uri = base + (base.charAt(base.length - 1) === '/' ? '' : '/') + (id ? encodeURIComponent(id) : '');
  return uri;
};

// TODO: support traversing a large, fully hydrated object!
exports.store = function(name, values) {
  if(!cache[name]) { cache[name] = {}; }

  var idAttr = meta.get(name, 'idAttribute') || 'id';
  // result may be a single item or array
  (Array.isArray(values) ? values : [ values ]).forEach(function(value) {
    var id;
    // this is the right point to notify the stream - once the model instances
    // have been fetched, unwrapped and hydrated.
    Stream.onFetch(name, value);

    if(value && util.get(value, idAttr)) {
      id = util.get(value, idAttr);
      if(cache[name][id]) {
        log.debug('Updating values', name, id);
        // update the stored values, but do not change the object instance
        util.keys(value).forEach(function(key) {
          var previous = util.get(cache[name][id], key),
              updated = util.get(value, key);
          if(previous !== updated) {
            log.debug('Update: set', name, id, key, updated);
            util.set(cache[name][id], key, updated);
          }
        });
        return;
      } else {
        log.debug('Caching first time', name, id);
        cache[name][id] = value;
      }
    } else {
      log.warn('Cannot cache model without an '+idAttr, name, value);
    }
  });
};

// Fetch model from given URL
// Mirrors the ajax.fetch function -- but does all the additional work
// of unwrapping, hydrating and cache-storing content
exports.fetch = function(name, uri, onDone) {
  var isPending = (typeof callbacks[uri] != 'undefined');
  if(!callbacks[uri]) {
    callbacks[uri] = [];
  }
  if(onDone) {
    callbacks[uri].push(onDone);
  }
  function emit(err, result) {
    if(!callbacks[uri]) return;
    var temp = callbacks[uri];
    // delete before calling: otherwise, if fetch is called from a
    // done callback, it will be queued and then ignored
    delete callbacks[uri];
    temp.forEach(function(onDone) {
      onDone(err, result);
    });
  }

  if(!isPending) {
    log.debug('ajax fetch to '+uri);
    ajax(uri, function(err, data) {
        if(err) return emit(err, null);
        // the data can be empty (e.g. nothing to hydrate)
        if(!data || Array.isArray(data) && data.length === 0) {
          log.debug('ajax empty onDone '+uri, data);
          return emit(null, data);
        }

        // unwrap and pass back
        // Note: previously we called hydrate implicitly, but I think it is preferable
        // to have cache fetches be dumb and use the hydration as the
        // interface for queuing and running fetch jobs
        log.debug('ajax fetch onDone '+uri);
        emit(null, unwrap(name, data));
      });
  } else {
    log.debug('ajax queue for '+uri);
  }
};

exports._setAjax = function(obj) {
  ajax = obj;
};

exports.clear = function() {
  cache = {};
};
