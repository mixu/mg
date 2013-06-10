var Stream = require('./stream.js'),
    hydrate = require('./hydrate.js'),
    ajax = require('./ajax.js'),
    log = require('minilog')('mmm/cache');

var cache = {},
    meta = {},
    model = {};

// return property or evaluate function
function result(object, property) {
  if (object == null) return null;
  var value = object[property];
  return (typeof value === 'function' ? value.call(object) : value);
}

function unwrapJSONAPI(meta, Model, data) {
  // expect { modelName: [ { .. model .. }, .. ]}
  var key = meta[name].plural;
  if(data[key].length == 1) {
    return Stream.onFetch(name, new model[name](data[key][0]));
  } else {
    return data[key].map(function(item) {
      return Stream.onFetch(name, new model[name](item));
    });
  }
}

function unwrapBackboneAPI(name, data) {
  if(!Array.isArray(data)) {
    return Stream.onFetch(name, new model[name](data));
  } else {
    return data.map(function(item) {
      return Stream.onFetch(name, new model[name](item));
    });
  }
}

var unwrap = exports.unwrap = function(name, data) {
  return unwrapBackboneAPI(name, data);
};

exports.define = function(name, mmeta) {
  if(arguments.length == 1 && typeof name == 'object') {
    // allow define( { name1: meta1, name2: meta2 });
    Object.keys(name).forEach(function(key) {
      exports.define(key, name[key]);
    });
    return;
  }

  // meta properties:
  // .plural
  // .url
  // .rels

  // Assume we are given a Backbone model. All the interesting properties are on the prototype.
  meta[name] = mmeta.prototype;
  model[name] = mmeta;
  cache[name] = {};
};

exports.meta = function(name, key) {
  if(arguments.length == 1) {
    return meta[name];
  }
  if(meta[name] && meta[name][key]) {
    return meta[name][key];
  }
};

// Lookup from cache by id
exports.local = function local(name, id) {
  return (cache[name] && cache[name][id] ? cache[name][id] : false);
};

// Get all ids
exports.keys = function(name) {
  return Object.keys(cache[name]);
};

// Location-unaware `get model`
exports.get = function get(name, id, onDone) {
  var item = exports.local(name, id);
  if(item) {
    log.debug('Fulfilling .get() from local cache', name, id);
    return onDone(undefined, item);
  }
  // do remote fetch if not locally available
  if(!meta[name]) throw new Error(name + ' does not have a definition in the cache.');

  var uri = exports.uri(name, id);
  exports.fetch(name, uri, onDone);
};

exports.uri = function(name, id) {
// assume url + id for get by Id
  var base = result(meta[name], 'url'),
      uri = base + (base.charAt(base.length - 1) === '/' ? '' : '/') + encodeURIComponent(id);
  return uri;
};

exports.store = function(name, values) {
  // result may be a single item or array
  (Array.isArray(values) ? values : [ values ]).forEach(function(value) {
    if(value && value.id) {
      log.debug('Storing fetch result in cache', name, value.id);
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

    // Order:
    // 1. unwrap

    // 1.A: if a model with the corresponding id



    // 2. hydrate
    hydrate(name, exports.unwrap(name, data), function(err, values) {
      if(err) return onDone(err, null);
      // 3. store in cache
      exports.store(name, values);

      // 4. pass back
      onDone(null, values);
    });
  });
};
