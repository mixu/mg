var defs = {};

// Define a correspondence between a name and a Model class (and metadata)
exports.define = function(name, Model, mmeta) {
  defs[name] = mmeta || {};
  defs[name].Model = Model;
  defs[name].cache = {};
};

exports.fetch = function(uri, callback) {
  // only fetch if we're not already waiting for this resource
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
  exports.fetch(replace(defs[name].href, { id: id }), function(err, result) {
    if(err) callback(err);
    defs[name].cache[id] = result;
    return callback(err, result);
  });
}

// given a fetched object, populate any refs to foreign models in it
// and call the callback
function hydrate(name, obj, callback) {
  var tasks = [];
  // if there is no hydratable relations, then just do the callback
  if(!defs[name] || !defs[name].rels) {
    return callback(undefined, obj);
  }
  // else
  Object.keys(defs[name].rels).forEach(function(key) {
    // is a value set that needs to be hydrated?
    var id = obj.get(key),
        modelName = defs[name].rels[key].type,
        value;
    if(!isNaN(id)) {
      // can we fetch the value to hydrate locally? if so, we're done with this
      value = local(modelName, key);
      if(value) {
        obj.set(key, value);
        return;
      }
      // else queue up the task to fetch the related model
      tasks.push(function(done) {
        get(modelName, id, function(err, result) {
          obj.set(key, result);
          done();
        })
      });
    }
  });
  //wait until all the pending operations have completed and then return the callback
  function runner() {
    if(tasks.length == 0) {
      return callback(undefined, obj);
    }
    (tasks.shift()(runner));
  }
  runner();
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
