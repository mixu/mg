var MicroEE = require('microee'),
    log = require('minilog')('mg/hqueue'),
    util = require('../util.js'),
    meta = require('../meta.js');

function Queue(cache, ic) {
  // prevents circular dependencies from being processed
  this.seenTasks = {};
  // task queue
  this.queue = [];
  // cache instance
  this.cache = cache;

  this.inputCache = ic;
}

MicroEE.mixin(Queue);

// add an element to a queue
Queue.prototype.add = function(name, id) {
  // can this task be queued? Prevent circular deps.
  var canQueue = !(this.seenTasks[name] && this.seenTasks[name][id]);
  if(!canQueue) {
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
      log.info('overwrite from cache', old, key, oldVal, newVal);
      util.set(old, key, newVal);
    }
  });
}

// run the next fetch, merge with the input cache,
// discover dependcies and update the queue
Queue.prototype.exec = function() {
  var self = this,
      task = this.queue.shift();
  if(!task) {
    return self.emit('empty');
  }
  var name = task.name,
      id = task.id;

  var localCache = self.cache.local(name, id),
      remoteCache;

  if(!localCache) {
    self.cache.get(name, id, function(err, remoteResult) {
      if(err) {
        if(err == 404) {
          log.warn('Skip hydration for:', name, id, 'due to 404.');
          return self.exec();
        }
      }
      remoteCache = remoteResult;
      merge();
    });
  } else {
    merge();
  }

  function merge() {
    // prefer the local cache instance
    var result = remoteCache || localCache,
        inputCache = self.inputCache && self.inputCache[name] && self.inputCache[name][id];
    // when merging, take into account what the source of the data was:
    // - remotely fetched > input cache
    // - input cache > shared cache

    log.info('Merging:', name, id, localCache, remoteCache, inputCache);

    // merge with inputcache (e.g. so that input ids will be hydrated)
    if(inputCache) {
      var modelClass = meta.model(name);
      // always use the (global) cache result model as the return value
      // but apply the more recent updates from the ongoing hydration to it
      if (remoteCache) {
        override(name, remoteCache, self.inputCache[name][id]);
        result = remoteCache;

        if (inputCache instanceof modelClass &&
            inputCache !== remoteCache) {
          // disagreement: a second model instance has been created somewhere else,
          // update that other with the same values as in the result
          override(name, inputCache, remoteCache);
        }
      } else if (remoteCache instanceof modelClass === false){
        // only if the result from GET or from the cache is empty
        result = inputCache;
      }
    }

    // call model.parse as part of the initialization
    var model = meta.model(name);
    if(model && model.prototype && typeof model.prototype.parse === 'function') {
      result = model.prototype.parse(result);
    }

    // EMIT fetched => this does stuff like add the result into the hydration result cache
    // and add more stuff to the queue
    self.emit('fetched', name, id, result);
    return self.exec();
  }
};

module.exports = Queue;
