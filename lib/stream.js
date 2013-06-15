var MicroEE = require('microee'),
    log = require('minilog')('mmm/stream');
// Single point to get events about models of a particular type.
//
// Note that creating models and then manually assigning ID's to them is not supported
// (e.g. the only way to create a model is to fetch it from the backend, or to save it to the backend)
//
// Events
// on('available') => when a model is first retrieved or assigned an id
// on('change') => when a model is changed
// on('change:id') => when a model with the id is changed
// on('destroy') => when a model deleted permanently

var emitters = {};

// each model has to be created for it to generate any events
// this is called on create; the stream should then attach to the relevant events
exports.bind = function(name, source) {

  function onChange(model, options) {
    log.debug('change', name, model.id);
    emitters[name].emit('change', model);
    emitters[name].emit('change:'+model.id, model);

  }
  function onDestroy(model) {
    log.debug('destroy', name, model.id);
    emitters[name].emit('destroy', model);
    emitters[name].removeAllListeners('change', model);
    emitters[name].removeAllListeners('destroy', model);
  }

  source.on('change', onChange);
  source.on('destroy', onDestroy);
};

// all tracked models originate on the server.
// for now, no support for models that do not have an id
exports.onFetch = function(name, instance) {
//  console.log('onFetch', name, instance);

  if(!emitters[name]) { emitters[name] = new MicroEE(); }
  exports.bind(name, instance);
  emitters[name].emit('available', instance);
  return instance; // for easy application
};

// These methods make the stream look like a eventemitter in one direction (for creating subscriptions)
// They lazily instantiate a event listener
exports.on = function(name, event, listener) {
  if(!emitters[name]) { emitters[name] = new MicroEE(); }
  emitters[name].on(event, listener);
};

exports.once = function(name, event, listener) {
  if(!emitters[name]) { emitters[name] = new MicroEE(); }
  emitters[name].once(event, listener);
};

exports.when = function(name, event, listener) {
  if(!emitters[name]) { emitters[name] = new MicroEE(); }
  emitters[name].when(event, listener);
};

exports.removeListener = function(name, event, listener) {
  if(!emitters[name]) return this;
  emitters[name].removeListener(event, listener);
};

exports.removeAllListeners = function(name, event, listener) {
  if(!emitters[name]) return this;
  emitters[name].removeAllListeners(event, listener);
};
