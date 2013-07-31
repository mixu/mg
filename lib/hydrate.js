var cache = require('./cache.js'),
    meta = require('./meta.js'),
    util = require('./util.js'),
    Collection = require('backbone').Collection,
    log = require('minilog')('mmm/hydration');

if(typeof window != 'undefined' && window.Cato) {
  Collection.prototype.pipe = Cato.Collection.prototype.pipe;
}

module.exports = function hydrate(name, models, onDone) {
  new Hydration().hydrate(name, models, onDone);
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

Hydration.prototype.linkRel = function(name, instance) {
  var self = this;
   // check it's rels, and store the appropriate link
  var rels = meta.get(name, 'rels');
  log.info('LinkRels', name, instance.id, rels);

  // shortcut if no rels to consider
  if(!rels) return instance;

  // for each hydration task, there is an array of relation keys to fill in
  Object.keys(rels).forEach(function(key) {
    // is a value set that needs to be hydrated?
    var ids = util.get(instance, key),
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
          log.info('Link to', modelName, modelId);
          util.set(instance, key, self.cache[modelName][modelId]);
          break;
        case 'object':
          // model.id
          if(modelId.id) {
            log.info('Link to', modelName, modelId.id);
            util.set(instance, key, self.cache[modelName][modelId.id]);
          }
      }
    });
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
    // override values in the cached instance with values from the root model
    var keys = util.keys(model),
        exclude = Object.keys(meta.get(name, 'rels'));
    // ignore keys that have rels on them
    keys.forEach(function(key) {
      if(exclude.indexOf(key) == -1) {
        util.set(result, key, util.get(model, key));
      }
    });
    cache.store(name, result);
    return result;
  } else {
    var modelClass = meta.model(name);
    // link in any rels
    model = self.linkRel(name, model);
    // instantiate the root model
    if(!(model instanceof modelClass)) {
      // log.info('Not an instance of '+name+', instantiating model.');
      model = new modelClass(model);
    }
    // no point in caching this, since it doesn't have an id
    return model;
  }
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
  if(model.id) {
    // if the model has an id, then use that to fetch
    // add the root model to the queue
    this.add(name, model.id);
  }
  // always iterate the model data
  // to discover dependencies of this model
  // -- the data given locally may have
  // deps that are not in the remote/cached version
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
