var cache = require('./lib/cache.js'),
    hydrate = require('./lib/hydrate.js');

// Define a correspondence between a name and a Model class (and metadata)
exports.define = cache.define;

// Query API

// return a collection of models based on a set of conditions
exports.find = function(name, conditions, onDone) {
  if(typeof conditions != 'object') {
    console.log('Warning: find() conditions not an object!');
  }
  if(conditions.id) {
    // get by id
    return cache.get(name, conditions.id, function(err, result) {
      if(err) onDone(err);
      if(result) {
        // now, hydrate the instance. May result in further fetches.
        hydrate(name, result, onDone);
      }
    });
  }
  // search by something else -> needs to be run remotely, since we don't have the ability to
  // reason about queries on the client side

};

// return a single model  based on a set of conditions
exports.findOne = function(name, conditions, onDone) {
  return exports.find(name, conditions, function(err, result) {
    return onDone(err, result);
  })
};

// return a single model by id
exports.findById = function(name, id, onDone) {
  return exports.findOne(name, { id: id }, onDone);
};

// returns a pipeable stream
exports.stream = function(name, conditions) {

};

// Collections

exports.allAsCollection = function(name, onDone) {

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
