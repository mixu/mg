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
  if(id && id !== null && id !== '') {
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
  if(!newer) {
    return;
  }

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
  var self = this,
      total = 0,
      results = [];
  function checkDone(result, index) {
    total++;
    results[index] = result;
    if(total == model.length) {
      done(null, results);
    }
  }
  // if the input is an array, then run hydrate on each item and
  // return back the result
  if(Array.isArray(model)) {
    // empty array
    if(model.length === 0) {
      log.debug('hydrate(): data empty', model);
      return done(null, model);
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
