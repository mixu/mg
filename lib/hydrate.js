var cache = require('./cache.js'),
    Collection = require('backbone').Collection;

if(window.Vjs2) {
  Collection.prototype.pipe = Vjs2.Collection.prototype.pipe;
}

function set(model, key, ids, results) {
  // if the original wrapper was an array, then we need to wrap this item in a collection
  if(Array.isArray(ids)) {
    var current = model.get(key);
    // is it already a collection?
    if(current && current.add) {
      console.log('Appending to existing collection', key, model, current);
      current.add(results);
    } else {
      // initialize
      console.log('Initializing collection during hydration', key, model, results);
      model.set(key, new Collection(results));
    }
  } else {
    // otherwise, it's a singular property
    model.set(key, (results.length == 1 ? results[0] : results));
  }
}

// given a fetched object, populate any refs to foreign models in it
// and call the callback
module.exports = function hydrate(name, models, onDone) {
  // if there is no hydratable relations, then just call the callback
  if(!cache.meta(name, 'rels')) {
    return onDone(undefined, models);
  }
  var tasks = [],
      waiting = 0,
      rels = cache.meta(name, 'rels'),
      lastError = null;
  // support both arrays and individual models
  (Array.isArray(models) ? models : [ models ]).forEach(function(model) {
    console.log('Hydrating '+ name, model.id, model, rels);

    // for each hydration task, there is an array of relation keys to fill in
    Object.keys(rels).forEach(function(key) {
      // is a value set that needs to be hydrated?
      var ids = model.get(key),
          modelName = rels[key].type;

      console.log(name + '.'+key +' hydration check: ', ids, typeof ids);


      // the value may be one of:
      // 1. a string or number representing a single id
      // 2. an array of strings or ids
      // 3. a collection
      if(ids instanceof Collection) {
        console.log('Attempted to hydrate a Collection:', ids);
        ids = ids.models;
      }
      // for empty collections, we still need to do the initialization bit
      // so might as well always do it.
      // Otherwise: some models will have properties that are not collections when they should be.
      if(Array.isArray(ids)) {
        var current = model.get(key);
        if(!current || !current.add) {
          model.set(key, new Collection());
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

        console.log('Queue hydration for:', modelName, id);

        // else queue up the task to fetch the related model
        tasks.push(function(done) {
          // can we fetch the value to hydrate locally? if so, we're done with this
          var value = cache.local(modelName, id);
          if(value) {
            console.log('Hydrating from local cache', modelName, id);
            set(model, key, ids, value);
            return done();
          }
          cache.get(modelName, id, function(err, results) {
            if(err) {
              if(err == 404) {
                console.log('Skip hydration for:', modelName, id, 'due to 404.');
                return done();
              }
              lastError = err;
            }

            console.log('Complete hydration for:', modelName, id);
            // set value
            set(model, key, ids, results);
            done();
          })
        });
      });
    });
  });

  function series(task) {
    if(task) {
      task(function(result) {
        return series(tasks.shift());
      });
    } else {
      return onDone(lastError, models);
    }
  }
  series(tasks.shift());
}
