var meta = require('../meta.js'),
    util = require('../util.js'),
    log = require('minilog')('mg/link'),
    Collection = require('backbone').Collection;

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
      items[name][id] = linkSingle(name, items[name][id], items);
    });
  });

  // return all linked
  return items;
};

// link a single model to its dependencies
function linkSingle(name, instance, items) {
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
          // items are not guaranteed to be there for linking since ajax is
          // up to Backbone
          if(!items[relType] || !items[relType][modelId]) {
            log.info('Cannot link', key, 'to', relType, modelId, 'items:', items);
            return;
          }
          log.info('Link', key, 'to', relType, modelId, isCollection);
          if(isCollection) {
            value.add(items[relType][modelId]);
          } else {
            util.set(instance, key, items[relType][modelId]);
          }
          break;
        case 'object':
          var idAttr = meta.get(relType, 'idAttribute') || 'id',
              id = util.get(modelId, idAttr);
          if(id && items[relType] && items[relType][id]) {
            log.info('Link', key, 'to', relType, id, isCollection);
            if(isCollection) {
              value.add(items[relType][id]);
            } else {
              util.set(instance, key, items[relType][id]);
            }
          } else {
            log.info('Cannot link', key, 'to', relType, id, 'items:', items);
          }
      }
    });
  });
  return instance;
}

module.exports.linkSingle = linkSingle;
