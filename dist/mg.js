(function(){function require(e,t,n){t||(t=0);var r=require.resolve(e,t),i=require.m[t][r];if(!i)throw new Error('failed to require "'+e+'" from '+n);if(i.c){t=i.c,r=i.m,i=require.m[t][i.m];if(!i)throw new Error('failed to require "'+r+'" from '+t)}return i.exports||(i.exports={},i.call(i.exports,i,i.exports,require.relative(r,t))),i.exports}require.resolve=function(e,t){var n=e,r=e+".js",i=e+"/index.js";return require.m[t][r]&&r||require.m[t][i]&&i||n},require.relative=function(e,t){return function(n){if("."!=n.charAt(0))return require(n,t,e);var r=e.split("/"),i=n.split("/");r.pop();for(var s=0;s<i.length;s++){var o=i[s];".."==o?r.pop():"."!=o&&r.push(o)}return require(r.join("/"),t,e)}};
require.m = [];
require.m[0] = {
"backbone": { exports: window.Backbone },
"minilog": { exports: window.Minilog },
"index.js": function(module, exports, require){
var cache = require('./lib/cache.js'),
    meta = require('./lib/meta.js'),
    hydrate = require('./lib/hydrate.js'),
    Stream = require('./lib/stream.js'),
    Backbone = require('backbone'),
    ajax = require('./lib/ajax.js'),
    log = require('minilog')('mg'),
    util = require('./lib/util.js');

if(typeof window == 'undefined') {
  var najax = require('najax');
  Backbone.$ = { ajax: function() {
      var args = Array.prototype.slice.call(arguments);
      // console.log('ajax', args);
      najax.apply(najax, args);
    }
  };
}

// Define a correspondence between a name and a Model class (and metadata)
exports.define = meta.define;
exports.hydrate = hydrate;
exports.meta = meta;
exports.cache = cache;

// Query API

function listLocal(name, onDone) {
  onDone(undefined, cache.keys(name).map(function(id) {
    return cache.local(name, id);
  }));
}

function listRemote(name, onDone) {
  var uri = cache.uri(name);
  log.info('listRemote', name, uri);
  if(!uri) {
    console.error('Unknown mg.stream URL: ' +name);
  }
  cache.fetch(name, uri, function(err, data) {
    // apply hydration to the remote items
    hydrate(name, data, onDone);
  });
}

function listBoth(name, onDone) {
  listLocal(name, function(err, localItems) {
    listRemote(name, function(err, remoteItems) {
      if(remoteItems) {
        onDone(err, localItems.concat(remoteItems));
      } else {
        onDone(err, localItems);
      }
    });
  });
}

// return a collection of models based on a set of conditions
exports.find = function(name, conditions, onDone) {
  var idAttr = meta.get(name, 'idAttribute') || 'id';
  if(typeof conditions != 'object') {
    log.warn('Warning: find() conditions not an object!');
  }
  if(conditions[idAttr]) {
    // get by id
    return hydrate(name, conditions[idAttr], function(err, result) {
      if(err) return onDone(err);
      if(result) {
        onDone(null, result);
      }
    });
  }
  // this is how we say "get all"
  if(conditions.since === 0) {
    return listBoth(name, onDone);
  }

  // search by something else -> needs to be run remotely, since we don't have the ability to
  // reason about queries on the client side

};

// return a single model  based on a set of conditions
exports.findOne = function(name, conditions, onDone) {
  return exports.find(name, conditions, function(err, result) {
    return onDone(err, result);
  });
};

// return a single model by id
exports.findById = function(name, id, onDone) {
  return hydrate(name, id, onDone);
};

// returns a pipeable stream
exports.stream = function(name, conditions, onLoaded) {
  var instance = new (meta.collection(name))();
  // start the find
  exports.find(name, { since: 0 }, function(err, results) {
    // add the results to the collection
    if(results) {
      instance.add(results);
    }

    onLoaded && onLoaded(null, instance);

    Stream.on(name, 'destroy', function(model) {
        log.info('mg.stream remove collection', instance.id, model.id);
        instance.remove(model);
        // Can't seem to get the model.destroy to trigger the instance.remove event
        // Not really sure why it doesn't go through to Backbone.
        // But let's trigger it manually
        instance.trigger('remove', model, instance, {});

    });
    // subscribe to local "on-fetch-or-save" (with filter)
    // if remote subscription is supported, do that as well
    Stream.on(name, 'available', function(model) {
      log.info('mg.stream available', model.id, model.get('name'));
      instance.add(model);
    });
  });

  // return a pipeable object
  return instance;
};

exports.sync = function(name) {
 return function(op, model, opts) {
    log.info('sync', op, name+'='+model.id, model, opts);

    // to prevent circular dependencies from breaking JSON.stringify
    // remove the rel keys from the object attrs
    var rels = Object.keys(meta.get(name, 'rels'));
    opts.attrs = {};
    util.keys(model).forEach(function(key) {
      if (rels.indexOf(key) === -1) {
        opts.attrs[key] = util.get(model, key);
      }
    });

    // "create", "update" and "patch" can cause an updated
    // version of the model to be returned
    if(op == 'create' || op == 'update' || op == 'patch') {
      var oldSuccess = opts.success;
      // must store the old success, since the content of the success function can vary
      opts.success = function(data) {
        // after create:
        var oldParse = model.parse;
        // the issue here is that hydrate requires a async() api
        // but Backbone parse only works with a synchronous API
        //
        // The solution is to intercept the .success callback, which is
        // asynchronous; do all the asynchronous work there, and then
        // use .parse to only set the results of the asynchronous work.

        // merge data prior to calling hydrate, since hydrate with a
        // `instanceof` the right class will reuse that instance
        util.keys(data).forEach(function(key) {
          // console.log('set', key, util.get(data, key));
          util.set(model, key, util.get(data, key));
        });

        hydrate(name, model, function(err, hydrated) {
          // post-hydration, everything should be an instance of the right thing.
          // update the stored values, but do not change the object instance
          util.keys(hydrated).forEach(function(key) {
            // console.log('set', key, util.get(hydrated, key));
            util.set(model, key, util.get(hydrated, key));
          });

          // Created models are the only ones where we need to freshly create
          // new collections since the original models do not have the right properties
          // and do not go through the normal find/hydrate pipeline
          model.parse = function(data, options) {
            model.parse = oldParse;

            // Tricky!
            // The Stream notification call has to occur after the model is completely set.
            // Since BB calls model.set(model.parse( ... )), the properties
            // are not set until we return from parse
            // The success function emits "sync" so we'll use that
            model.once('sync', function() {
              log.debug('model.sync', name, model.id);
              Stream.onFetch(name, model);
            });

            // BB calls model.set with this
            return {};
          };
          oldSuccess.apply(opts, arguments);
        });
      };
    }
    // delete can be tracked after this via the "destroy" event on the model

    return Backbone.sync.apply(this, arguments);
  };
};

// basically, just plucks out the right thing from the output
exports.parse = function(name) {
  return function(resp, options) {
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

  if(!parts.hostname && !parts.port) {
    parts.hostname = 'localhost';
    parts.port = 8000;
  }

  return request({ hostname: parts.hostname, path: parts.pathname, port: parts.port }, function(err, data, res) {
    callback(err, data);
  });
}

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
        if(textStatus == 'error' && jqXHR) {
          return callback(jqXHR, null);
        }
        callback(textStatus, null);
      }
    });
}

module.exports = (typeof window == 'undefined' ? fetch : ajaxFetch);
},
"lib/meta.js": function(module, exports, require){
var log = require('minilog')('mg/meta'),
    Collection = require('backbone').Collection;

var meta = {},
    model = {};

if(typeof window != 'undefined' && window.Cato) {
  Collection.prototype.pipe = Cato.Collection.prototype.pipe;
}

// fetch the key value as-is
exports.get = function(name, key) {
  if(arguments.length == 1) {
    return meta[name];
  }
  if(meta[name] && meta[name][key]) {
    return meta[name][key];
  }
};

// also evaluate the result if it's a function
exports.result = function(name, key) {
  var value = exports.get(name, key);
  // if a property is a function, evaluate it
  return (typeof value === 'function' ? value.call(meta[name]) : value);
};

// get the model class for the given name
exports.model = function(name) {
  if(!model[name]) throw new Error(name + ' does not have a definition.');
  return model[name];
};

// get the collection class for the given name
exports.collection = function(name) {
  var collection = exports.get(name, 'collection');
  if(!collection) {
    console.log(name + ' does not have a `.collection` property.');
    return Collection;
  }
  return exports.model(collection);
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
  // .plural => used in hydrating results from JSONAPI which uses this
  // .url => used to determine the endpoint
  // .rels => hash of relations:
  //   'keyname': { type: 'Type' }
  // .collection => name of collection class used (not instance to avoid circular deps)

  // Assume we are given a Backbone model. All the interesting properties are on the prototype.
  meta[name] = mmeta.prototype;
  model[name] = mmeta;
  return mmeta;
};

},
"lib/util.js": function(module, exports, require){
// call getter if it exists, otherwise return property
exports.get = function(obj, key) {
  if(!obj) return '';
  if(typeof obj.get == 'function') {
    return obj.get(key);
  } else {
    return obj[key];
  }
};

// call setter if exists, otherwise set property
exports.set = function(obj, key, value) {
  if(typeof obj.set == 'function') {
    return obj.set(key, value);
  } else {
    obj[key] = value;
  }
};

// calls .keys() if exists, otherwise does Object.keys()
exports.keys = function(obj) {
  return (typeof obj.keys == 'function' ? obj.keys() : Object.keys(obj));
};
},
"lib/cache.js": function(module, exports, require){
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
},
"lib/stream.js": function(module, exports, require){
var MicroEE = require('microee'),
    log = require('minilog')('mg/stream');
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

function numCallbacks(name, event) {
  if (emitters[name] && emitters[name]._events &&
     emitters[name]._events && emitters[name]._events[event]) {
    return (typeof emitters[name]._events[event] == 'function' ? 1 : emitters[name]._events[event].length);
  }
  return 0;
}

// each model has to be created for it to generate any events
// this is called on create; the stream should then attach to the relevant events
exports.bind = function(name, source) {
  log.debug('bind', name, source.id);
  function onChange(model, options) {
    log.debug('change', name, model.id, numCallbacks(name, 'change'));
    emitters[name].emit('change', model);
    emitters[name].emit('change:'+model.id, model);

  }
  function onDestroy(model) {
    log.debug('destroy', name, model.id, numCallbacks(name, 'destroy'));
    emitters[name].emit('destroy', model);
    emitters[name].removeAllListeners('change', model);
    emitters[name].removeAllListeners('destroy', model);
  }

  if(source.on) {
    source.on('change', onChange);
    source.on('destroy', onDestroy);
  }
};

// all tracked models originate on the server.
// for now, no support for models that do not have an id
exports.onFetch = function(name, instance) {
  if(!emitters[name]) { emitters[name] = new MicroEE(); }
  log.debug('available', name, instance.id, numCallbacks(name, 'available'));
  exports.bind(name, instance);
  emitters[name].emit('available', instance);
  return instance; // for easy application
};

// These methods make the stream look like a eventemitter in one direction (for creating subscriptions)
// They lazily instantiate a event listener
exports.on = function(name, event, listener) {
  if(!emitters[name]) { emitters[name] = new MicroEE(); }
  emitters[name].on(event, listener);
  log.debug('reg: on', name, event, numCallbacks(name, event));
};

exports.once = function(name, event, listener) {
  if(!emitters[name]) { emitters[name] = new MicroEE(); }
  emitters[name].once(event, listener);
  log.debug('reg: once', name, event, numCallbacks(name, event));
};

exports.when = function(name, event, listener) {
  if(!emitters[name]) { emitters[name] = new MicroEE(); }
  emitters[name].when(event, listener);
  log.debug('reg: when', name, event, numCallbacks(name, event));
};

exports.removeListener = function(name, event, listener) {
  log.debug('removeListener', name, event, numCallbacks(name, event));
  if(!emitters[name]) return this;
  emitters[name].removeListener(event, listener);
};

exports.removeAllListeners = function(name, event, listener) {
  log.debug('removeAllListeners', name, event, numCallbacks(name, event));
  if(!emitters[name]) return this;
  emitters[name].removeAllListeners(event, listener);
};
},
"lib/hydrate.js": function(module, exports, require){
var cache = require('./cache.js'),
    meta = require('./meta.js'),
    util = require('./util.js'),
    Collection = require('backbone').Collection,
    log = require('minilog')('mg/hydration'),
    get = util.get;

module.exports = function hydrate(name, models, onDone) {
  var h = new Hydration();
  h.hydrate(name, models, onDone);
};

module.exports.hydrate2 = Hydration;

function forEachRelationValue(name, model, eachFn) {
  // get rels for the current model
  var rels = meta.get(name, 'rels');
  // shortcut if no rels to consider
  if(!rels) return;
  // for each key-value pair, run the eachFn
  Object.keys(rels).forEach(function(key) {
    // is a value set that needs to be hydrated?
    var ids = get(model, key),
        relType = rels[key].type;

    // if the value is a Collection, use the models property
    if(ids instanceof Collection) {
      ids = ids.models;
    }
    // no tasks if ids is not set
    if(!ids) {
      return;
    }
    (Array.isArray(ids) ? ids : [ ids ]).forEach(function(id) {
      eachFn(key, relType, id);
    });
  });
}

function Hydration() {
  // list of tasks by model and id;
  // prevents circular dependencies from being processed
  this.seenTasks = {};
  // intermediate model cache (until we have exhaustively fetched all model-id combos)
  this.cache = {};
  // task queue
  this.queue = [];
  // input cache
  this.inputCache = {};
}

// can this task be queued? Prevent circular deps.
Hydration.prototype.canQueue = function(name, id) {
  return !(this.seenTasks[name] && this.seenTasks[name][id]);
};

// given model data, return the tasks
Hydration.prototype.getTasks = function(name, model) {
  var result = {},
      idAttr = meta.get(name, 'idAttribute') || 'id',
      id = get(model, idAttr);

  // the current model is a task if it has an id
  if(id && id != null && id !== '') {
    if(!result[name]) {
      result[name] = {};
    }
    log.info('Queue hydration for:', name, id);
    result[name][id] = true;
  }
  forEachRelationValue(name, model, function(key, relType, id) {
    if(!result[relType]) {
      result[relType] = {};
    }
    // items may be either numbers, strings or models
    switch(typeof id) {
      case 'number':
      case 'string':
        log.info('Queue hydration for:', relType, id);
        result[relType][id] = true;
        break;
      case 'object':
        var idAttr = meta.get(relType, 'idAttribute') || 'id';
        // model.id
        if(id && get(id, idAttr)) {
          log.info('Queue hydration for:', relType, get(id, idAttr));
          result[relType][get(id, idAttr)] = true;
        }
    }
  });

  return result;
};

// add an element to a queue
Hydration.prototype.add = function(name, id) {
  if(!this.canQueue(name, id)) {
    return false;
  }
  if(!this.seenTasks[name]) {
    this.seenTasks[name] = {};
  }
  log.info('Add fetch:', name, id);
  this.seenTasks[name][id] = true;
  this.queue.push({ name: name, id: id });
  return true;
};

function override(name, old, newer) {
  var rels = meta.get(name, 'rels');
  util.keys(newer).forEach(function(key) {
    var idAttr, oldVal, newVal, relType, isCollection;
    oldVal = util.get(old, key);
    newVal = util.get(newer, key);
    isCollection = !!(oldVal && oldVal.add);
    // except if:
    if(rels && rels[key]) {
      idAttr = meta.get(rels[key].type, 'idAttribute') || 'id';
      if(typeof newVal != 'object' && util.get(oldVal, idAttr) == newVal) {
        // 1) the key is a rel and the old value is a instance of a model with the right id
        return;
      } else if(Array.isArray(newVal) && isCollection) {
        // 2) the key is a rel and the old value is a collection with the right ids (in any order)
        return;
      }
    }
    // override the value
    util.set(old, key, util.get(newer, key));
  });
}

// run the next fetch, merge with the input cache,
// discover dependcies and update the queue
Hydration.prototype.next = function(done) {
  var self = this,
      task = this.queue.shift();
  if(!task) return done();
  var name = task.name,
      id = task.id;

  cache.get(name, id, function(err, result) {
    if(err) {
      if(err == 404) {
        log.warn('Skip hydration for:', name, id, 'due to 404.');
        return done();
      }
    }
    log.info('Intermediate cache:', name, id);
    // merge with inputcache (e.g. so that input ids will be hydrated)
    if(self.inputCache[name] && self.inputCache[name][id]) {
      var modelClass = meta.model(name);
      log.info('Override values for:', name, id);
      if (self.inputCache[name][id] instanceof modelClass) {
        // if the model in the input cache is an instance, we must reuse it
        override(name, self.inputCache[name][id], result);
        // to avoid creating duplicates when the model instance already exists
        result = self.inputCache[name][id];
      } else {
        // default to using the cache result model as the basis
        override(name, result, self.inputCache[name][id]);
      }
    }
    if(!self.cache[name]) {
      self.cache[name] = {};
    }
    // store into intermediate cache
    self.cache[name][id] = result;

    // discover dependencies of this model
    var deps = self.getTasks(name, result);
    // add each dependency into the queue
    Object.keys(deps).forEach(function(name) {
      Object.keys(deps[name]).forEach(function(id) {
        self.add(name, id);
      });
    });
    done();
  });
};

// link a single model to its dependencies
Hydration.prototype.linkRel = function(name, instance) {
  var self = this;
   // check it's rels, and store the appropriate link
  var rels = meta.get(name, 'rels'),
        idAttr = meta.get(name, 'idAttribute') || 'id';
  log.info('LinkRels', name, get(instance, idAttr), rels);
  // shortcut if no rels to consider
  if(!rels) return instance;
  // for each key-value pair, run the eachFn
  Object.keys(rels).forEach(function(key) {
    // is a value set that needs to be hydrated?
    var ids = util.get(instance, key),
        value = util.get(instance, key),
        isCollection = !!(value && value.add),
        relType = rels[key].type;

    // if the value is a Collection, use the models property
    if(ids instanceof Collection) {
      ids = ids.models;
    }

    // This check must run independently of whether ids is empty
    // so that arrays are converted into collections
    if(Array.isArray(value) && !isCollection) {
      log.info('Initializing collection during hydration', key);
      value = new (meta.collection(relType))();
      util.set(instance, key, value);
      isCollection = true;
    }

    // no tasks if ids is not set
    if(!ids) {
      return;
    }
    (Array.isArray(ids) ? ids : [ ids ]).forEach(function(modelId) {
      // items may be either numbers, strings or models
      switch(typeof modelId) {
        case 'number':
        case 'string':
          log.info('Link', key, 'to', relType, modelId, isCollection);
          if(isCollection) {
            value.add(self.cache[relType][modelId]);
          } else {
            util.set(instance, key, self.cache[relType][modelId]);
          }
          break;
        case 'object':
          var idAttr = meta.get(relType, 'idAttribute') || 'id',
              id = get(modelId, idAttr);
          if(id) {
            log.info('Link', key, 'to', relType, id, isCollection);
            if(isCollection) {
              value.add(self.cache[relType][id]);
            } else {
              util.set(instance, key, self.cache[relType][id]);
            }
          }
      }
    });
  });
  return instance;
};

Hydration.prototype.link = function(name, model) {
  var self = this,
      idAttr = meta.get(name, 'idAttribute') || 'id';
  // all models must be instantiated first
  Object.keys(self.cache).forEach(function(name) {
    Object.keys(self.cache[name]).forEach(function(id) {
      var modelClass = meta.model(name);
      // instantiate the model if necessary
      if(!(self.cache[name][id] instanceof modelClass)) {
        log.info('Not an instance of '+name+', instantiating model for', id);
        self.cache[name][id] = new modelClass(self.cache[name][id]);
      }
    });
  });
  // iterate each model in the cache
  Object.keys(self.cache).forEach(function(name) {
    Object.keys(self.cache[name]).forEach(function(id) {
      // link the rels
      self.cache[name][id] = self.linkRel(name, self.cache[name][id]);
      // update the model cache with the new model
      cache.store(name, self.cache[name][id]);
    });
  });
  // return root
  if(get(model, idAttr)) {
    // if the model has an id, just use the cached version
    var result = this.cache[name][get(model, idAttr)];
    cache.store(name, result);
    return result;
  } else {
    var modelClass = meta.model(name);
    // link in any rels
    model = self.linkRel(name, model);
    // instantiate the root model (needed because not part
    // of the intermediate cache so never instantiated)
    if(!(model instanceof modelClass)) {
      model = new modelClass(model);
    }
    // no point in caching this, since it doesn't have an id
    return model;
  }
};

Hydration.prototype.flatten = function(name, model) {
  var self = this,
      idAttr = meta.get(name, 'idAttribute') || 'id',
      id = get(model, idAttr);
  if(id) {
    if(!this.inputCache[name]) {
      this.inputCache[name] = {};
    }
    this.inputCache[name][id] = model;
  }

  forEachRelationValue(name, model, function(key, relType, model) {
      // items may be either numbers, strings or models
      switch(typeof model) {
        case 'object':
          var idAttr = meta.get(relType, 'idAttribute') || 'id',
              id = util.get(model, idAttr);
          if(id) {
            if(!self.inputCache[relType]) {
              self.inputCache[relType] = {};
            }
            self.inputCache[relType][id] = model;
          }
      }
  });
};

Hydration.prototype.hydrate = function(name, model, done) {
  var self = this;
  // if the input is an array, then run hydrate on each item and
  // return back the result
  if(Array.isArray(model)) {
    // empty array
    if(model.length === 0) {
      log.debug('hydrate(): data empty', model);
      return done(null, model);
    }
    var total = 0,
        results = [];
    function checkDone(result, index) {
      total++;
      results[index] = result;
      if(total == model.length) {
        done(null, results);
      }
    }
    model.forEach(function(item, index) {
      var h = new Hydration();
      h.hydrate(name, item, function(err, result) {
        checkDone(result, index);
      });
    });
    return;
  }
  if(typeof model == 'object' && model !== null) {
    self.flatten(name, model);
  } else if(model === null || model === '') {
    log.debug('hydrate(): data empty', model);
    return done(null, model);
  } else {
    // e.g. hydrate(Foo, '1a') => hydrate(Foo, { id: '1a'})
    var id = model,
        idAttr = meta.get(name, 'idAttribute') || 'id';
    model = {};
    util.set(model, idAttr, id);
  }
  // always iterate the model data to discover dependencies of this model
  // -- the data given locally may have deps that are not in the remote/cached version
  var deps = self.getTasks(name, model);
  // add each dependency into the queue
  Object.keys(deps).forEach(function(name) {
    Object.keys(deps[name]).forEach(function(id) {
      self.add(name, id);
    });
  });
  // run the queue
  this.next(fetch);
  // repeated fn
  function fetch() {
    if(self.queue.length > 0) {
      self.next(fetch);
    } else {
      // done, now link and return
      done(null, self.link(name, model));
    }
  }
};
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
},
"package.json": function(module, exports, require){
module.exports = {
  "name": "microee",
  "description": "A tiny EventEmitter-like client and server side library",
  "version": "0.0.2",
  "author": {
    "name": "Mikito Takada",
    "email": "mixu@mixu.net",
    "url": "http://mixu.net/"
  },
  "keywords": [
    "event",
    "events",
    "eventemitter",
    "emitter"
  ],
  "repository": {
    "type": "git",
    "url": "git://github.com/mixu/microee"
  },
  "main": "index.js",
  "scripts": {
    "test": "./node_modules/.bin/mocha --ui exports --reporter spec --bail ./test/microee.test.js"
  },
  "devDependencies": {
    "mocha": "*"
  },
  "readme": "# MicroEE\n\nA client and server side library for routing events.\n\nI was disgusted by the size of [MiniEE](https://github.com/mixu/miniee) (122 sloc, 4.4kb), so I decided a rewrite was in order.\n\nThis time, without the support for regular expressions - but still with the support for \"when\", which is my favorite addition to EventEmitters.\n\nMicroEE is a more satisfying (42 sloc, ~1100 characters), and passes the same tests as MiniEE (excluding the RegExp support, but including slightly tricky ones like removing callbacks set via once() using removeListener where function equality checks are a bit tricky).\n\n# Installing:\n\n    npm install microee\n\n# In-browser version\n\nUse the version in `./dist/`. It exports a single global, `microee`.\n\nTo run the in-browser tests, open `./test/index.html` in the browser after cloning this repo and doing npm install (to get Mocha).\n\n# Using:\n\n    var MicroEE = require('microee');\n    var MyClass = function() {};\n    MicroEE.mixin(MyClass);\n\n    var obj = new MyClass();\n    // set string callback\n    obj.on('event', function(arg1, arg2) { console.log(arg1, arg2); });\n    obj.emit('event', 'aaa', 'bbb'); // trigger callback\n\n# Supported methods\n\n- on(event, listener)\n- once(event, listener)\n- emit(event, [arg1], [arg2], [...])\n- removeListener(event, listener)\n- removeAllListeners([event])\n- when (not part of events.EventEmitter)\n- mixin (not part of events.EventEmitter)\n\n# Niceties\n\n- when(event, callback): like once(event, callback), but only removed if the callback returns true.\n- mixin(obj): adds the MicroEE functions onto the prototype of obj.\n- The following functions return `this`: on(), emit(), once(), when()\n\n# See also:\n\n    http://nodejs.org/api/events.html\n",
  "readmeFilename": "readme.md",
  "bugs": {
    "url": "https://github.com/mixu/microee/issues"
  },
  "_id": "microee@0.0.2",
  "_from": "microee@0.0.2"
};}};
mg = require('index.js');
}());