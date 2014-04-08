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

  Object.keys(flat).forEach(function(modelClass) {
    var models = flat[modelClass];
    Object.keys(models).forEach(function(id) {
      // for each part, see if a corresponding instance exists in the cache
      var local = cache.local(modelClass, id);
      if(modelClass == name && id == pId) {
        local = model;
      }
      // if it does, then update it, else instantiate it
      flat[modelClass][id] = merge(modelClass, id, flat[modelClass][id], local, false);
    });
  });

  // run linker
  // all models must be instantiated first
  Object.keys(flat).forEach(function(name) {
    Object.keys(flat[name]).forEach(function(id) {
      var modelClass = meta.model(name);
      // instantiate the model if necessary
      if(!(flat[name][id] instanceof modelClass)) {
        log.info('Not an instance of ' + name + ', instantiating model for', id);
        flat[name][id] = new modelClass(flat[name][id]);
      }
    });
  });
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
