var cache = require('./cache.js'),
    meta = require('./meta.js'),
    util = require('./util.js'),
    Collection = require('backbone').Collection,
    log = require('minilog')('mg/hydration'),
    get = util.get,
    forEachRelationValue = require('./hydration/for-each-relation.js');

function Hydration() {
  // list of tasks by model and id;
  // intermediate model cache (until we have exhaustively fetched all model-id combos)
  this.cache = {};
  // input cache
  this.inputCache = {};
}

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

module.exports = function hydrate(name, model, rels, onDone) {
  var self = this,
      queue = new Queue();

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

  function filter(modelClass, id, parentClass, pId) {
    var isMatch = false;
    // check if this a rel we want

    // add each dependency into the queue
    if(isMatch) {
      queue.add(modelClass, id);
    }
    return isMatch;
  }

  getTasks(name, model, filter);

  queue.on('fetched', function(modelClass, id, model) {
    if(!self.cache[name]) {
      self.cache[name] = {};
    }
    // store into intermediate cache
    self.cache[name][id] = result;

    // discover dependencies of this model
    getTasks(name, model, filter);
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


  var idAttr = meta.get(name, 'idAttribute') || 'id';
  // run linker
  var allLinked = linker();

  Object.keys(allLinked).forEach(function(name) {
    Object.keys(allLinked[name]).forEach(function(id) {
      // update the model cache with the new model
      cache.store(name, allLinked[name][id]);
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

module.exports.hydrate = Hydration;
