var Stream = require('./stream.js'),
    ajax = require('./ajax.js');

var cache = {},
    meta = {},
    model = {};

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
  cache[name][data.id] = unwrapBackboneAPI(name, data);
  return cache[name][data.id];
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

function replace(str, lookup) {
  return str.replace(/{([^}]+)}/g, function(_, key) {
    return (typeof lookup[key] != 'undefined' ? lookup[key] : key);
  });
}

// Lookup from cache by id
exports.local = function local(name, id) {
  return (cache[name] && cache[name][id] ? cache[name][id] : false);
};

// Get all ids
exports.keys = function(name) {
  return Object.keys(cache[name]);
};

// Fetch from remote or cache
exports.get = function get(name, id, callback) {
  var item = exports.local(name, id);
  if(item) {
    return callback(undefined, item);
  }
  // do remote fetch if not locally available
  if(!meta[name]) throw new Error(name + ' does not have a definition in the cache.');

    // assume url + id for get by Id
  var base = result(meta[name], 'url'),
      uri = base + (base.charAt(base.length - 1) === '/' ? '' : '/') + encodeURIComponent(id);
  ajax(uri, function(err, data) {
    if(err) callback(err);
    return callback(err, unwrap(name, data));
  });
};
