var meta = require('../meta.js'),
    util = require('../util.js'),
    Model = require('backbone').Model,
    log = require('minilog')('mg/merge');

function override(name, old, newer, flat) {
  var rels = meta.get(name, 'rels'),
      setValues = {};
  if(!newer) {
    return;
  }

  util.keys(newer).forEach(function(key) {
    var idAttr, oldVal, newVal, relType, isCollection, relType;
    oldVal = util.get(old, key);
    newVal = util.get(newer, key);
    isCollection = !!(oldVal && oldVal.add);
    // except if:
    if(rels && rels[key]) {
      relType = rels[key].type;
      idAttr = meta.get(relType, 'idAttribute') || 'id';
      if(typeof newVal != 'object' && util.get(oldVal, idAttr) == newVal) {
        // 1) the key is a rel and the old value is a instance of a model with the right id
        return;
      } else if(Array.isArray(newVal) && isCollection) {
        // 2) the key is a rel and the old value is a collection with the right ids (in any order)
        // convert the new value into an array of models
        var models = newVal.map(function(item) {
          if(item instanceof Model) {
            return item;
          }
          var id = util.get(item, idAttr);
          if(!flat[relType] || !flat[relType][id]) {
            log.info('Cannot link', key, 'to', relType, id, 'items:', items);
            return;
          }
          return flat[relType][id];
        }).filter(Boolean);

        oldVal.reset(models);
        return;
      }
    }
    // override the value
    if(oldVal !== newVal) {
      log.info('overwrite [' + key + ']: ', oldVal, ' = ', newVal);
      setValues[key] = newVal;
    }
  });

  // to avoid triggering multiple backbone events
  if(util.keys(setValues).length > 0) {
    util.set(old, setValues);
  }
}

module.exports = function(name, id, inputCache, cached, flat) {
  // prefer the local cache instance
  var result = cached || inputCache;

  log.info('Merging:', name, id, inputCache, cached);

  // merge with inputcache (e.g. so that input ids will be hydrated)
  if(inputCache && cached) {
    var modelClass = meta.model(name);

    // when merging, take into account what the source of the data was:
    if (cached instanceof modelClass === false){
      // only if the result from GET or from the cache is empty
      // - input cache > shared cache
      result = inputCache;
    } else {
      // - remotely fetched > input cache
      // use the (global) cache result model as the return value
      // but apply the more recent updates from the ongoing hydration to it
      log.info('Merge override (onto, from) :', cached, inputCache);
      override(name, cached, inputCache, flat);
      result = cached;

      if (inputCache instanceof modelClass &&
          inputCache !== cached) {
        // disagreement: a second model instance has been created somewhere else,
        // update that other with the same values as in the result
        override(name, inputCache, cached, flat);
      }
    }
  }

  log.info('Merge result:', name, id, result);
  return result;
};

module.exports.override = override;
