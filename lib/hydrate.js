var cache = require('./cache.js'),
    meta = require('./meta.js'),
    util = require('./util.js'),
    Collection = require('backbone').Collection,
    log = require('minilog')('mmm/hydration');

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
  var result = {};

  // the current model is a task if it has an id
  if(model.id != null && model.id !== '') {
    if(!result[name]) {
      result[name] = {};
    }
    log.info('Queue hydration for:', name, model.id);
    result[name][model.id] = true;
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
        // model.id
        if(id.id) {
          log.info('Queue hydration for:', relType, id.id);
          result[relType][id.id] = true;
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
    // merge with inputcache
    if(self.inputCache[name] && self.inputCache[name][id]) {
      // override values in the cached instance with values from the root model
      var input = self.inputCache[name][id],
          keys = util.keys(input);
      keys.forEach(function(key) {
        util.set(result, key, util.get(input, key));
      });
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
  var rels = meta.get(name, 'rels');
  log.info('LinkRels', name, instance.id, rels);

  forEachRelationValue(name, instance, function(key, relType, modelId) {
    var value = util.get(instance, key),
        isCollection = (value && value.add);
    // multiple items: either already in a collection, or in an array that
    // needs to be altered into an collection
    if(Array.isArray(value) && !isCollection) {
      log.info('Initializing collection during hydration', key);
      value = new (meta.collection(relType))();
      util.set(instance, key, value);
      isCollection = true;
    }

    // items may be either numbers, strings or models
    switch(typeof modelId) {
      case 'number':
      case 'string':
        log.info('Link', key, 'to', relType, modelId);
        if(isCollection) {
          value.add(self.cache[relType][modelId]);
        } else {
          util.set(instance, key, self.cache[relType][modelId]);
        }
        break;
      case 'object':
        // model.id
        if(modelId.id) {
          log.info('Link', key, 'to', relType, modelId.id);
          if(isCollection) {
            value.add(self.cache[relType][modelId.id]);
          } else {
            util.set(instance, key, self.cache[relType][modelId.id]);
          }
        }
    }
  });
  return instance;
};

Hydration.prototype.link = function(name, model) {
  var self = this;
  // all models must be instantiated first
  Object.keys(self.cache).forEach(function(name) {
    Object.keys(self.cache[name]).forEach(function(id) {
      var modelClass = meta.model(name);
      // instantiate the model if necessary
      if(!(self.cache[name][id] instanceof modelClass)) {
        // log.info('Not an instance of '+name+', instantiating model.');
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
  if(model.id) {
    // if the model has an id, just use the cached version
    var result = this.cache[name][model.id];
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
  var self = this;
  if(model.id) {
    if(!this.inputCache[name]) {
      this.inputCache[name] = {};
    }
    this.inputCache[name][model.id] = model;
  }

  forEachRelationValue(name, model, function(key, relType, model) {
      // items may be either numbers, strings or models
      switch(typeof model) {
        case 'object':
          // model.id
          if(model.id) {
            if(!self.inputCache[relType]) {
              self.inputCache[relType] = {};
            }
            self.inputCache[relType][model.id] = model;
          }
      }
  });
};

Hydration.prototype.hydrate = function(name, model, done) {
  var self = this;
  // if the input is an array, then run hydrate on each item and
  // return back the result
  if(Array.isArray(model)) {
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
  if(typeof model == 'object' && model != null) {
    self.flatten(name, model);
  } else if(model == null || model == '') {
    log.debug('hydrate(): data empty', model);
    return done(null, null);
  } else {
    // e.g. hydrate(Foo, '1a') => hydrate(Foo, { id: '1a'})
    model = { id: model };
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
