var Stream = require('./stream.js'),
    ajax = require('./ajax.js'),
    meta = require('./meta.js'),
    util = require('./util.js'),
    log = require('minilog')('mg/cache'),
    Collection = require('backbone').Collection;

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
  if(!meta.get(name, 'url')) {
    throw new Error(name + ' does not have a definition.');
  }
  var uri = exports.uri(name, id);
  exports.fetch(name, uri, onDone);
};

exports.uri = function(name, id) {
  // Backbone's url function is annoying in that it always requires an instance of an object
  // to exist with a specific id. Here, to find out what the url should be,
  // we'll create a throwaway instance of the object (with the right id)
  // and then call or fetch the url. This avoids making any assumptions beyond what
  // Backbone's public API provides; but having to create an object just to figure out the
  // URL is kind of ugly.
  var obj, attr = {};
  // for nonstandard id
  attr[(meta.get(name, 'idAttribute') || 'id')] = id;
  // if possible, avoid instantiation
  obj = exports.local(name, id);
  if (!obj) {
    obj = new (meta.model(name))(attr);
  }
  return util.result(obj, 'url'); // call .url() or return .url
};

exports.collectionUri = function(name) {
  // get the collection (e.g. defined as { collection: 'Posts' } in each model class)
  var collectionClass = meta.collection(name),
      collection;
  if(collectionClass !== Collection) {
    collection = new collectionClass();
    return util.result(collection, 'url'); // call .url() or return .url
  } else {
    return exports.uri(name);
  }
};

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
