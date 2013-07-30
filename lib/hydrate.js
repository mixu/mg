var cache = require('./cache.js'),
    meta = require('./meta.js'),
    Collection = require('backbone').Collection,
    log = require('minilog')('mmm/hydration');

var i = 0;

if(typeof window != 'undefined' && window.Cato) {
  Collection.prototype.pipe = Cato.Collection.prototype.pipe;
}

function set(model, collectionClass, key, ids, results) {
  // if the original wrapper was an array, then we need to wrap this item in a collection
  if(Array.isArray(ids)) {
    var current = model.get(key);
    // is it already a collection?
    if(current && current.add) {
      log.info('Appending to existing collection', key, 'model id=' + model.id, ' collection cid=', current.cid);
      current.add(results);
    } else {
      // initialize
      log.info('Initializing collection during hydration', key, model, results);
      model.set(key, new collectionClass(results));
    }
  } else {
    // otherwise, it's a singular property
    model.set(key, (results.length == 1 ? results[0] : results));
  }
}

// given a fetched object, populate any refs to foreign models in it
// and call the callback
module.exports = function hydrate(name, models, onDone) {
  var tasks = [],
      waiting = 0,
      rels = meta.get(name, 'rels'),
      lastError = null,
      modelClass = meta.model(name),
      // need to return a non-array for single result
      isArray = Array.isArray(models);
  // support both arrays and individual models
  if(!isArray) {
    models = [ models ];
  }

  models.forEach(function(model, index) {
    log.info('Hydrating '+ name, model.id, model, rels);

    // does this model already exist in the cache?
    var localValue = cache.local(name, model.id);
    if(localValue) {
      log.info('Hydrating from local cache', name, model.id);
      // update the value in cache
      if(model !== localValue) {
        cache.store(name, model);
      }
      // set the instance to the one from the cache
      model = models[index] = localValue;
    }
    // hydration can instantiate the model in necessary
    if(!(model instanceof modelClass)) {
      log.info('Not an instance of '+name+', instantiating model.');
      model = models[index] = new modelClass(model);
      // cache now; rels are updated later
      cache.store(name, model);
    }

    // skip to next without queuing task if no rels
    // -- but not for cached, since we may overwrite a rel with a unhydrated value
    if(!rels) return;

    // for each hydration task, there is an array of relation keys to fill in
    Object.keys(rels).forEach(function(key) {
      // is a value set that needs to be hydrated?
      var ids = model.get(key),
          modelName = rels[key].type;

      log.debug(name + '.'+key +' hydration check: ', ids, typeof ids);


      // the value may be one of:
      // 1. a string or number representing a single id
      // 2. an array of strings or ids
      // 3. a collection
      if(ids instanceof Collection) {
        log.warn('Attempted to hydrate a Collection:', ids);
        ids = ids.models;
      }
      // for empty collections, we still need to do the initialization bit
      // so might as well always do it.
      // Otherwise: some models will have properties that are not collections when they should be.
      if(Array.isArray(ids)) {
        var current = model.get(key);
        if(!current || !current.add) {
          log.info('Initializing collection during hydration', key);
          model.set(key, new (meta.collection(modelName))());
        }
      }

      // the value may be empty if there are no ids
      if(!ids) {
        return;
      }

      (Array.isArray(ids) ? ids : [ ids ]).forEach(function(id) {
        // acceptable values are numbers, strings and arrays of numbers and strings
        if(typeof id != 'number' && typeof id != 'string') {
          return;
        }

        log.info('Queue hydration for:', modelName, id);

        // else queue up the task to fetch the related model
        tasks.push(function(done) {
          // can we fetch the value to hydrate locally? if so, we're done with this
          var value = cache.local(modelName, id);
          if(value) {
            log.info('Hydrating from local cache', modelName, id);
            set(model, meta.collection(modelName), key, ids, value);
            return done();
          }
          cache.get(modelName, id, function(err, results) {
            if(err) {
              if(err == 404) {
                log.warn('Skip hydration for:', modelName, id, 'due to 404.');
                return done();
              }
              lastError = err;
            }

            log.info('Complete hydration for:', modelName, id);
            // set value
            set(model, meta.collection(modelName), key, ids, results);
            done();
          })
        });
      });
    });
  });

  function series(task) {
    console.log('RUN TASK');

    if(i++ > 20) {
      return;
    }

    if(task) {
      task(function(result) {
        return series(tasks.shift());
      });
    } else {
      if(typeof onDone == 'function') {
        console.log('call DONE');
        onDone(lastError, (!isArray ? models[0] : models));
      }
    }
  }
  series(tasks.shift());
};
