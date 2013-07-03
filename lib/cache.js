var Stream = require('./stream.js'),
    hydrate = require('./hydrate.js'),
    ajax = require('./ajax.js'),
    meta = require('./meta.js'),
    log = require('minilog')('mmm/cache');

var cache = {};

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
  return data;
}

function unwrap(name, data) {
  return unwrapBackboneAPI(name, data);
};

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
      uri = base + (base.charAt(base.length - 1) === '/' ? '' : '/') + encodeURIComponent(id);
  return uri;
};

// TODO: support traversing a large, fully hydrated object!
exports.store = function(name, values) {
  if(!cache[name]) { cache[name] = {}; }

  // result may be a single item or array
  (Array.isArray(values) ? values : [ values ]).forEach(function(value) {

    // this is the right point to notify the stream - once the model instances
    // have been fetched, unwrapped and hydrated.
    Stream.onFetch(name, value);

    if(value && value.id) {
      log.debug('Storing fetch result in cache', name, value.id);
      if(cache[name][value.id]) {
        log.error('Skipping - already cached! ', name, value.id);
        // should update the cache in a way that doesn't invalidate,
        // or better yet, fix in upstream so that we don't try to hydrate things that exist
        return;
      }
      cache[name][value.id] = value;
    } else {
      log.error('Unknown cache.store value', value);
    }
  });
};

// Fetch model from given URL
// Mirrors the ajax.fetch function -- but does all the additional work
// of unwrapping, hydrating and cache-storing content
exports.fetch = function(name, uri, onDone) {
  log.debug('ajax fetch to '+uri);
  ajax(uri, function(err, data) {
    if(err) return onDone(err, null);

    // the data can be empty (e.g. nothing to hydrate)
    if(!data || Array.isArray(data) && data.length == 0) {
      log.debug('ajax empty onDone '+uri, data);
     return onDone(null, data);
    }

    // Order:
    // 1. unwrap
    // 2. hydrate (all items)
    hydrate(name, unwrap(name, data), function(err, values) {
      if(err) {
        return onDone(err, null);
      }
      // 3. store in cache
      exports.store(name, values);

      // 4. pass back
      log.debug('ajax fetch onDone '+uri);
      onDone(null, values);
    });
  });
};

exports._setAjax = function(obj) {
  ajax = obj;
};
