if(typeof window == 'undefined') {
  var url = require('url'),
      request = require('../test/lib/request.js');
}

var Stream = require('./stream.js');

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
  if(arguments.length == 1) {
    return meta[name];
  }
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

// Backbone expects the response to be a plain object, not a instance of a model
// But that's fine, since this method is only used for .findX() calls, where Backbone is not directly
// involved.
function ajaxFetch(name, uri, callback) {
  $.ajax(uri, {
      dataType: 'json',
      success: function(data, status, jqXHR) {
        var key = meta[name].plural;
        if(data[key].length == 1) {
          return callback(undefined, Stream.onFetch(name, new meta[name].Model(data[key][0])));
        } else {
          return callback(undefined, data[key].map(function(item) {
            return Stream.onFetch(name, new meta[name].Model(item));
          }));
        }
      },
      error: function(jqXHR, status, str) {
        callback(status);
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
  if(!meta[name]) throw new Error(name + ' does not have a definition in the cache.');

  var fetchFn = (typeof window == 'undefined' ? fetch : ajaxFetch);

  fetchFn(name, replace(meta[name].href, { id: id }), function(err, result) {
    if(err) callback(err);
    cache[name][id] = result;
    return callback(err, result);
  });
};
