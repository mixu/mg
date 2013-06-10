(function(){function require(e,t,n){t||(t=0);var r=require.resolve(e,t),i=require.m[t][r];if(!i)throw new Error('failed to require "'+e+'" from '+n);if(i.c){t=i.c,r=i.m,i=require.m[t][i.m];if(!i)throw new Error('failed to require "'+r+'" from '+t)}return i.exports||(i.exports={},i.call(i.exports,i,i.exports,require.relative(r,t))),i.exports}require.resolve=function(e,t){var n=e,r=e+".js",i=e+"/index.js";return require.m[t][r]&&r||require.m[t][i]&&i||n},require.relative=function(e,t){return function(n){if("."!=n.charAt(0))return require(n,t,e);var r=e.split("/"),i=n.split("/");r.pop();for(var s=0;s<i.length;s++){var o=i[s];".."==o?r.pop():"."!=o&&r.push(o)}return require(r.join("/"),t,e)}};
require.m = [];
require.m[0] = {
"backbone": { exports: window.Backbone },
"minilog": { exports: window.Minilog },
"index.js": function(module, exports, require){
var cache = require('./lib/cache.js'),
    hydrate = require('./lib/hydrate.js'),
    Stream = require('./lib/stream.js'),
    Collection = require('backbone').Collection,
    Backbone = require('backbone'),
    ajax = require('./lib/ajax.js'),
    log = require('minilog')('mmm');

// Define a correspondence between a name and a Model class (and metadata)
exports.define = cache.define;

// Query API

function listLocal(name, onDone) {
  onDone(undefined, cache.keys(name).map(function(id) {
    return cache.local(name, id);
  }));
}

function listRemote(name, onDone) {
  log.info('listRemote', name);
  if(name == 'DataSource') {
    cache.fetch(name, '/v1/datasources', onDone);
  } else if(name == 'Project') {
    cache.fetch(name, '/v1/projects', onDone);
  } else if(name == 'Job') {
    cache.fetch(name, '/v1/jobs', onDone);
  } else {
    console.error('Unknown mmm.stream name');
  }
}

// return a collection of models based on a set of conditions
exports.find = function(name, conditions, onDone) {
  if(typeof conditions != 'object') {
    log.warn('Warning: find() conditions not an object!');
  }
  if(conditions.id) {
    // get by id
    return cache.get(name, conditions.id, function(err, result) {
      if(err) return onDone(err);
      if(result) {
        // cache returns hydrated results
        onDone(null, result);
      }
    });
  }
  // this is how we say "get all"
  if(conditions.since == 0) {

    return listRemote(name, onDone);


    // this might involve a remote lookup later on
    // for now just fetch all local items
    // return listLocal(name, onDone);
  }

  // search by something else -> needs to be run remotely, since we don't have the ability to
  // reason about queries on the client side

};

// return a single model  based on a set of conditions
exports.findOne = function(name, conditions, onDone) {
  return exports.find(name, conditions, function(err, result) {
    return onDone(err, result);
  })
};

// return a single model by id
exports.findById = function(name, id, onDone) {
  return exports.findOne(name, { id: id }, onDone);
};

// returns a pipeable stream
exports.stream = function(name, conditions, collectionClass, onLoaded) {
  var instance = (collectionClass ? new collectionClass() : new Collection());
  // start the find
  exports.find(name, { since: 0 }, function(err, results) {
    // add the results to the collection
    instance.add(results);

    onLoaded && onLoaded();

    // subscribe to local "on-fetch-or-save" (with filter)
    // if remote subscription is supported, do that as well
    Stream.on(name, 'available', function(model) {
      // console.log('stream.available', model, model.get('name'));
      instance.add(model);

      model.once('destroy', function() {
        instance.remove(model);
      });
    });
  });

  // return a pipeable object
  return instance;
};

exports.sync = function(name) {
 return function(op, model, opts) {
    log.info('sync', op, model, opts, name);

    // to hook up to the stream, bind on "create"
    if(op == 'create') {
      var oldSuccess = opts.success;
      opts.success = function() {
        // after create,
        // 1. unwrap (really, is a call to parse)
        var oldParse = model.parse;
        // discarding the success callback is not really feasible,
        // but if you call it with the original parse function,
        // the same parse logic will be applied to both "created"
        // and "updated"/"patched" models.
        // Created models are the only ones where we need to freshly create
        // new collections since the original models do not have the right properties
        // and do not go through the normal find/hydrate pipeline
        model.parse = function(resp, options) {
          model.parse = oldParse;
          var rels = cache.meta(name, 'rels');
          if(!rels || typeof rels != 'object') return resp;

          Object.keys(rels).forEach(function(key) {
            var current = resp[key];
            if(!current || !current.add) {
              resp[key] = new Collection();
            }
          });

          // BB calls model.set with this
          return resp;
        };
        // 2. hydrate -- existing model (e.g. inside parse)
        oldSuccess.apply(opts, arguments);
        // console.log('post-success', name, model, model.get('name'));
        Stream.onFetch(name, model);
      }
    }
    // delete can be tracked after this via the "destroy" event on the model
    return Backbone.sync.apply(this, arguments);
  };
};

// basically, just plucks out the right thing from the output
exports.parse = function(name) {
  return function(resp, options) {
    var meta = cache.meta(name);
    log.debug('parse', name, resp._id);
    // 3. store in cache
    return resp;
  };
};
},
"lib/ajax.js": function(module, exports, require){
if(typeof window == 'undefined') {
  var url = require('url'),
      request = require('../test/lib/request.js');
}

function fetch(uri, callback) {
  // only fetch if we're not already waiting for this resource
  // parse out the path
  var parts = url.parse(uri);
  return request({ hostname: parts.hostname, path: parts.pathname, port: parts.port }, function(err, data, res) {
    callback(err, data);
  });
};

// Backbone expects the response to be a plain object, not a instance of a model
// But that's fine, since this method is only used for .findX() calls, where Backbone is not directly
// involved.
function ajaxFetch(uri, callback) {
  $.ajax(uri, {
      dataType: 'json',
      success: function(data, status, jqXHR) {
        callback(null, data);
      },
      error: function(jqXHR, textStatus, httpPortion) {
        // the textStatus is often not helpful (e.g. "error" for HTTP errors)
        if(textStatus == 'error') {
          return callback(jqXHR.status, null);
        }
        callback(textStatus, null);
      }
    });
};

module.exports = (typeof window == 'undefined' ? fetch : ajaxFetch);
},
"lib/cache.js": function(module, exports, require){
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
},
"lib/stream.js": function(module, exports, require){
var MicroEE = require('microee');
// Single point to get events about models of a particular type.
//
// Note that creating models and then manually assigning ID's to them is not supported
// (e.g. the only way to create a model is to fetch it from the backend, or to save it to the backend)
//
// Events
// on('available') => when a model is first retrieved or assigned an id
// on('change') => when a model is changed
// on('change:id') => when a model with the id is changed
// on('destroy') => when a model deleted permanently

var emitters = {};

// each model has to be created for it to generate any events
// this is called on create; the stream should then attach to the relevant events
exports.bind = function(name, source) {

  function onChange(model, options) {
    emitters[name].emit('change', model);
    emitters[name].emit('change:'+model.get('id'), model);

  }
  function onDestroy(model) {
    emitters[name].emit('destroy', model);
    emitters[name].removeAllListeners('change', model);
    emitters[name].removeAllListeners('destroy', model);
  }

  source.on('change', onChange);
  source.on('destroy', onDestroy);
};

// all tracked models originate on the server.
// for now, no support for models that do not have an id
exports.onFetch = function(name, instance) {
//  console.log('onFetch', name, instance);

  if(!emitters[name]) { emitters[name] = new MicroEE(); }
  exports.bind(name, instance);
  emitters[name].emit('available', instance);
  return instance; // for easy application
};

// These methods make the stream look like a eventemitter in one direction (for creating subscriptions)
// They lazily instantiate a event listener
exports.on = function(name, event, listener) {
  if(!emitters[name]) { emitters[name] = new MicroEE(); }
  emitters[name].on(event, listener);
};

exports.once = function(name, event, listener) {
  if(!emitters[name]) { emitters[name] = new MicroEE(); }
  emitters[name].once(event, listener);
};

exports.when = function(name, event, listener) {
  if(!emitters[name]) { emitters[name] = new MicroEE(); }
  emitters[name].when(event, listener);
};

exports.removeListener = function(name, event, listener) {
  if(!emitters[name]) return this;
  emitters[name].removeListener(event, listener);
};

exports.removeAllListeners = function(name, event, listener) {
  if(!emitters[name]) return this;
  emitters[name].removeAllListeners(event, listener);
};
},
"lib/hydrate.js": function(module, exports, require){
var cache = require('./cache.js'),
    Collection = require('backbone').Collection,
    log = require('minilog')('mmm/hydration');

if(typeof window != 'undefined' && window.Cato) {
  Collection.prototype.pipe = Cato.Collection.prototype.pipe;
}

function set(model, key, ids, results) {
  // if the original wrapper was an array, then we need to wrap this item in a collection
  if(Array.isArray(ids)) {
    var current = model.get(key);
    // is it already a collection?
    if(current && current.add) {
      log.info('Appending to existing collection', key, model, current);
      current.add(results);
    } else {
      // initialize
      log.info('Initializing collection during hydration', key, model, results);
      model.set(key, new Collection(results));
    }
  } else {
    // otherwise, it's a singular property
    model.set(key, (results.length == 1 ? results[0] : results));
  }
}

// given a fetched object, populate any refs to foreign models in it
// and call the callback
module.exports = function hydrate(name, models, onDone) {
  // if there is no hydratable relations, then just call the callback
  if(!cache.meta(name, 'rels')) {
    return onDone(undefined, models);
  }
  var tasks = [],
      waiting = 0,
      rels = cache.meta(name, 'rels'),
      lastError = null;
  // support both arrays and individual models
  (Array.isArray(models) ? models : [ models ]).forEach(function(model) {
    log.info('Hydrating '+ name, model.id, model, rels);

    // for each hydration task, there is an array of relation keys to fill in
    Object.keys(rels).forEach(function(key) {
      // is a value set that needs to be hydrated?
      var ids = model.get(key),
          modelName = rels[key].type;

      log.debug(name + '.'+key +' hydration check: ', ids, typeof ids);


      // the value may be one of:
      // 1. a string or number representing a single id
      // 2. an array of strings or ids
      // 3. a collection
      if(ids instanceof Collection) {
        log.warn('Attempted to hydrate a Collection:', ids);
        ids = ids.models;
      }
      // for empty collections, we still need to do the initialization bit
      // so might as well always do it.
      // Otherwise: some models will have properties that are not collections when they should be.
      if(Array.isArray(ids)) {
        var current = model.get(key);
        if(!current || !current.add) {
          model.set(key, new Collection());
        }
      }

      // the value may be empty if there are no ids
      if(!ids) {
        return;
      }

      (Array.isArray(ids) ? ids : [ ids ]).forEach(function(id) {
        // acceptable values are numbers, strings and arrays of numbers and strings
        if(typeof id != 'number' && typeof id != 'string') {
          return;
        }

        log.info('Queue hydration for:', modelName, id);

        // else queue up the task to fetch the related model
        tasks.push(function(done) {
          // can we fetch the value to hydrate locally? if so, we're done with this
          var value = cache.local(modelName, id);
          if(value) {
            log.info('Hydrating from local cache', modelName, id);
            set(model, key, ids, value);
            return done();
          }
          cache.get(modelName, id, function(err, results) {
            if(err) {
              if(err == 404) {
                log.warn('Skip hydration for:', modelName, id, 'due to 404.');
                return done();
              }
              lastError = err;
            }

            log.info('Complete hydration for:', modelName, id);
            // set value
            set(model, key, ids, results);
            done();
          })
        });
      });
    });
  });

  function series(task) {
    if(task) {
      task(function(result) {
        return series(tasks.shift());
      });
    } else {
      return onDone(lastError, models);
    }
  }
  series(tasks.shift());
}
},
"microee": {"c":1,"m":"index.js"}};
require.m[1] = {
"backbone": { exports: window.Backbone },
"minilog": { exports: window.Minilog },
"index.js": function(module, exports, require){
function M() { this._events = {}; }
M.prototype = {
  on: function(ev, cb) {
    this._events || (this._events = {});
    var e = this._events;
    (e[ev] || (e[ev] = [])).push(cb);
    return this;
  },
  removeListener: function(ev, cb) {
    var e = this._events[ev] || [], i;
    for(i = e.length-1; i >= 0 && e[i]; i--){
      if(e[i] === cb || e[i].cb === cb) { e.splice(i, 1); }
    }
  },
  removeAllListeners: function(ev) {
    if(!ev) { this._events = {}; }
    else { this._events[ev] && (this._events[ev] = []); }
  },
  emit: function(ev) {
    this._events || (this._events = {});
    var args = Array.prototype.slice.call(arguments, 1), i, e = this._events[ev] || [];
    for(i = e.length-1; i >= 0 && e[i]; i--){
      e[i].apply(this, args);
    }
    return this;
  },
  when: function(ev, cb) {
    return this.once(ev, cb, true);
  },
  once: function(ev, cb, when) {
    if(!cb) return this;
    function c() {
      if(!when) this.removeListener(ev, c);
      if(cb.apply(this, arguments) && when) this.removeListener(ev, c);
    }
    c.cb = cb;
    this.on(ev, c);
    return this;
  }
};
M.mixin = function(dest) {
  var o = M.prototype, k;
  for (k in o) {
    o.hasOwnProperty(k) && (dest.prototype[k] = o[k]);
  }
};
module.exports = M;
}};
mmm = require('index.js');
}());