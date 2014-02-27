var cache = require('./lib/cache.js'),
    meta = require('./lib/meta.js'),
    hydrate = require('./lib/hydrate.js'),
    Stream = require('./lib/stream.js'),
    Backbone = require('backbone'),
    ajax = require('./lib/ajax.js'),
    log = require('minilog')('mg'),
    util = require('./lib/util.js');

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
// return a collection of models based on a set of conditions
exports.find = function(name, conditions, onDone) {
  var idAttr = meta.get(name, 'idAttribute') || 'id';
  if(typeof conditions != 'object') {
    log.warn('Warning: find() conditions not an object!');
  }
  if(conditions[idAttr]) {
    // get by id
    return hydrate(name, conditions[idAttr], function(err, result) {
      if(err) return onDone(err);
      if(result) {
        onDone(null, result);
      }
    });
  }
  // this is how we say "get all"
  if(util.keys(conditions).length === 0) {
    return cache.getAll(name, onDone);
  }
  // search by something else -> needs to be run remotely
};

// return a single model  based on a set of conditions
exports.findOne = function(name, conditions, onDone) {
  return exports.find(name, conditions, function(err, result) {
    return onDone(err, result);
  });
};

// return a single model by id
exports.findById = function(name, id, onDone) {
  return hydrate(name, id, onDone);
};

// returns a pipeable stream
exports.stream = function(name, conditions, onLoaded) {
  var instance = new (meta.collection(name))();
  // start the find
  exports.find(name, { }, function(err, results) {
    // add the results to the collection
    if(results) {
      instance.add(results);
    }

    if(typeof onLoaded === 'function') {
      onLoaded(null, instance);
    }

    Stream.on(name, 'destroy', function(model) {
        log.info('mg.stream remove collection', instance.id, model.id);
        instance.remove(model);
        // Can't seem to get the model.destroy to trigger the instance.remove event
        // Not really sure why it doesn't go through to Backbone.
        // But let's trigger it manually
        instance.trigger('remove', model, instance, {});

    });
    // subscribe to local "on-fetch-or-save" (with filter)
    // if remote subscription is supported, do that as well
    Stream.on(name, 'available', function(model) {
      log.info('mg.stream available', model.id, model.get('name'));
      instance.add(model);
    });
  });

  // return a pipeable object
  return instance;
};

// Model extensions

exports.getter = function(name, oldGetter) {
  return function(attr) {
    // if attr is a rel property
    // check if it's loaded
    // else throw
  };
};

exports.fetchWith = function(name) {
  return function(rels, onDone) {
    // ensure that the given rels are loaded
    // call onDone
  };
};

exports.link = function(name) {
  return function(instances, onDone) {
    var tasks = (Array.isArray(instances) ? instances : [ instances ]).map(function() {
      // make ajax call
    });
    // call onDone
  };
};

exports.unlink = function(name) {
  return function(instances, onDone) {
    var tasks = (Array.isArray(instances) ? instances : [ instances ]).map(function() {
      // make ajax call
    });
    // call onDone
  };
};

exports.sync = function(name) {
 return function(op, model, opts) {
    log.info('sync', op, name+'='+model.id, model, opts);

    // to prevent circular dependencies from breaking JSON.stringify
    // remove the rel keys from the object attrs
    var rels = meta.get(name, 'rels');
    if(rels) {
      rels = Object.keys(rels);
      opts.attrs = {};
      util.keys(model).forEach(function(key) {
        if (rels.indexOf(key) === -1) {
          opts.attrs[key] = util.get(model, key);
        }
      });
    }

    // "create", "update" and "patch" can cause an updated
    // version of the model to be returned
    if(op == 'create' || op == 'update' || op == 'patch') {
      var oldSuccess = opts.success;
      // must store the old success, since the content of the success function can vary
      opts.success = function(data) {
        // after create:
        var oldParse = model.parse;
        // the issue here is that hydrate requires a async() api
        // but Backbone parse only works with a synchronous API
        //
        // The solution is to intercept the .success callback, which is
        // asynchronous; do all the asynchronous work there, and then
        // use .parse to only set the results of the asynchronous work.

        // merge data prior to calling hydrate, since hydrate with a
        // `instanceof` the right class will reuse that instance
        util.keys(data).forEach(function(key) {
          // console.log('set', key, util.get(data, key));
          util.set(model, key, util.get(data, key));
        });

        hydrate(name, model, function(err, hydrated) {
          // post-hydration, everything should be an instance of the right thing.
          // update the stored values, but do not change the object instance
          util.keys(hydrated).forEach(function(key) {
            // console.log('set', key, util.get(hydrated, key));
            util.set(model, key, util.get(hydrated, key));
          });

          // Created models are the only ones where we need to freshly create
          // new collections since the original models do not have the right properties
          // and do not go through the normal find/hydrate pipeline
          model.parse = function(data, options) {
            model.parse = oldParse;

            // Tricky!
            // The Stream notification call has to occur after the model is completely set.
            // Since BB calls model.set(model.parse( ... )), the properties
            // are not set until we return from parse
            // The success function emits "sync" so we'll use that
            model.once('sync', function() {
              log.debug('model.sync', name, model.id);
              Stream.onFetch(name, model);
            });

            // BB calls model.set with this
            return {};
          };
          oldSuccess.apply(opts, arguments);
        });
      };
    }
    // delete can be tracked after this via the "destroy" event on the model

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
