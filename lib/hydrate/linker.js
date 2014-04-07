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
