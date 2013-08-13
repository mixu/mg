var assert = require('assert'),
    util = require('util'),
    http = require('http'),
    mmm = require('mmm'),
    server = require('./lib/test_server.js'),
    Post = require('./lib/models.js').Post,
    Comment = require('./lib/models.js').Comment,
    Backbone = require('backbone'),
    cache = require('../lib/cache.js');

//require('minilog').suggest.deny(/mmm/, 'info');
require('minilog').enable();

exports['given a simple model'] = {

  before: function(done) {
    cache.clear();
    this.server = http.createServer(function(req, res) {
      server.onRequest(req, res);
    }).listen(8721).on('listening', done);
  },

  after: function(done) {
    this.server.once('close', done).close();
  },

  'can find by id': function(done) {
    mmm.findById('Post', 1, function(err, val) {
      assert.equal(val.get('__id'), 1);
      done();
    });
  },

  'multiple find calls return same instance': function(done) {
    mmm.findById('Post', 1, function(err, val) {
      mmm.findById('Post', 1, function(err, val2) {
        assert.equal(val.get('__id'), 1);
        assert.strictEqual(val, val2);
        done();
      });
    });
  },

  'hydration': {
    'can hydrate a one-one relationship': function(done) {
      mmm.findById('Post', 1, function(err, val) {
        // console.log(util.inspect(val, false, 10, true));
        // check that the model id is correct
        assert.equal(val.get('__id'), 1);
        // and the model contains a child model, author
        assert.equal(val.get('author').get('name'), 'Bar');
        done();
      });
    },

    'can hydrate a one-many relationship as a Collection': function(done) {
      // Post (id = 2) has many comments
      mmm.findById('Post', 2, function(err, val) {
        assert.equal(val.get('__id'), 2);
        var collection = val.get('comments');
        // console.log(util.inspect(collection, false, 10, true));
        assert.equal(collection.at(0).get('name'), 'C-1');
        assert.equal(collection.at(1).get('name'), 'C-2');
        done();
      });
    },

    'can hydrate a collection of one-many relationship models from a stream': function(done) {
      var collection = mmm.stream('Post', { }, function(err, value) {
        // console.log(util.inspect(collection, false, 4, true));
        assert.ok(collection instanceof Backbone.Collection);
        assert.deepEqual(collection.pluck('name'), [ 'Post1', 'Post2']);
        done();
      });
    },

    'when hydrating a collection of items and the collection is empty, do not create any models': function(done) {
      mmm.define('CollectionTest', Backbone.Model.extend({
        url: 'http://localhost:8721/collectiontest/',
        sync: mmm.sync('CollectionTest')
      }));

      mmm.stream('CollectionTest' , { }, function(err, collection) {
        assert.ok(collection instanceof Backbone.Collection);
        assert.equal(collection.length, 0);
        done();
      });
    }
  },

  'findById(..., [ id1, id2 ], should work': function(done) {
    mmm.findById('Post', [1, 2], function(err, val) {
      assert.ok(Array.isArray(val));
      assert.equal(val[0].get('__id'), 1);
      assert.ok(val[0] instanceof Post);
      assert.equal(val[1].get('__id'), 2);
      assert.ok(val[1] instanceof Post);
      done();
    });
  },

  'save': {

    'if the backend adds a new property that is a hydratable model id, hydrate it': function(done) {
      var ResponseTest = mmm.define('ResponseTest', Backbone.Model.extend({
        url: 'http://localhost:8721/ResponseTest',
        sync: mmm.sync('ResponseTest'),
        rels: {
          child: { type: 'Comment' }
        }
      }));

      server.once('POST /ResponseTest', function(req, res) {
        req.body.id = 1;
        req.body.child = 1234;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(req.body));
      });

      server.once('GET /ResponseTest/1', function(req, res) {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ id: 1, child: 1234, name: 'foo' }));
      });


      var instance = new ResponseTest();
      instance.save({ name: 'foo' }, {
        success: function() {
          console.log(instance);
          assert.ok(instance instanceof ResponseTest);
          assert.equal(instance.get('name'), 'foo');
          assert.equal(instance.get('id'), 1);
          assert.ok(instance.get('child') instanceof Comment);
          assert.equal(instance.get('child').get('id'), 1234);
          done();
        }
      });
    },

    'dehydrate property that is a single model needs to be converted to an ID': function() {

    },

    'dehydrate property that is a collection needs to be converted to an array of IDs': function() {

    }
  },

  'delete': {
    'delete should remove model from regular collections': function() {

    },

    'delete should remove model from streamed collections': function() {

    },

    'delete should remove model from the cache': function() {

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
