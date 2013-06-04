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
  ajax('/v1/datasources', function(err, data) {
    return onDone(undefined, cache.unwrap('DataSource', data));
  });
}

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
exports.stream = function(name, conditions, collectionClass) {
  var instance = (collectionClass ? new collectionClass() : new Collection());
  // start the find
  exports.find(name, { since: 0 }, function(err, results) {
    // add the results to the collection
    instance.add(results);

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

exports.sync = function(op, model, opts) {
  console.log('mmm sync', op, model, opts, model.type);

  // to hook up to the stream, bind on "create"
  if(op == 'create') {
    var oldSuccess = opts.success;
    opts.success = function() {
      oldSuccess.apply(opts, arguments);
      // console.log('post-success', model.type, model, model.get('name'));
      Stream.onFetch(model.type, model);
    }
  }

  // delete can be tracked after this via the "destroy" event on the model

  return Backbone.sync.apply(this, arguments);

  var response = JSON.parse(JSON.stringify(model.attributes));
  response.id = Math.floor(1 + Math.random() * 1000);

  opts.success(response);
};

// basically, just plucks out the right thing from the output
exports.parse = function(name) {
  return function(resp, options) {
    var meta = cache.meta(name);
    // console.log('mmm parse', name, resp, options);
    if(meta.plural && resp[meta.plural]) {
      if(resp[meta.plural].length == 1) {
        return resp[meta.plural][0];
      }
      return resp[meta.plural];
    }
    return resp;
  };
};
