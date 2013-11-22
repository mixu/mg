var assert = require('assert'),
    util = require('util'),
    http = require('http'),
    mg = require('mg'),
    server = require('./lib/test_server.js'),
    Post = require('./lib/models.js').Post,
    Backbone = require('backbone');

// require('./lib/dataset.js')(mg);

// require('minilog').enable();

exports['given two subscriptions to a model by id'] = {

  before: function(done) {
    var self = this;
    this.server = http.createServer(function(req, res) {
      server.onRequest(req, res);
    }).listen(8721).on('listening', function() {

      // create direct subscription
      mg.findById('Post', 1, function(err, val) {
        if (err) throw err;
        self.model = val;
        // create wildcard subscription on all models of a type
        // => collection subscriptions are filtered versions of this

        self.collection = mg.stream('Post', { }, function() {
          // console.log(util.inspect(self.collection.models, null, 3, true));
          done();
        });
      });
    });
  },

  after: function(done) {
    this.server.once('close', done).close();
  },

  'model': {

    'can get notified of a change on the original instance': function(done) {
      var self = this;

      self.model.once('change:name', function(model, value, options) {
        // console.log('model change name to', value);
        done();
      });

      mg.findById('Post', 1, function(err, val) {
        // note that Backbone only triggers "change" when the new value is different from the old one
        val.set('name', 'FooBar');
      });
    }
  },

  'collection': {
    // Basics:
    // "add" (model, collection, options) - when a model is added to a collection.
    // "remove" (model, collection, options) - when a model is removed from a collection.
    // "reset" (collection, options) - when the collection's entire contents have been replaced.
    // "sort" (collection, options) - when the collection has been re-sorted. <= this probably should be an event about order changes
    // Streams:
    // - add
    // - alter
    // - remove


    'can be notified of newly available model after save': function(done) {
      var self = this;

      self.collection.once('add', function(model) {
        assert.equal(model.get('name'), 'NewBar');
        done();
      });

      new Post({ name: 'NewBar' }).save();
    },

    'can be notified of newly deleted model after destroy': function(done) {
      var self = this,
          origLen = self.collection.length;

      // console.log(self.collection.pluck('name'));

      self.collection.once('remove', function(model) {
        assert.equal(model.get('__id'), 1);
        process.nextTick(function() {
        // console.log(self.collection);
          assert.equal(self.collection.length, origLen - 1);
          done();
        });
      });

      mg.findById('Post', 1, function(err, val) {
        val.destroy();
      });
    }
  }
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
