var microee = require('microee');

function Collection(models, options) {
  if(!models) { models = []; }
  if(!options) { options = {}; }
  // Note: needs to be called ".models" for Backbone compatibility (e.g. so that the .pipe method is cross-compatible)
  this.models = models;
  this._options = options;
  // if the models are not instances of options.model, then map them to instances
  if(options.model) {
    this.models = this.models.map(function(item) {
      return (item instanceof options.model ? item : new options.model(item));
    });
  }
}

microee.mixin(Collection);

Collection.prototype.get = function(at) {
  return this.models[at];
};

Collection.prototype.add = function(models, options) {
  var self = this;
  if(!Array.isArray(models)) {
    models = [ models ];
  }

  models.forEach(function(item){
    var index = self.models.length;
    if (self._options && self._options.model && !(item instanceof self._options.model)){
      item = new self._options.model(item);
    }
    self.models.push(item);
    self.emit('add', item, self, { at: index });
  });
};

Collection.prototype.pipe = function(dest) {
  var source = this;
  // pipe the current content
  source.models.forEach(function(model) {
    dest.bind(model);
  })

  // "add" (model, collection, options) — when a model is added to a collection.
  function onAdd(model, collection, options) {
    dest.bind(model, collection, options);
  }
  // "remove" (model, collection, options) — when a model is removed from a collection.
  function onRemove(model, collection, options) {
    dest.remove(model, collection, options);
  }
  // "reset" (collection, options) — when the collection's entire contents have been replaced.
  function onReset(collection, options) {
    dest.reset(collection, options);
  }
  source.on('add', onAdd);
  source.on('remove', onRemove);
  source.on('reset', onReset);

  // + cleanup when cleared
  dest.on('unpipe', function() {
    source.removeListener('add', onAdd);
    source.removeListener('remove', onRemove);
    source.removeListener('reset', onReset);
  });

  dest.emit('pipe', source);
  // allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

module.exports = Collection;
