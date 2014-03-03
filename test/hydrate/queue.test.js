var assert = require('assert'),
    util = require('util'),
    Queue = require('../../lib/hydrate/queue.js');

// require('minilog').enable();

exports['given a queue'] = {

  beforeEach: function() {
    var self = this;
    this.local = {};
    this.remote = {};
    this.localCalls = [];
    this.getCalls = [];
    this.fetchEvents = [];
    this.q = new Queue({
      local: function(name, id) {
        self.localCalls.push({ name: name, id: id });
        if (self.local[name] && self.local[name][id]) {
          return self.local[name][id];
        } else {
          return false;
        }
      },
      get: function(name, id, onDone) {
        self.getCalls.push({ name: name, id: id });
        if (self.remote[name] && self.remote[name][id]) {
          onDone(null, self.remote[name][id]);
        } else {
          onDone(null, {});
        }
      }
    });
    this.q.on('fetched', function(name, id, result) {
      self.fetchEvents.push({ name: name, id: id, result: result });
    });
  },

  'can add task': function() {
    assert.ok(this.q.add('Post', 1));
  },

  'cannot add a duplicate task to the queue': function() {
    assert.ok(this.q.add('Post', 1));
    assert.ok(!this.q.add('Post', 1));
  },

  'can fetch': function(done) {
    var self = this;
    assert.ok(this.q.add('Post', 1));
    assert.ok(this.q.add('Post', 2));
    this.q.once('empty', function() {
      assert.equal(self.localCalls.length, 2);
      assert.equal(self.remoteCalls.length, 2);
      assert.equal(self.fetchEvents.length, 2);
      done();
    });
    this.q.exec();
  }
/*

  'can fetch and store an item into the interim cache': function() {
    assert.ok(this.h.add('SimpleModel', 1));
    this.h.next(function() {
    });
  },
*/

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha',
    [ '--colors', '--bail', '--ui', 'exports', '--reporter', 'spec', __filename ]
  );
  mocha.stderr.on('data', function (data) {
    if (/^execvp\(\)/.test(data)) {
     console.log('Failed to start child process. You need mocha: `npm install -g mocha`');
    }
  });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
