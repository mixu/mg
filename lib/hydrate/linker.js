var meta = require('../meta.js'),
    util = require('../util.js');

module.exports = function(items) {
  var self = this;
  // all models must be instantiated first
  Object.keys(items).forEach(function(name) {
    Object.keys(items[name]).forEach(function(id) {
      var modelClass = meta.model(name);
      // instantiate the model if necessary
      if(!(items[name][id] instanceof modelClass)) {
        log.info('Not an instance of ' + name + ', instantiating model for', id);
        items[name][id] = new modelClass(items[name][id]);
      }
    });
  });
  // iterate each model in the items
  Object.keys(items).forEach(function(name) {
    Object.keys(items[name]).forEach(function(id) {
      // link the rels
      items[name][id] = linkSingle(name, items[name][id]);
    });
  });

  // return all linked
  return items;
};

// link a single model to its dependencies
function linkSingle(name, instance) {
   // check its rels, and store the appropriate link
  var self = this,
      rels = meta.get(name, 'rels'),
      idAttr = meta.get(name, 'idAttribute') || 'id';

  log.info('linkSingle', name, get(instance, idAttr), rels);
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