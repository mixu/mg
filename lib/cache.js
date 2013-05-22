var url = require('url'),
    request = require('../test/lib/request.js'),
    Stream = require('./stream.js');

var cache = {},
    meta = {};

exports.define = function(name, mmeta) {
  // meta properties:
  // .plural
  // .href
  // .rels
  meta[name] = mmeta;
  cache[name] = {};
};

exports.meta = function(name, key) {
  if(meta[name] && meta[name][key]) {
    return meta[name][key];
  }
};

function fetch(name, uri, callback) {
  // only fetch if we're not already waiting for this resource
  // parse out the path
  var parts = url.parse(uri);
  return request({ hostname: parts.hostname, path: parts.pathname, port: parts.port }, function(err, data, res) {
    // expect { modelName: [ { .. model .. }, .. ]}
    var key = meta[name].plural;
    if(data[key].length == 1) {
      return callback(err, Stream.onFetch(name, new meta[name].Model(data[key][0])));
    } else {
      return callback(err, data[key].map(function(item) {
        return Stream.onFetch(name, new meta[name].Model(item));
      }));
    }
  });
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
  if(!meta[name]) throw new Error(name + ' is not defined');
  fetch(name, replace(meta[name].href, { id: id }), function(err, result) {
    if(err) callback(err);
    cache[name][id] = result;
    return callback(err, result);
  });
};
