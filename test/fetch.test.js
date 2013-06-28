var assert = require('assert'),
    util = require('util'),
    http = require('http'),
    mmm = require('mmm'),
    server = require('./lib/test_server.js'),
    Post = require('./lib/models.js').Post;

require('minilog').suggest.deny(/mmm/, 'warn');
require('minilog').enable();

exports['given a simple model'] = {

  before: function(done) {
    this.server = http.createServer(function(req, res) {
      server.onRequest(req, res);
    }).listen(8721).on('listening', done);
  },

  after: function(done) {
    this.server.once('close', done).close();
  },

  'can find by id': function(done) {
    mmm.findById('Post', 1, function(err, val) {
      assert.equal(val.get('id'), 1);
      done();
    });
  },

  'multiple find calls return same instance': function(done) {
    mmm.findById('Post',1, function(err, val) {
      mmm.findById('Post',1, function(err, val2) {
        assert.equal(val.get('id'), 1);
        assert.strictEqual(val, val2);
        done();
      });
    });
  },

  'can hydrate a one-one relationship': function(done) {
    mmm.findById('Post',1, function(err, val) {
//      console.log(util.inspect(val, false, 10, true));
      // check that the model id is correct
      assert.equal(val.get('id'), 1);
      // and the model contains a child model, author
      assert.equal(val.get('author').get('name'), 'Bar');
      done();
    });
  },

  'can hydrate a one-many relationship to a array': function(done) {
    // Post (id = 2) has many comments
    mmm.findById('Post',2, function(err, val) {
      assert.equal(val.get('id'), 2);
      assert.equal(val.get('comments').at(0).get('name'), 'C-1');
      assert.equal(val.get('comments').at(1).get('name'), 'C-2');
//      console.log(util.inspect(val, false, 10, true));
      done();
    });
  },

  'can hydrate a collection of individual models from a stream': function() {
    var collection = mmm.stream('Post' , { }, function() {
      // console.log(collection);
    });
  },

  'can hydrate a collection of one-many relationship models from a stream': function() {

  },

  'when hydrating a collection of items and the collection is empty, do not create any models': function(done) {
//    mmm.stream('DataSource' , { }, function() {
    done();
  },

  'will wait properly for a pending request to complete rather than launching multiple requests': function(done) {
    done();
  },


  'can initialize the cache from a JSON-API structure': function(done) {
    done();
  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
