var cache = require('./cache.js'),
    meta = require('./meta.js'),
    util = require('./util.js'),
    Collection = require('backbone').Collection,
    log = require('minilog')('mmm/hydration');

var i = 0;

if(typeof window != 'undefined' && window.Cato) {
  Collection.prototype.pipe = Cato.Collection.prototype.pipe;
}

function set(model, collectionClass, key, ids, results) {
  // if the original wrapper was an array, then we need to wrap this item in a collection
  if(Array.isArray(ids)) {
    var current = model.get(key);
    // is it already a collection?
    if(current && current.add) {
      log.info('Appending to existing collection', key, 'model id=' + model.id, ' collection cid=', current.cid);
      current.add(results);
    } else {
      // initialize
      log.info('Initializing collection during hydration', key, model, results);
      model.set(key, new collectionClass(results));
    }
  } else {
    // otherwise, it's a singular property
    model.set(key, (results.length == 1 ? results[0] : results));
  }
}

// given a fetched object, populate any refs to foreign models in it
// and call the callback
module.exports = function hydrate(name, models, onDone) {
  var tasks = [],
      waiting = 0,
      rels = meta.get(name, 'rels'),
      lastError = null,
      modelClass = meta.model(name),
      // need to return a non-array for single result
      isArray = Array.isArray(models);
  // support both arrays and individual models
  if(!isArray) {
    models = [ models ];
  }

  models.forEach(function(model, index) {
    log.info('Hydrating '+ name, model.id, model, rels);

    // does this model already exist in the cache?
    var localValue = cache.local(name, model.id);
    if(localValue) {
      log.info('Hydrating from local cache', name, model.id);
      // update the value in cache
      if(model !== localValue) {
        cache.store(name, model);
      }
      // set the instance to the one from the cache
      model = models[index] = localValue;
    }
    // hydration can instantiate the model if necessary
    if(!(model instanceof modelClass)) {
      log.info('Not an instance of '+name+', instantiating model.');
      model = models[index] = new modelClass(model);
      // cache now; rels are updated later
      cache.store(name, model);
    }

    // skip to next without queuing task if no rels
    // -- but not for cached, since we may overwrite a rel with a unhydrated value
    if(!rels) return;

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
          log.info('Initializing collection during hydration', key);
          model.set(key, new (meta.collection(modelName))());
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
            set(model, meta.collection(modelName), key, ids, value);
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
            set(model, meta.collection(modelName), key, ids, results);
            done();
          })
        });
      });
    });
  });

  function series(task) {
    console.log('RUN TASK');

    if(i++ > 20) {
      return;
    }

    if(task) {
      task(function(result) {
        return series(tasks.shift());
      });
    } else {
      if(typeof onDone == 'function') {
        console.log('call DONE');
        onDone(lastError, (!isArray ? models[0] : models));
      }
    }
  }
  series(tasks.shift());
};

module.exports.hydrate2 = Hydration;

function Hydration() {
  // list of tasks by model and id;
  // prevents circular dependencies from being processed
  this.seenTasks = {};
  // intermediate model cache (until we have exhaustively fetched all model-id combos)
  this.cache = {};
  // task queue
  this.queue = [];
}

// can this task be queued? Prevent circular deps.
Hydration.prototype.canQueue = function(name, id) {
  return !(this.seenTasks[name] && this.seenTasks[name][id]);
};

// given model data, return the tasks
Hydration.prototype.getTasks = function(name, model) {
  var result = {};

  // the current model is a task if it has an id
  if(model.id != null && model.id !== '') {
    if(!result[name]) {
      result[name] = {};
    }
    log.info('Queue hydration for:', name, model.id);
    result[name][model.id] = true;
  }
  // get rels for the current model
  var rels = meta.get(name, 'rels');

  // shortcut if no rels to consider
  if(!rels) return result;

  // for each hydration task, there is an array of relation keys to fill in
  Object.keys(rels).forEach(function(key) {
    // is a value set that needs to be hydrated?
    var ids = util.get(model, key),
        modelName = rels[key].type;

    // if the value is a Collection, use the models property
    if(ids instanceof Collection) {
      ids = ids.models;
    }
    // no tasks if ids is not set
    if(!ids) {
      return;
    }

    (Array.isArray(ids) ? ids : [ ids ]).forEach(function(id) {
      if(!result[modelName]) {
        result[modelName] = {};
      }
      // items may be either numbers, strings or models
      switch(typeof id) {
        case 'number':
        case 'string':
          log.info('Queue hydration for:', modelName, id);
          result[modelName][id] = true;
          break;
        case 'object':
          // model.id
          if(id.id) {
            log.info('Queue hydration for:', modelName, id.id);
            result[modelName][id.id] = true;
          }
      }
    });
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
    // store into the intermediate cache
    if(!self.cache[name]) {
      self.cache[name] = {};
    }
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

Hydration.prototype.link = function(name, model) {
  var self = this;

  function linkRels(name, instance) {
     // check it's rels, and store the appropriate link
    var rels = meta.get(name, 'rels');

    // shortcut if no rels to consider
    if(!rels) return instance;

    // for each hydration task, there is an array of relation keys to fill in
    Object.keys(rels).forEach(function(key) {
      // is a value set that needs to be hydrated?
      var ids = util.get(model, key),
          modelName = rels[key].type;

      // if the value is a Collection, use the models property
      if(ids instanceof Collection) {
        ids = ids.models;
      }
      // no tasks if ids is not set
      if(!ids) {
        return instance;
      }

      (Array.isArray(ids) ? ids : [ ids ]).forEach(function(modelId) {
        // items may be either numbers, strings or models
        switch(typeof modelId) {
          case 'number':
          case 'string':
            log.info('Link from', name, id, 'to', modelName, modelId);
            util.set(instance, key, self.cache[modelName][modelId]);
            break;
          case 'object':
            // model.id
            if(modelId.id) {
              log.info('Link from', name, id, 'to', modelName, modelId.id);
              util.set(instance, key, self.cache[modelName][modelId.id]);
            }
        }
      });
    });
    return instance;
  }

  // iterate each model in the cache
  Object.keys(self.cache).forEach(function(name) {
    Object.keys(self.cache[name]).forEach(function(id) {
      self.cache[name][id] = linkRels(name, self.cache[name][id]);
    });
  });
  // update the model cache with the new models now that linking is complete
  Object.keys(self.cache).forEach(function(name) {
    Object.keys(self.cache[name]).forEach(function(id) {
      cache.store(name, self.cache[name][id]);
    });
  });
  // return root
  if(model.id) {
    // if the model has an id, just use the cached version
    return this.cache[name][model.id];
  } else {
    var modelClass = meta.model(name);
    // instantiate the root model
    if(!(model instanceof modelClass)) {
      log.info('Not an instance of '+name+', instantiating model.');
      model = new modelClass(model);
    }
    // link in any rels
    // no point in caching this, since it doesn't have an id
    return linkRels(name, model);
  }
};

Hydration.prototype.hydrate = function(name, model, done) {
  var self = this;
  if(model.id) {
    // if the model has an id, then use that to fetch
    // add the root model to the queue
    this.add(name, model.id);
  } else {
    // iterate the model data to discover dependencies of this model
    var deps = self.getTasks(name, model);
    // add each dependency into the queue
    Object.keys(deps).forEach(function(name) {
      Object.keys(deps[name]).forEach(function(id) {
        self.add(name, id);
      });
    });
  }
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
