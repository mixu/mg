var url = require('url'),
    request = require('./test/lib/request.js');

var defs = {};

// Define a correspondence between a name and a Model class (and metadata)
exports.define = function(name, Model, mmeta) {
  defs[name] = mmeta || {};
  defs[name].Model = Model;
  defs[name].cache = {};
};

exports.fetch = function(name, uri, callback) {
  // only fetch if we're not already waiting for this resource
  // parse out the path
  var parts = url.parse(uri);
  return request({ hostname: parts.hostname, path: parts.pathname, port: parts.port }, function(err, data, res) {
    // expect { modelName: [ { .. model .. }, .. ]}
    var key = defs[name].plural;
    if(data[key].length == 1) {
      return callback(err, new defs[name].Model(data[key][0]));
    } else {
      return callback(err, data[key].map(function(item) {
        return new defs[name].Model(item);
      }));
    }
  });
};

function replace(str, lookup) {
  return str.replace(/{([^}]+)}/g, function(_, key) {
    return (typeof lookup[key] != 'undefined' ? lookup[key] : key);
  });
}

// Lookup from cache by id
function local(name, id) {
  return (defs && defs[name] && defs[name].cache && defs[name].cache[id] ? defs[name].cache[id] : false);
}

// Fetch from remote or cache
function get(name, id, callback) {
  var item = local(name, id);
  if(item) {
    return callback(undefined, item);
  }
  // do remote fetch if not locally available
  if(!defs[name]) throw new Error(name + ' is not defined');
  exports.fetch(name, replace(defs[name].href, { id: id }), function(err, result) {
    if(err) callback(err);
    defs[name].cache[id] = result;
    return callback(err, result);
  });
}

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
function hydrate(name, obj, callback) {
    // if there is no hydratable relations, then just call the callback
  if(!defs[name] || !defs[name].rels) {
    return callback(undefined, obj);
  }
  var tasks = [],
      waiting = 0;
  // for each hydration task, there is an array of relation keys to fill in
  Object.keys(defs[name].rels).forEach(function(key) {
    // is a value set that needs to be hydrated?
    var ids = obj.get(key),
        modelName = defs[name].rels[key].type,
        subtasks = [];

    (Array.isArray(ids) ? ids : [ ids ]).forEach(function(id) {
      // acceptable values are numbers, strings and arrays of numbers and strings
      if(typeof id != 'number' && typeof id != 'string') {
        return;
      }
      // else queue up the task to fetch the related model
      subtasks.push(function(done) {
        // can we fetch the value to hydrate locally? if so, we're done with this
        var value = local(modelName, id);
        if(value) {
          return done(value);
        }
        get(modelName, id, function(err, result) {
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

// find a model by criteria
exports.find = function(name, search, onDone) {
  if(typeof search == 'number') {
    // get by id
    get(name, search, function(err, result) {
      if(err) onDone(err);
      // now, hydrate the object. May result in further fetches.
      if(result) {
        hydrate(name, result, onDone);
      }
    });
  } else {
    // search by something else -> needs to be run remotely
  }
};

var methodMap = {
  'create': 'POST',
  'update': 'PUT',
  'patch':  'PATCH',
  'delete': 'DELETE',
  'read':   'GET'
};

exports.sync = function(op, model, opts) {
  var params = {type: type, dataType: 'json'};

};
