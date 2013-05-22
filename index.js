var cache = require('./lib/cache.js'),
    hydrate = require('./lib/hydrate.js'),
    Stream = require('./lib/stream.js'),
    Collection = require('backbone').Collection;

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
  // this is how we say "get all"
  if(conditions.since == 0) {
    // this might involve a remote lookup later on
    // for now just fetch all local items
    return onDone(undefined, cache.keys(name).map(function(id) {
      return cache.local(name, id);
    }));
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
  var instance = new Collection();
  // start the find
  exports.find(name, { since: 0 }, function(err, results) {
    // add the results to the collection
    instance.add(results);

    // subscribe to local "on-fetch-or-save" (with filter)
    // if remote subscription is supported, do that as well
    Stream.on(name, 'available', function(model) {
      // console.log('stream.available', instance, model);
      instance.add([ model ]);
    });
  });

  // return a pipeable object
  return instance;
};

exports.sync = function(op, model, opts) {
//  console.log('mmm sync', op, model, opts, model.type);

  // to hook up to the stream, bind on "create"
  if(op == 'create') {
    model.once('sync', function() {
      // console.log('Model.sync', model);
      Stream.onFetch(model.type, model);
    });
  }
  // delete can be tracked after this via the "destroy" event on the model

  var response = JSON.parse(JSON.stringify(model.attributes));
  response.id = Math.floor(1 + Math.random() * 1000);

  opts.success(response);
};
