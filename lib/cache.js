var Stream = require('./stream.js'),
    ajax = require('./ajax.js'),
    meta = require('./meta.js'),
    util = require('./util.js'),
    log = require('minilog')('mg/cache'),
    Collection = require('backbone').Collection,
    hydrate = require('./hydrate.js');

var cache = {};

// Lookup from cache by id
exports.local = function local(name, id) {
  return (cache[name] && cache[name][id] ? cache[name][id] : false);
};

// Get all ids
exports.keys = function(name) {
  return (cache[name] ? Object.keys(cache[name]) : []);
};

function listRemote(name, onDone) {
  var uri = meta.collectionUri(name);
  log.info('listRemote', name, uri);
  if(!uri) {
    console.error('Unknown mg.stream URL: ' +name);
  }
  ajax(uri, function(err, data) {
    // apply hydration to the remote items
    hydrate(name, data, onDone);
  });
}

exports.getAll = function(name, onDone) {
  var localItems = exports.keys(name).map(function(id) {
    return exports.local(name, id);
  });

  listRemote(name, function(err, remoteItems) {
    if(remoteItems) {
      onDone(err, localItems.concat(remoteItems));
    } else {
      onDone(err, localItems);
    }
  });
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
  var uri = meta.uri(name, id);
  ajax(uri, onDone);
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

exports.clear = function() {
  cache = {};
};
