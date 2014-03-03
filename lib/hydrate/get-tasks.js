var meta = require('../meta.js'),
    util = require('../util.js'),
    log = require('minilog')('mg/get-tasks'),
    forEachRelationValue = require('./for-each-relation.js');

// given model data, return the tasks
// filter is a function(modelClass, id, parentClass, id) which returns whether a model should be queued
module.exports = function(name, model, filter) {
  var idAttr = meta.get(name, 'idAttribute') || 'id',
      pId = util.get(model, idAttr);

  // the current model is a task if it has an id
  if(pId && pId !== null && pId !== '') {
    log.info('Queue hydration for:', name, pId);
    filter(name, pId, name, pId);
  }
  forEachRelationValue(name, model, function(key, relType, item) {
    var cId;
    // items may be either numbers, strings or models
    switch(typeof item) {
      case 'number':
      case 'string':
        cId = item;
        break;
      case 'object':
        var idAttr = meta.get(relType, 'idAttribute') || 'id';
        // model.id
        cId = util.get(item, idAttr);
    }

    log.info('Queue hydration for:', relType, cId);
    filter(relType, cId, name, pId);
  });
};
