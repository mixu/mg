var log = require('minilog')('mg/meta'),
    Collection = require('backbone').Collection,
    util = require('./util.js');

var meta = {},
    model = {};

// fetch the key value as-is
exports.get = function(name, key) {
  if(arguments.length == 1) {
    return meta[name];
  }
  if(meta[name] && meta[name][key]) {
    return meta[name][key];
  }
};

exports.uri = function(name, id) {
  // Backbone's url function is annoying in that it always requires an instance of an object
  // to exist with a specific id. Here, to find out what the url should be,
  // we'll create a throwaway instance of the object (with the right id)
  // and then call or fetch the url. This avoids making any assumptions beyond what
  // Backbone's public API provides; but having to create an object just to figure out the
  // URL is kind of ugly.
  var obj, attr = {};
  // for nonstandard id
  attr[(exports.get(name, 'idAttribute') || 'id')] = id;
  // if possible, avoid instantiation
  obj = require('./cache.js').local(name, id);
  if (!obj) {
    obj = new (exports.model(name))(attr);
  }
  return util.result(obj, 'url'); // call .url() or return .url
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
    return Collection;
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
  // .url => used to determine the endpoint
  // .rels => hash of relations:
  //   'keyname': { type: 'Type' }
  // .collection => name of collection class used (not instance to avoid circular deps)

  // Assume we are given a Backbone model. All the interesting properties are on the prototype.
  meta[name] = mmeta.prototype;
  model[name] = mmeta;
  return mmeta;
};

