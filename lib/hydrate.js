var cache = require('./cache.js'),
    meta = require('./meta.js'),
    util = require('./util.js'),
    get = util.get,
    forEachRelationValue = require('./hydrate/for-each-relation.js'),
    linker = require('./hydrate/linker.js'),
    merge = require('./hydrate/merge.js'),
    Collection = require('backbone').Collection,
    log = require('minilog')('mg/hydrate');

function flatten(name, model, inputCache) {
  var idAttr = meta.get(name, 'idAttribute') || 'id',
      id = get(model, idAttr);
  if(id) {
    if(!inputCache[name]) {
      inputCache[name] = {};
    }
    inputCache[name][id] = model;
  }

  forEachRelationValue(name, model, function(key, relType, model) {
      // items may be either numbers, strings or models
      switch(typeof model) {
        case 'object':
          var idAttr = meta.get(relType, 'idAttribute') || 'id',
              id = util.get(model, idAttr);
          if(id) {
            if(!inputCache[relType]) {
              inputCache[relType] = {};
            }
            inputCache[relType][id] = model;
          }
      }
  });
}

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
      // identify parts
      flat = {};
  flatten(name, data, flat);

  if(!pId) {
    pId = get(data, idAttr);
  }

  log.info('hydrate(', name, ',', pId, model, ',', data);

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
  var allLinked = linker(flat);
  Object.keys(allLinked).forEach(function(name) {
    Object.keys(allLinked[name]).forEach(function(id) {
      // update the model cache with the new model
      cache.store(name, allLinked[name][id]);
    });
  });

  log.info('hydrate results', allLinked, 'returning', name, pId);

  // if the result is different from the input
  if (model !== flat[name][pId]) {
    merge.override(name, model, flat[name][pId]);
  }


  return flat[name][pId];
};
