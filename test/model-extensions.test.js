var assert = require('assert'),
    util = require('util'),
    http = require('http'),
    mg = require('mg'),
    server = require('./lib/test_server.js'),
    Post = require('./lib/models.js').Post,
    Backbone = require('backbone');

// require('minilog').enable();

exports['given two subscriptions to a model by id'] = {

  before: function(done) {
    var self = this;
    this.server = http.createServer(function(req, res) {
      server.onRequest(req, res);
    }).listen(8721).on('listening', function() {
      done();
    });
  },

  after: function(done) {
    this.server.once('close', done).close();
  },

/*
  'calling get without asking for "with" throws': function(done) {
    var self = this;
    mg.findById('Post', 1, function(err, post) {
      assert.throws(function() {
        post.get('comments');
      }, Error);
      done();
    });
  }
*/

  'basic findById': function(done) {
    var self = this;

    var post = new Post({ id: 1});

    post.fetch({ data: { rels: 'Comment' }}).done(function(data, textStatus, jqXHR) {
      mg.hydrate('Post', post, data);

    });


    mg.findById('Post', 1, function(err, post) {
      assert.ok(post instanceof Post);
      done();
    });
  },

  'findById with rels': function() {
    mg.findById('Post', { id: 1, rels: 'comments' }, function(err, post) {
      assert.ok(post instanceof Post);
      done();
    });
  },

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
