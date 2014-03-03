var cache = require('./cache.js'),
    meta = require('./meta.js'),
    util = require('./util.js'),
    log = require('minilog')('mg/hydration'),
    get = util.get,
    forEachRelationValue = require('./hydrate/for-each-relation.js'),
    Queue = require('./hydrate/queue.js'),
    getTasks = require('./hydrate/get-tasks.js'),
    linker = require('./hydrate/linker.js');

function flatten(name, model, inputCache) {
  var idAttr = meta.get(name, 'idAttribute') || 'id',
      id = get(model, idAttr);
  if(id) {
    if(!inputCache[name]) {
      inputCache[name] = {};
    }
    inputCache[name][id] = model;
  }

  forEachRelationValue(name, model, function(key, relType, model) {
      // items may be either numbers, strings or models
      switch(typeof model) {
        case 'object':
          var idAttr = meta.get(relType, 'idAttribute') || 'id',
              id = util.get(model, idAttr);
          if(id) {
            if(!inputCache[relType]) {
              inputCache[relType] = {};
            }
            inputCache[relType][id] = model;
          }
      }
  });
};

module.exports = function hydrate(name, model, rels, onDone) {
  var self = this,
      // intermediate model cache (until we have exhaustively fetched all model-id combos)
      fetchCache = {},
      // input cache
      inputCache = {},
      queue = new Queue(cache, inputCache);

  // allow old style: name, model, onDone
  if (arguments.length == 3 && typeof rels === 'function') {
    onDone = rels;
    rels = meta.get(name, 'rels');
  }

  if(typeof model == 'object' && model !== null) {
    flatten(name, model, inputCache);
  } else if(model === null || model === '') {
    log.debug('hydrate(): data empty', model);
    return done(null, model);
  } else {
    // e.g. hydrate(Foo, '1a') => hydrate(Foo, { id: '1a'})
    var id = model,
        idAttr = meta.get(name, 'idAttribute') || 'id';
    model = {};
    util.set(model, idAttr, id);
  }
  // always iterate the model data to discover dependencies of this model
  // -- the data given locally may have deps that are not in the remote/cached version

  function filter(modelClass, id, parentClass, pId) {
    var isMatch = true;
    // check if this a rel we want

    // add each dependency into the queue
    if(isMatch) {
      queue.add(modelClass, id);
    }
    return isMatch;
  }

  getTasks(name, model, filter);

  queue.on('fetched', function(modelClass, id, model) {
    if(!fetchCache[modelClass]) {
      fetchCache[modelClass] = {};
    }
    // store into intermediate cache
    fetchCache[modelClass][id] = model;

    // console.log('fetched', model);

    // discover dependencies of this model
    getTasks(modelClass, model, filter);
  });

  queue.once('empty', function() {
    // done, now link and return
    var result;
    var idAttr = meta.get(name, 'idAttribute') || 'id';
    // run linker
    var allLinked = linker(fetchCache);

    Object.keys(allLinked).forEach(function(name) {
      Object.keys(allLinked[name]).forEach(function(id) {
        // update the model cache with the new model
        cache.store(name, allLinked[name][id]);
      });
    });

    // return root
    if(get(model, idAttr)) {
      // console.log(name, get(model, idAttr), allLinked, fetchCache);
      // if the model has an id, just use the cached version
      result = allLinked[name][get(model, idAttr)];
      cache.store(name, result);
    } else {
      var modelClass = meta.model(name);
      // link in any rels
      model = linker.linkSingle(name, model, allLinked);
      // instantiate the root model (needed because not part
      // of the intermediate cache so never instantiated)
      if(!(model instanceof modelClass)) {
        model = new modelClass(model);
      }
      // no point in caching this, since it doesn't have an id
      result = model
    }
    onDone(null, result);
  });

  // run the queue
  queue.exec();
};
