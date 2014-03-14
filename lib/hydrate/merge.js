var meta = require('../meta.js'),
    util = require('../util.js'),
    log = require('minilog')('mg/merge');

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
    if(oldVal !== newVal) {
      log.info('overwrite [' + key + ']: ', oldVal, ' = ', newVal);
      util.set(old, key, newVal);
    }
  });
}

module.exports = function(name, id, inputCache, cached, isRemote) {
  // prefer the local cache instance
  var result = cached || inputCache;

  log.info('Merging:', name, id, inputCache, cached, isRemote);

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
      override(name, cached, inputCache);
      result = cached;

      if (inputCache instanceof modelClass &&
          inputCache !== cached) {
        // disagreement: a second model instance has been created somewhere else,
        // update that other with the same values as in the result
        override(name, inputCache, cached);
      }
    }
  }

  log.info('Merge result:', name, id, result);

  /*
  // call model.parse as part of the initialization
  var model = meta.model(name);
  if(model && model.prototype && typeof model.prototype.parse === 'function') {
    result = model.prototype.parse(result);
  }
  */
  return result;
};

module.exports.override = override;
