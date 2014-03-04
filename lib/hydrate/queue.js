var MicroEE = require('microee'),
    log = require('minilog')('mg/hqueue'),
    util = require('../util.js'),
    meta = require('../meta.js');

function Queue(fetch) {
  // prevents circular dependencies from being processed
  this.seenTasks = {};
  // task queue
  this.queue = [];
  this.fetch = fetch;
}

MicroEE.mixin(Queue);

Queue.prototype.canQueue = function(name, id) {
  // can this task be queued? Prevent circular deps.
  return !(this.seenTasks[name] && this.seenTasks[name][id]);
};

Queue.prototype.seen = function(name, id) {
  if(!this.seenTasks[name]) {
    this.seenTasks[name] = {};
  }
  this.seenTasks[name][id] = true;
}

// add an element to a queue
Queue.prototype.add = function(name, id) {
  if(!this.canQueue(name, id)) {
    return false;
  }
  this.seen(name, id);
  log.info('Add fetch:', name, id);
  this.queue.push({ name: name, id: id });
  return true;
};

// run the next fetch, merge with the input cache,
// discover dependcies and update the queue
Queue.prototype.exec = function() {
  var self = this,
      task = this.queue.shift();
  if(!task) {
    return self.emit('empty');
  }
  var name = task.name,
      id = task.id;

  self.fetch(name, id, function(err, remoteResult) {
    if(err) {
      if(err == 404) {
        log.warn('Skip hydration for:', name, id, 'due to 404.');
        return self.exec();
      }
    }
    self.emit('fetched', name, id, remoteResult);
    return self.exec();
  });
};

module.exports = Queue;
