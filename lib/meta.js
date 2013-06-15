var log = require('minilog')('mmm/meta'),
    Backbone = require('backbone');

var meta = {},
    model = {};

// fetch the key value as-is
exports.get = function(name, key) {
  if(arguments.length == 1) {
    // disallowed so that there is more strict control
    throw new Error('meta.get must be called with two parameters, direct lookup not supported.');
  }
  if(meta[name] && meta[name][key]) {
    return meta[name][key];
  }
};

// also evaluate the result if it's a function
exports.result = function(name, key) {
  var value = exports.get(name, key);
  // if a property is a function, evaluate it
  return (typeof value === 'function' ? value.call(meta[name]) : value);
};

// get the model class for the given name
exports.model = function(name) {
  if(!model[name]) throw new Error(name + ' does not have a definition.');
  return model[name];
};

// get the collection class for the given name
exports.collection = function(name) {
  var collection = exports.get(name, 'collection');
  if(!collection) {
    console.log(name + ' does not have a `.collection` property.');
    return Backbone.Collection;
  }
  return exports.model(collection);
};

exports.define = function(name, mmeta) {
  if(arguments.length == 1 && typeof name == 'object') {
    // allow define( { name1: meta1, name2: meta2 });
    Object.keys(name).forEach(function(key) {
      exports.define(key, name[key]);
    });
    return;
  }

  // meta properties:
  // .plural => used in hydrating results from JSONAPI which uses this
  // .url => used to determine the endpoint
  // .rels => hash of relations:
  //   'keyname': { type: 'Type' }
  // .collection => name of collection class used (not instance to avoid circular deps)

  // Assume we are given a Backbone model. All the interesting properties are on the prototype.
  meta[name] = mmeta.prototype;
  model[name] = mmeta;
};

