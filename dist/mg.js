(function(){
var r=function(){var e="function"==typeof require&&require,r=function(i,o,u){o||(o=0);var n=r.resolve(i,o),t=r.m[o][n];if(!t&&e){if(t=e(n))return t}else if(t&&t.c&&(o=t.c,n=t.m,t=r.m[o][t.m],!t))throw new Error('failed to require "'+n+'" from '+o);if(!t)throw new Error('failed to require "'+i+'" from '+u);return t.exports||(t.exports={},t.call(t.exports,t,t.exports,r.relative(n,o))),t.exports};return r.resolve=function(e,n){var i=e,t=e+".js",o=e+"/index.js";return r.m[n][t]&&t?t:r.m[n][o]&&o?o:i},r.relative=function(e,t){return function(n){if("."!=n.charAt(0))return r(n,t,e);var o=e.split("/"),f=n.split("/");o.pop();for(var i=0;i<f.length;i++){var u=f[i];".."==u?o.pop():"."!=u&&o.push(u)}return r(o.join("/"),t,e)}},r}();r.m = [];
r.m[0] = {
"backbone": { exports: window.Backbone },
"minilog": { exports: window.Minilog },
"microee": {"c":1,"m":"index.js"},
"miniq": {"c":2,"m":"index.js"},
"index.js": function(module, exports, require){
var cache = require('./lib/cache.js'),
    meta = require('./lib/meta.js'),
    hydrate = require('./lib/hydrate.js'),
    Backbone = require('backbone'),
    ajax = require('./lib/ajax.js'),
    log = require('minilog')('mg'),
    util = require('./lib/util.js'),
    parallel = require('miniq');

if(typeof window == 'undefined') {
  var najax = require('najax');
  Backbone.$ = { ajax: function() {
      var args = Array.prototype.slice.call(arguments);
      return najax.apply(najax, args);
    }
  };
}

exports.define = meta.define;
exports.hydrate = hydrate;
exports.meta = meta;
exports.cache = cache;

// External API

// return a single model by id
exports.findById = function(name, id, rels, onDone) {
  // allow findById(name, id, onDone)
  if (arguments.length == 3) {
    onDone = rels;
    rels = undefined;
  }
  if (typeof id != 'string' && typeof id != 'number') {
    log.error('.findById: id be string or a number');
    return;
  }

  // check the cache for the given instance
  var modelClass = meta.model(name),
      result = cache.local(name, id);

  if(result && !rels) {
    return onDone && onDone(null, result);
  }
  if(!result) {
    var obj = { },
        idAttr = meta.get(name, 'idAttribute') || 'id';
    obj[idAttr] = id;
    result = new modelClass(obj);
  }

  // call model.fetch
  ( rels ? result.fetch({ data: rels }) : result.fetch()).done(function(data) {
    // apply hydration
    exports.hydrate(name, result, data);
    // return
    onDone && onDone(null, result);
  });
};

// returns a hydrated collection
exports.stream = function(name, rels, onDone) {
  var collection = new (meta.collection(name))();
  // call collection.fetch
  collection.fetch({ data: rels }).done(function(data) {
    // apply hydration
    exports.hydrate(name, collection, data);
    // return
    onDone && onDone(null, collection);
  });
  return collection;
};

// Model extensions

exports.link = function(name) {
  return function(urlPrefix, models, onDone) {
    var url = meta.uri(name, this.id);
    parallel(1, (Array.isArray(models) ? models : [ models ]).map(function(model) {
      return function(done) {
        ajax.put(url + urlPrefix + model.id, done);
      };
    }), onDone);
  };
};

exports.unlink = function(name) {
  return function(urlPrefix, models, onDone) {
    var url = meta.uri(name, this.id);
    parallel(1, (Array.isArray(models) ? models : [ models ]).map(function(model) {
      return function(done) {
        ajax.put(url + urlPrefix + model.id, done);
      };
    }), onDone);
  };
};

// excludes the relationships from the JSON output
exports.toJSON = function(name) {
  return function() {
    var rels = meta.get(name, 'rels'),
        result = {},
        self = this;
    if(rels) {
      rels = Object.keys(rels);
      Object.keys(this.attributes).forEach(function(key) {
        if (rels.indexOf(key) === -1) {
          result[key] = self.get(key);
        }
      });
      return result;
    }
    return this.attributes;
  };
};
},
"lib/ajax.js": function(module, exports, require){
var log = require('minilog')('mg/ajax'),
    MicroEE = require('microee'),
    queue = new MicroEE(),
    ajax;

module.exports = function(uri, onDone) {
  return fetch(uri, 'GET', onDone);
};

module.exports.put = function(uri, onDone) {
  return fetch(uri, 'PUT', onDone);
};

function fetch(uri, method, onDone) {
  var listeners = queue.listeners(uri),
      isPending = !(listeners && listeners.length === 0);
  if(onDone) {
    queue.once(uri, onDone);
  }

  if(!isPending) {
    log.debug('ajax fetch to ' + uri);
    ajax(uri, method, function(err, data) {
      if(err) return queue.emit(uri, err, null);
      // the data can be empty (e.g. nothing to hydrate)
      if(!data || Array.isArray(data) && data.length === 0) {
        log.debug('ajax empty onDone '+uri, data);
        return queue.emit(uri, null, data);
      }

      log.debug('ajax fetch onDone '+uri);
      if(typeof data === 'string') {
        throw new Error('Unexpected string: ' + data);
      }
      queue.emit(uri, null, data);
    });
  } else {
    log.debug('ajax queue for '+uri);
  }
}

module.exports._setAjax = function(obj) {
  ajax = obj;
};

ajax = module.exports._nodeFetch = function(uri, method, onDone) {
  (typeof window == 'undefined' ? require('najax') : $.ajax)(uri, {
      type: method || 'GET',
      dataType: 'json',
      // important: cache must be false, as otherwise jQuery can get into
      // a bad state if a request is aborted, cached and then never cachebusted
      cache: false,
      success: function(data, status, jqXHR) {
        onDone(null, data);
      },
      error: function(jqXHR, textStatus, httpPortion) {
        // the textStatus is often not helpful (e.g. "error" for HTTP errors)
        if(textStatus == 'error' && jqXHR) {
          return onDone(jqXHR, null);
        }
        onDone(textStatus, null);
      }
    });
};

},
"lib/meta.js": function(module, exports, require){
var log = require('minilog')('mg/meta'),
    Collection = require('backbone').Collection,
    util = require('./util.js');

var meta = {},
    model = {};

// fetch the key value as-is
exports.get = function(name, key) {
  if(arguments.length == 1) {
    return meta[name];
  }
  if(meta[name] && meta[name][key]) {
    return meta[name][key];
  }
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
  attr[(exports.get(name, 'idAttribute') || 'id')] = id;
  // if possible, avoid instantiation
  obj = require('./cache.js').local(name, id);
  if (!obj) {
    obj = new (exports.model(name))(attr);
  }
  return util.result(obj, 'url'); // call .url() or return .url
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
// Calls the getter if it exists, otherwise returns the property.
exports.get = function(obj, key) {
  if(!obj) return '';
  return (typeof obj.get == 'function' ? obj.get(key) : obj[key]);
};

// Similar to `_.result`: If the value of the named property is a function
// then invoke it with the object as context; otherwise, return it.
exports.result = function(obj, key) {
  if(!obj) return '';
  // if a property is a function, evaluate it
  return (typeof obj[key] === 'function' ? obj[key].call(obj) : obj[key]);
};

// call setter if exists, otherwise set property
exports.set = function(obj, key, value, options) {
  if(arguments.length === 2) {
    value = key;
  }
  if(typeof obj.set == 'function') {
    return obj.set(key, value, options);
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
var meta = require('./meta.js'),
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

exports.store = function(name, values) {
  if(!cache[name]) { cache[name] = {}; }

  var idAttr = meta.get(name, 'idAttribute') || 'id';
  // result may be a single item or array
  (Array.isArray(values) ? values : [ values ]).forEach(function(value) {
    var id;
    // this is the right point to notify the stream - once the model instances
    // have been fetched, unwrapped and hydrated.

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
},
"lib/hydrate.js": function(module, exports, require){
var cache = require('./cache.js'),
    meta = require('./meta.js'),
    util = require('./util.js'),
    get = util.get,
    forEachRelationValue = require('./hydrate/for-each-relation.js'),
    linkSingle = require('./hydrate/linker.js'),
    merge = require('./hydrate/merge.js'),
    Collection = require('backbone').Collection,
    log = require('minilog')('mg/hydrate');

module.exports = function hydrate(name, model, data) {
  if (model instanceof Collection && Array.isArray(data)) {
    var models = data.map(function(item) {
      return module.exports(name, item, item);
    });
    // need to call .reset() to force specific order
    model.reset(models);
    return model;
  }

  var idAttr = meta.get(name, 'idAttribute') || 'id',
      pId = get(model, idAttr),
      flat = {};

  if(!pId) {
    pId = get(data, idAttr);
  }

  if(pId) {
    if(!flat[name]) {
      flat[name] = {};
    }
    flat[name][pId] = data;
  }

  forEachRelationValue(name, data, function(key, relType, model) {
      // items may be either numbers, strings or models
      switch(typeof model) {
        case 'object':
          var idAttr = meta.get(relType, 'idAttribute') || 'id',
              id = util.get(model, idAttr);
          if(id) {
            if(!flat[relType]) {
              flat[relType] = {};
            }
            flat[relType][id] = model;
          }
      }
  });

  log.info('hydrate(', name, ',', pId, model, ',', data);

  if(typeof data != 'object') {
    return model;
  }

  // all models must be instantiated first
  // Note: here the goal is to have the flat array contain all the
  // canonical instances; this is important because we are updating collections
  // during the merge, and look up the id => instance from the flat hash
  Object.keys(flat).forEach(function(name) {
    Object.keys(flat[name]).forEach(function(id) {
      var modelClass = meta.model(name);
      // instantiate the model if necessary
      var local = cache.local(modelClass, id),
          isInstanceOf = flat[name][id] instanceof modelClass;
      if(!local && !isInstanceOf) {
        log.info('Not an instance of ' + name + ', instantiating model for', id);
        flat[name][id] = new modelClass(flat[name][id]);
      }
    });
  });

  Object.keys(flat).forEach(function(modelClass) {
    var models = flat[modelClass];
    Object.keys(models).forEach(function(id) {
      // for each part, see if a corresponding instance exists in the cache
      var local = cache.local(modelClass, id);
      if(modelClass == name && id == pId) {
        local = model;
      }
      // if it does, then update it, else instantiate it
      flat[modelClass][id] = merge(modelClass, id, flat[modelClass][id], local, flat);
    });
  });

  // run linker
  // iterate each model in flat
  Object.keys(flat).forEach(function(name) {
    Object.keys(flat[name]).forEach(function(id) {
      // link the rels
      flat[name][id] = linkSingle(name, flat[name][id], flat);
      // update the model cache with the new model
      cache.store(name, flat[name][id]);
    });
  });

  log.info('hydrate results', flat, 'returning', name, pId);

  // if the result is different from the input
  if (flat[name] && flat[name][pId]) {
    if (model !== flat[name][pId]) {
      merge.override(name, model, flat[name][pId]);
    }
    return flat[name][pId];
  }
  return model;
};
},
"lib/hydrate/merge.js": function(module, exports, require){
var meta = require('../meta.js'),
    util = require('../util.js'),
    Model = require('backbone').Model,
    log = require('minilog')('mg/merge');

function override(name, old, newer, flat) {
  var rels = meta.get(name, 'rels'),
      setValues = {};
  if(!newer) {
    return;
  }

  util.keys(newer).forEach(function(key) {
    var idAttr, oldVal, newVal, relType, isCollection, relType;
    oldVal = util.get(old, key);
    newVal = util.get(newer, key);
    isCollection = !!(oldVal && oldVal.add);
    // except if:
    if(rels && rels[key]) {
      relType = rels[key].type;
      idAttr = meta.get(relType, 'idAttribute') || 'id';
      if(typeof newVal != 'object' && util.get(oldVal, idAttr) == newVal) {
        // 1) the key is a rel and the old value is a instance of a model with the right id
        return;
      } else if(isCollection) {
        if(Array.isArray(newVal)) {
          // 2) the key is a rel and the old value is a collection with the right ids (in any order)
          // convert the new value into an array of models
          var models = newVal.map(function(item) {
            if(item instanceof Model) {
              return item;
            }
            var id = util.get(item, idAttr);
            if(!flat[relType] || !flat[relType][id]) {
              log.info('Cannot link', key, 'to', relType, id, 'items:', items);
              return;
            }
            return flat[relType][id];
          }).filter(Boolean);

          oldVal.reset(models);
          return;
        } else if(!newVal) {
          // for null / undefined, when a collection already exists, do nothing
          return;
        }
      }
    }
    // override the value
    if(oldVal !== newVal) {
      log.info('overwrite [' + key + ']: ', oldVal, ' = ', newVal);
      setValues[key] = newVal;
    }
  });

  // to avoid triggering multiple backbone events
  if(util.keys(setValues).length > 0) {
    util.set(old, setValues);
  }
}

module.exports = function(name, id, inputCache, cached, flat) {
  // prefer the local cache instance
  var result = cached || inputCache;

  log.info('Merging:', name, id, inputCache, cached);

  // merge with inputcache (e.g. so that input ids will be hydrated)
  if(inputCache && cached) {
    var modelClass = meta.model(name);

    // when merging, take into account what the source of the data was:
    if (cached instanceof modelClass === false){
      // only if the result from GET or from the cache is empty
      // - input cache > shared cache
      result = inputCache;
    } else {
      // - remotely fetched > input cache
      // use the (global) cache result model as the return value
      // but apply the more recent updates from the ongoing hydration to it
      log.info('Merge override (onto, from) :', cached, inputCache);
      override(name, cached, inputCache, flat);
      result = cached;

      if (inputCache instanceof modelClass &&
          inputCache !== cached) {
        // disagreement: a second model instance has been created somewhere else,
        // update that other with the same values as in the result
        override(name, inputCache, cached, flat);
      }
    }
  }

  log.info('Merge result:', name, id, result);
  return result;
};

module.exports.override = override;
},
"lib/hydrate/linker.js": function(module, exports, require){
var meta = require('../meta.js'),
    util = require('../util.js'),
    log = require('minilog')('mg/link'),
    Collection = require('backbone').Collection;

// link a single model to its dependencies
module.exports = function(name, instance, items) {
   // check its rels, and store the appropriate link
  var self = this,
      rels = meta.get(name, 'rels'),
      idAttr = meta.get(name, 'idAttribute') || 'id';

  log.info('linkSingle', name, util.get(instance, idAttr), rels);
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
    var needsCollection = Array.isArray(value);
    if(!isCollection && (needsCollection || rels[key].isCollection)) {
      // use the isCollection boolean to indicate that a collection should be initialized
      // regardless of whether the response e.g. from Create contains a field for it
      log.info('Initializing collection during hydration', key);
      value = new (meta.collection(relType))();
      util.set(instance, key, value, { silent: true });
      isCollection = true;
    }

    // no tasks if ids is not set
    if(!ids) {
      return;
    }
    (Array.isArray(ids) ? ids : [ ids ]).forEach(function(modelId) {
      // items may be either numbers, strings or models
      var id, idAttr;
      switch(typeof modelId) {
        case 'number':
        case 'string':
          id = modelId;
          break;
        case 'object':
          idAttr = meta.get(relType, 'idAttribute') || 'id';
          id = util.get(modelId, idAttr);
      }
      if(id) {
        // items are not guaranteed to be there for linking since ajax is up to Backbone
        if(!items[relType] || !items[relType][id]) {
          log.info('Cannot link', key, 'to', relType, id, 'items:', items);
          return;
        }
        log.info('Link', key, 'to', relType, id, isCollection);
        if(isCollection) {
          value.add(items[relType][id]);
        } else {
          util.set(instance, key, items[relType][id], { silent: true });
        }
      }
    });
  });
  return instance;
}
},
"lib/hydrate/for-each-relation.js": function(module, exports, require){
var meta = require('../meta.js'),
    util = require('../util.js'),
    Collection = require('backbone').Collection;

module.exports = function(name, model, eachFn) {
  // get rels for the current model
  var rels = meta.get(name, 'rels');
  // shortcut if no rels to consider
  if(!rels) return;
  // for each key-value pair, run the eachFn
  Object.keys(rels).forEach(function(key) {
    // is a value set that needs to be hydrated?
    var ids = util.get(model, key),
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
};
}
};
r.m[1] = {
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
  listeners: function(ev) {
    return (this._events ? this._events[ev] || [] : []);
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
}
};
r.m[2] = {
"backbone": { exports: window.Backbone },
"minilog": { exports: window.Minilog },
"index.js": function(module, exports, require){
var microee = require('microee');

function Parallel(limit) {
  this.limit = limit || Infinity;
  this.running = 0;
  this.tasks = [];
  this.removed = [];
}

microee.mixin(Parallel);

Parallel.prototype.concurrency = function(limit) {
  this.limit = limit;
  return this;
};

Parallel.prototype.exec = function(tasks, onDone) {
  var self = this,
      completed = [];

  if(!tasks || tasks.length == 0) {
    onDone && onDone();
    return this._exec();
  }

  this.tasks = this.tasks.concat(tasks);

  function errHandler(err, task) {
    if(tasks.indexOf(task) > -1) {
      self.removeListener('error', errHandler);
      self.removeListener('done', doneHandler);
      self.removeTasks(tasks);
      onDone(err);
    }
  }
  function doneHandler(task) {
    if(tasks.indexOf(task) > -1) {
      completed.push(task);
    } else {
      return false;
    }
    var allDone = completed.length == tasks.length;
    if(allDone) {
      self.removeListener('error', errHandler);
      onDone();
    }
    return allDone;
  }

  if(onDone) {
    this.on('error', errHandler)
        .when('done', doneHandler);
  }
  return this._exec();
};

Parallel.prototype._exec = function() {
  var self = this,
      hadError = false;

  function next() {
    // if nothing is running and the queue is empty, emit empty
    if(self.running == 0 && self.tasks.length == 0) {
      self.emit('empty');
    }
    // if nothing is running, then we can safely clean the removed queue
    if(self.running == 0) {
      self.removed = [];
    }
    while(self.running < self.limit && self.tasks.length > 0) {
      // need this IIFE so `task` can be referred to later on with the right value
      self.running++;
      (function(task) {
        // avoid issues with deep recursion
        setTimeout(function() {
          // check that the task is still in the queue
          // (as it may have been removed due to a failure)
          if(self.removed.indexOf(task) > -1) {
            self.running--;
            next();
            return;
          }

          task(function(err) {
            self.running--;
            if(err) {
              return self.emit('error', err, task);
            }
            self.emit('done', task);
            next();
          });
        }, 0);
      })(self.tasks.shift());
    }
  }
  setTimeout(function() {
    next();
  }, 0);
  return this;
};

Parallel.prototype.removeTasks = function(tasks) {
  var self = this;
  this.removed = this.removed.concat(tasks);
  tasks.forEach(function(task) {
    var index = self.tasks.indexOf(task);
    if(index > -1) {
      self.tasks.splice(index, 1);
    }
  });
};

module.exports = function(limit, tasks, onDone) {
  return new Parallel(limit).exec(tasks, onDone);
};
}
};
mg = r("index.js");}());
