var cache = require('./lib/cache.js'),
    meta = require('./lib/meta.js'),
    hydrate = require('./lib/hydrate.js'),
    Backbone = require('backbone'),
    ajax = require('./lib/ajax.js'),
    log = require('minilog')('mg'),
    util = require('./lib/util.js'),
    parallel = require('miniq');

if(typeof window == 'undefined') {
  var najax = require('najax');
  Backbone.$ = { ajax: function() {
      var args = Array.prototype.slice.call(arguments);
      // console.log('ajax', args);
      najax.apply(najax, args);
    }
  };
}

exports.define = meta.define;
exports.hydrate = hydrate;
exports.meta = meta;
exports.cache = cache;

// External API

// return a single model by id
exports.findById = function(name, id, rels, onDone) {
  // allow findById(name, id, onDone)
  if (arguments.length == 3) {
    onDone = rels;
    rels = undefined;
  }
  if (typeof id != 'string' && typeof id != 'number') {
    throw new Error('.findById: id be string or a number');
    return;
  }

  // check the cache for the given instance
  var result = cache.local(name, id),
      modelClass = meta.model(name);
  if (result) {
    return onDone && onDone(null, result);
  }
  // call model.fetch
  result = new modelClass({ id: id });

  if(rels) {
    result.fetch({ data: rels }).done(function(data) {
      // apply hydration
      exports.hydrate(name, result, data);
      // return
      onDone && onDone(null, result);
    });
  }
};

// returns a hydrated collection
exports.stream = function(name, rels, onDone) {
  var collection = new (meta.collection(name))();
  // call collection.fetch
  collection.fetch({ data: rels }).done(function(data) {
    // apply hydration
    exports.hydrate(name, collection, data);
    // return
    onDone && onDone(null, collection);
  });
  return collection;
};

// Model extensions

exports.link = function(name) {
  return function(urlPrefix, models, onDone) {
    var url = meta.uri(name, this.id);
    parallel(1, (Array.isArray(models) ? models : [ models ]).map(function(model) {
      return function(done) {
        ajax.put(url + urlPrefix + model.id, done);
      };
    }), onDone);
  };
};

exports.unlink = function(name) {
  return function(urlPrefix, models, onDone) {
    var url = meta.uri(name, this.id);
    parallel(1, (Array.isArray(models) ? models : [ models ]).map(function(model) {
      return function(done) {
        ajax.put(url + urlPrefix + model.id, done);
      };
    }), onDone);
  };
};

exports.sync = function(name) {
 return function(op, model, opts) {
    return Backbone.sync.apply(this, arguments);
  };
};

// excludes the relationships from the JSON output
exports.toJSON = function(name) {
  return function() {
    var rels = meta.get(name, 'rels'),
        result = {},
        self = this;
    if(rels) {
      rels = Object.keys(rels);
      Object.keys(this.attributes).forEach(function(key) {
        if (rels.indexOf(key) === -1) {
          result[key] = self.get(key);
        }
      });
      return result;
    }
    return this.attributes;
  };
};
