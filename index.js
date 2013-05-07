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
    return callback(item);
  }
  // do remote fetch if not locally available
  exports.fetch(replace(meta.href, { id: key }), callback);
}

// given a fetched object, populate any refs to foreign models in it
// and call the callback
function hydrate(name, obj, callback) {
  // if there is no hydratable relations, then just do the callback
  if(!meta.rels) {
    return callback(obj);
  }
  // else
  Object.keys(meta.rels).forEach(function(key) {
    // is a value set that needs to be hydrated?

    // can we fetch the value to hydrate locally? if so, we're done with this

    // else queue up the task to fetch the related model
  });
  // if no tasks were queued up, run the callback immediately

  // else wait until all the pending operations have completed and then return the callback
}


exports.find = function(name, search, onDone) {
  if(typeof number == 'number') {
    // get by id
    get(name, id, function(err, result) {
      // now, hydrate the object. May result in further fetches.
      if(result) {
        hydrate(name, result, onDone);
      }
    });
  } else {
    // search by something else -> needs to be run remotely
  }
};
