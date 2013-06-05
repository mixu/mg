var cache = require('./cache.js');

function runner(callbacks, last) {
  var results = [];
  var result_count = 0;
  callbacks.forEach(function(callback, index) {
    callback( function(result) {
      results[index] = result;
      result_count++;
      if(result_count == callbacks.length) {
        last(results);
      }
    });
  });
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
    console.log('Hydrating '+ name, model);

    // for each hydration task, there is an array of relation keys to fill in
    Object.keys(rels).forEach(function(key) {
      // is a value set that needs to be hydrated?
      var ids = model.get(key),
          modelName = rels[key].type;

      console.log(name + '.'+key +' hydration check: ', ids);

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
            return done(value);
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

            model.set(key, (results.length == 1 ? results[0] : results));
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
