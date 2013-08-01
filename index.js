var cache = require('./lib/cache.js'),
    meta = require('./lib/meta.js'),
    hydrate = require('./lib/hydrate.js'),
    Stream = require('./lib/stream.js'),
    Backbone = require('backbone'),
    ajax = require('./lib/ajax.js'),
    log = require('minilog')('mmm');

if(typeof window == 'undefined') {
  var najax = require('najax');
  Backbone.$ = { ajax: function() {
      var args = Array.prototype.slice.call(arguments);
      // console.log('ajax', args);
      najax.apply(najax, args);
    }
  };
}

// Define a correspondence between a name and a Model class (and metadata)
exports.define = meta.define;
exports.hydrate = hydrate;
exports.hydrate2 = hydrate.hydrate2;

// Query API

function listLocal(name, onDone) {
  onDone(undefined, cache.keys(name).map(function(id) {
    return cache.local(name, id);
  }));
}

function listRemote(name, onDone) {
  var uri = cache.uri(name);
  log.info('listRemote', name, uri);
  if(!uri) {
    console.error('Unknown mmm.stream URL: ' +name);
  }
  cache.fetch(name, uri, onDone);
}

function listBoth(name, onDone) {
  listLocal(name, function(err, localItems) {
    listRemote(name, function(err, remoteItems) {
      if(remoteItems) {
        onDone(err, localItems.concat(remoteItems));
      } else {
        onDone(err, localItems);
      }
    });
  });
}

// return a collection of models based on a set of conditions
exports.find = function(name, conditions, onDone) {
  if(typeof conditions != 'object') {
    log.warn('Warning: find() conditions not an object!');
  }
  if(conditions.id) {
    // get by id
    return hydrate(name, { id: conditions.id }, function(err, result) {
      if(err) return onDone(err);
      if(result) {
        onDone(null, result);
      }
    });
  }
  // this is how we say "get all"
  if(conditions.since == 0) {
    return listBoth(name, onDone);
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
  return hydrate(name, id, onDone);
};

// returns a pipeable stream
exports.stream = function(name, conditions, onLoaded) {
  var instance = new (meta.collection(name))();
  // start the find
  exports.find(name, { since: 0 }, function(err, results) {
    // add the results to the collection
    instance.add(results);

    onLoaded && onLoaded(null, instance);

    Stream.on(name, 'destroy', function(model) {
        log.info('mmm.stream remove collection', instance.id, model.id);
        instance.remove(model);
        // Can't seem to get the model.destroy to trigger the instance.remove event
        // Not really sure why it doesn't go through to Backbone.
        // But let's trigger it manually
        instance.trigger('remove', model, instance, {});

    });
    // subscribe to local "on-fetch-or-save" (with filter)
    // if remote subscription is supported, do that as well
    Stream.on(name, 'available', function(model) {
      log.info('mmm.stream.available', model.id, model.get('name'));
      instance.add(model);
    });
  });

  // return a pipeable object
  return instance;
};

exports.sync = function(name) {
 return function(op, model, opts) {
    log.info('sync', op, name+'='+model.id, model, opts);

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

          // 1. hydrate -- existing model (e.g. inside parse)
          // the issue here is that hydrate requires a async() api
          // but Backbone parse only works with a synchronous API

          var rels = meta.get(name, 'rels');

          // Tricky!
          // The Stream notification call has to occur after the model is completely set.
          // Since BB calls model.set(model.parse( ... )), the properties
          // are not set until we return from parse
          // The success function emits "sync" so we'll use that
          model.once('sync', function() {
            log.debug('model.sync', name, model.id);
            Stream.onFetch(name, model);
          });

          // set the onSync callback before this
          if(!rels || typeof rels != 'object') return resp;

          Object.keys(rels).forEach(function(key) {
            var current = resp[key],
                currentType = rels[key].type;
            if(!current || !current.add) {
              log.debug('Initializing collection "'+key+'" of type "'+meta.get(currentType, 'collection')+'" in `.parse` interception for '+name);
              resp[key] = new (meta.collection(currentType))();
            }
          });
          // BB calls model.set with this
          return resp;
        };
        oldSuccess.apply(opts, arguments);
      }
    }
    // delete can be tracked after this via the "destroy" event on the model

    return Backbone.sync.apply(this, arguments);
  };
};

// basically, just plucks out the right thing from the output
exports.parse = function(name) {
  return function(resp, options) {
    return resp;
  };
};
