var cache = require('./lib/cache.js'),
    hydrate = require('./lib/hydrate.js'),
    Stream = require('./lib/stream.js'),
    Collection = require('backbone').Collection,
    Backbone = require('backbone'),
    ajax = require('./lib/ajax.js');

// Define a correspondence between a name and a Model class (and metadata)
exports.define = cache.define;

// Query API

function listLocal(name, onDone) {
  onDone(undefined, cache.keys(name).map(function(id) {
    return cache.local(name, id);
  }));
}

function listRemote(name, onDone) {
  console.log('listRemote', name);
  if(name == 'DataSource') {
    cache.fetch(name, '/v1/datasources', onDone);
  } else if(name == 'Project') {
    cache.fetch(name, '/v1/projects', onDone);
  } else {
    console.error('Unknown mmm.stream name');
  }
}

// return a collection of models based on a set of conditions
exports.find = function(name, conditions, onDone) {
  if(typeof conditions != 'object') {
    console.log('Warning: find() conditions not an object!');
  }
  if(conditions.id) {
    // get by id
    return cache.get(name, conditions.id, function(err, result) {
      if(err) return onDone(err);
      if(result) {
        // cache returns hydrated results
        onDone(null, result);
      }
    });
  }
  // this is how we say "get all"
  if(conditions.since == 0) {

    return listRemote(name, onDone);


    // this might involve a remote lookup later on
    // for now just fetch all local items
    // return listLocal(name, onDone);
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
exports.stream = function(name, conditions, collectionClass, onLoaded) {
  var instance = (collectionClass ? new collectionClass() : new Collection());
  // start the find
  exports.find(name, { since: 0 }, function(err, results) {
    // add the results to the collection
    instance.add(results);

    onLoaded && onLoaded();

    // subscribe to local "on-fetch-or-save" (with filter)
    // if remote subscription is supported, do that as well
    Stream.on(name, 'available', function(model) {
      // console.log('stream.available', model, model.get('name'));
      instance.add(model);

      model.once('destroy', function() {
        instance.remove(model);
      });
    });
  });

  // return a pipeable object
  return instance;
};

exports.sync = function(name) {
 return function(op, model, opts) {
    console.log('sync', op, model, opts, name);

    // to hook up to the stream, bind on "create"
    if(op == 'create') {
      var oldSuccess = opts.success;
      opts.success = function() {
        // after create,
        // 1. unwrap (really, is a call to parse)
        var oldParse = model.parse;
        // discarding the success callback is not really feasible,
        // but if you call it with the original parse function,
        // the same parse logic will be applied to both "created"
        // and "updated"/"patched" models.
        // Created models are the only ones where we need to freshly create
        // new collections since the original models do not have the right properties
        // and do not go through the normal find/hydrate pipeline
        model.parse = function(resp, options) {
          model.parse = oldParse;
          var rels = cache.meta(name, 'rels');
          if(!rels || typeof rels != 'object') return resp;

          Object.keys(rels).forEach(function(key) {
            var current = resp[key];
            if(!current || !current.add) {
              resp[key] = new Collection();
            }
          });

          // BB calls model.set with this
          return resp;
        };
        // 2. hydrate -- existing model (e.g. inside parse)
        oldSuccess.apply(opts, arguments);
        // console.log('post-success', name, model, model.get('name'));
        Stream.onFetch(name, model);
      }
    }
    // delete can be tracked after this via the "destroy" event on the model
    return Backbone.sync.apply(this, arguments);
  };
};

// basically, just plucks out the right thing from the output
exports.parse = function(name) {
  return function(resp, options) {
    var meta = cache.meta(name);
    console.log('parse', name, resp._id);
    // 3. store in cache
    return resp;
  };
};
