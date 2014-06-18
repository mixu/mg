var assert = require('assert'),
    util = require('util'),
    http = require('http'),
    mg = require('mg'),
    server = require('./lib/test_server.js'),
    Post = require('./lib/models.js').Post,
    Comment = require('./lib/models.js').Comment,
    Backbone = require('backbone'),
    cache = require('../lib/cache.js');

//require('minilog').suggest.deny(/mg/, 'info');
// require('minilog').enable();

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
    mg.findById('Post', 1, function(err, val) {
      assert.equal(val.get('__id'), 1);
      done();
    });
  },

  'multiple find calls return same instance': function(done) {
    mg.findById('Post', 1, function(err, val) {
      mg.findById('Post', 1, function(err, val2) {
        assert.equal(val.get('__id'), 1);
        assert.strictEqual(val, val2);
        done();
      });
    });
  },

  'hydration': {
    'can hydrate a one-one relationship': function(done) {
      mg.findById('Post', 1, function(err, val) {
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
      mg.findById('Post', 2, function(err, val) {
        assert.equal(val.get('__id'), 2);
        var collection = val.get('comments');
        // console.log(util.inspect(collection, false, 10, true));
        assert.equal(collection.at(0).get('name'), 'C-1');
        assert.equal(collection.at(1).get('name'), 'C-2');
        done();
      });
    },

    'can hydrate a collection of one-many relationship models from a stream': function(done) {
      var collection = mg.stream('Post', { }, function(err, value) {
        // console.log(util.inspect(collection, false, 4, true));
        assert.ok(collection instanceof Backbone.Collection);
        assert.deepEqual(collection.pluck('name'), [ 'Post1', 'Post2']);
        done();
      });
    },

    'when hydrating a collection of items and the collection is empty, do not create any models': function(done) {
      mg.define('CollectionTest', Backbone.Model.extend({
        url: 'http://localhost:8721/collectiontest/',
        collectionType: 'CollectionTests'
      }));

      mg.define('CollectionTests', Backbone.Collection.extend({
          url: 'http://localhost:8721/collectiontest/'
      }));

      mg.stream('CollectionTest', { }, function(err, collection) {
        assert.ok(collection instanceof Backbone.Collection);
        assert.equal(collection.length, 0);
        done();
      });
    },

    'after hydrating a circular JSON structure, can call toJSON safely': function(done) {
      mg.define('Circular', Backbone.Model.extend({
        urlRoot: 'http://localhost:8721/circular/',
        rels: {
          other: {
            type: 'Circular'
          }
        },
        toJSON: mg.toJSON('Circular')
      }));

      mg.findById('Circular', 1, function(err, model) {
        var result = JSON.parse(JSON.stringify(model));
        // note how the use of toJSON has stripped the circular dependency out completely
        assert.deepEqual(result, {
          id: 1,
          name: 'A'
        });

        done();
      });
    }

  },

  'streaming a collection twice': {
    'the 2nd instance\'s model obj should be === to the 1st': function(done) {
      var collection = mg.stream('Post', { }, function(err, value) {
        // store the value now (since lookup can change due to hydration)
        var beforeSecondCall = collection.get(1).get('author');
        var collection2 = mg.stream('Post', { }, function(err, value) {
          assert.ok(collection.get(1).get('author') === collection2.get(1).get('author'));
          assert.ok(beforeSecondCall === collection2.get(1).get('author'));
          assert.ok(beforeSecondCall === collection.get(1).get('author'));
          done();
        });
      });
    },
/*
    'the 2nd instance\'s collection obj should be === to the 1st': function(done) {
      var collection = mg.stream('Post', { }, function(err, value) {
        // store the value now (since lookup can change due to hydration)
        var beforeSecondCall = collection.get(2).get('comments');
        var collection2 = mg.stream('Post', { }, function(err, value) {
          assert.ok(collection.get(2).get('comments') === collection2.get(2).get('comments'));
          assert.ok(beforeSecondCall === collection2.get(2).get('comments'));
          assert.ok(beforeSecondCall === collection.get(2).get('comments'));
          done();
        });
      });
    }
*/
  },

  'if the model defines a .parse function, it is called': {

    before: function() {
      var self = this;
      self.parseCalls = 0;
      mg.define('ParseHydration', Backbone.Model.extend({
        urlRoot: 'http://localhost:8721/parsehydration/',
        parse: function(responseJSON, options) {
          self.parseCalls++;
          responseJSON.foo = 'bar';
          return responseJSON;
        }
      }));
    },

    beforeEach: function() {
      this.parseCalls = 0;
    },

    'call .parse post-"read"': function(done) {
      var self = this;
      mg.findById('ParseHydration', 1, function(err, model) {
        assert.equal(model.get('id'), 1);
        assert.equal(model.get('name'), 'AA');
        assert.equal(self.parseCalls, 1);
        assert.equal(model.get('foo'), 'bar');
        done();
      });
    }

  },

  'save': {

    'if the backend adds a new property that is a hydratable model id, hydrate it': function(done) {
      var ResponseTest = mg.define('ResponseTest', Backbone.Model.extend({
        url: 'http://localhost:8721/ResponseTest',
        rels: {
          child: { type: 'Comment' }
        }
      }));

      server.once('POST /ResponseTest', function(req, res) {
        req.body.id = 1;
        req.body.child = {
          id: 1234,
          name: 'foo'
        };
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(req.body));
      });

      server.once('GET /ResponseTest/1', function(req, res) {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ id: 1, child: 1234, name: 'foo' }));
      });


      var instance = new ResponseTest();
      instance.save({ name: 'foo' }).done(function(data) {
        mg.hydrate('ResponseTest', instance, data);
        console.log(instance);
        assert.ok(instance instanceof ResponseTest);
        assert.equal(instance.get('name'), 'foo');
        assert.equal(instance.get('id'), 1);
        assert.ok(instance.get('child') instanceof Comment);
        assert.equal(instance.get('child').get('id'), 1234);
        done();
      });
    }
  }

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
