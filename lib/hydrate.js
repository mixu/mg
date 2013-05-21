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
module.exports = function hydrate(name, obj, callback) {
  // if there is no hydratable relations, then just call the callback
  if(!cache.meta(name, 'rels')) {
    return callback(undefined, obj);
  }
  var tasks = [],
      waiting = 0,
      rels = cache.meta(name, 'rels');
  // for each hydration task, there is an array of relation keys to fill in
  Object.keys(rels).forEach(function(key) {
    // is a value set that needs to be hydrated?
    var ids = obj.get(key),
        modelName = rels[key].type,
        subtasks = [];

    (Array.isArray(ids) ? ids : [ ids ]).forEach(function(id) {
      // acceptable values are numbers, strings and arrays of numbers and strings
      if(typeof id != 'number' && typeof id != 'string') {
        return;
      }
      // else queue up the task to fetch the related model
      subtasks.push(function(done) {
        // can we fetch the value to hydrate locally? if so, we're done with this
        var value = cache.local(modelName, id);
        if(value) {
          return done(value);
        }
        cache.get(modelName, id, function(err, result) {
          done(result);
        })
      });
    });
    if(subtasks.length > 0) {
      // only store the tasks array if it contains something
      tasks[key] = subtasks;
      waiting++;
    }
  });

  if(waiting == 0) {
    return callback(undefined, obj);
  }

  // for each subtasks array, run a runner
  Object.keys(tasks).forEach(function(key) {
    runner(tasks[key], function(results) {
      obj.set(key, (results.length == 1 ? results[0] : results));
      waiting--;
      if(waiting == 0) {
        callback(undefined, obj);
      }
    });
  });
}