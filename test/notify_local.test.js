var assert = require('assert'),
    util = require('util'),
    http = require('http'),
    mmm = require('mmm'),
    server = require('./lib/test_server.js'),
    Post = require('./lib/post.js');

require('./lib/dataset.js')(mmm);

exports['given two subscriptions to a model by id'] = {

  before: function(done) {
    var self = this;
    this.server = http.createServer(function(req, res) {
      server.onRequest(req, res);
    }).listen(8000).on('listening', function() {

      // create direct subscription
      Post.findById(1, function(err, val) {
        if (err) throw err;
        self.model = val;
        // create wildcard subscription on all models of a type
        // => collection subscriptions are filtered versions of this

        self.collection = Post.allCollection();
        done();
      });
    });
  },

  after: function(done) {
    this.server.once('close', done).close();
  },

  'model': {

    'can get notified of a change': function(done) {
      var self = this;
      self.model.once('change:name', function(model, value, options) {
        console.log('model change name to', value);
        done();
      });

      Post.findById(1, function(err, val) {
        val.set('name', 'Foo');
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
      new Post({ name: 'Bar '}).save();

      self.collection.once('add', function(model) {
        done();
      });
    },

    'can be notified of newly deleted model after destroy': function() {
      Post.findById(1, function(err, val) {
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
