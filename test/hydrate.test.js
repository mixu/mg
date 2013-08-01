var assert = require('assert'),
    util = require('util'),
    mmm = require('mmm'),
    Backbone = require('backbone'),
    Model = require('./lib/models.js'),
    cache = require('../lib/cache.js'),
    ajax = require('../lib/ajax.js'),
    fakeAjax = require('./lib/fake-ajax.js');

require('minilog').enable();

// Model definitions
var SimpleModel = Backbone.Model.extend({
  url: 'http://test/SimpleModel',
  sync: mmm.sync('SimpleModel')
});
mmm.define('SimpleModel', SimpleModel);

var ModelWithChild = Backbone.Model.extend({
  url: 'http://test/ModelWithChild',
  sync: mmm.sync('ModelWithChild'),
  rels: {
    child: { type: 'SimpleModel' }
  }
});
mmm.define('ModelWithChild', ModelWithChild);

var ModelWithGrandChild = Backbone.Model.extend({
  url: 'http://test/ModelWithGrandChild',
  sync: mmm.sync('ModelWithGrandChild'),
  rels: {
    child: { type: 'ModelWithChild' }
  }
});
mmm.define('ModelWithGrandChild', ModelWithGrandChild);

exports['hydrate values...'] = {
  'date string as date object': function() {

  },

  'empty date as a 1970\'s date object': function() {

  },

  'regexp string as regexp object': function() {

  },

  'empty regexp as regexp object': function() {

  },

  'hydrate a default value': function() {

  }
};

exports['hydrate associations...'] = {

  before: function() {
    var self = this;
    this.ajaxCalls = [];
    cache._setAjax(fakeAjax({
      posts: [ { id: 1, name: 'Posts1' } ],
      people: [ { id: 1000, name: 'Bar' } ],
      SimpleModel: [ 1, 2, 3 ].map(function(i) {
        return { id: i, name: 'Simple'+i };
      }),
      ModelWithChild: [ 1, 2, 3 ].map(function(i) {
        return { id: i, name: 'Child'+i, child: i };
      }),
      ModelWithGrandChild: [ 1, 2, 3 ].map(function(i) {
        return { id: i, name: 'GrandChild'+i, child: i };
      }),
      FFF: [ { id: 5000, name: 'FFF', child: 6000 }],
      GGG: [ { id: 6000, name: 'GGG', parent: 5000 }]
    }));
  },

  after: function() {
    cache._setAjax(ajax);
  },

  beforeEach: function() {
    this.h = new mmm.hydrate2();
  },

  'deps': {

    'simple': function() {
      assert.deepEqual(
        { SimpleModel: { 1000: true } },
        this.h.getTasks('SimpleModel', { id: 1000 })
      );
    },

    'rel is number or string': function() {
      assert.deepEqual(
        { ModelWithChild: { 1000: true }, SimpleModel: { '100': true } },
        this.h.getTasks('ModelWithChild', { id: 1000, child: 100 })
      );
      assert.deepEqual(
        { ModelWithChild: { 1000: true }, SimpleModel: { 'abcd': true } },
        this.h.getTasks('ModelWithChild', { id: 1000, child: 'abcd' })
      );
    },

    'rel is an array of numbers/strings': function() {
      assert.deepEqual(
        { ModelWithChild: { 1000: true }, SimpleModel: { 'qwe': true, '111': true } },
        this.h.getTasks('ModelWithChild', { id: 1000, child: [ 'qwe', 111 ] })
      );
    },

    'rel is undefined, null or empty string': function() {
      assert.deepEqual(
        { ModelWithChild: { 1000: true } },
        this.h.getTasks('ModelWithChild', { id: 1000 })
      );
      assert.deepEqual(
        { ModelWithChild: { 1000: true } },
        this.h.getTasks('ModelWithChild', { id: 1000, child: undefined })
      );
      assert.deepEqual(
        { ModelWithChild: { 1000: true } },
        this.h.getTasks('ModelWithChild', { id: 1000, child: null })
      );
      assert.deepEqual(
        { ModelWithChild: { 1000: true } },
        this.h.getTasks('ModelWithChild', { id: 1000, child: '' })
      );
    },

    'base model id is undefined, null or empty string': function() {
      assert.deepEqual(
        { },
        this.h.getTasks('SimpleModel', { })
      );
      assert.deepEqual(
        { },
        this.h.getTasks('SimpleModel', { id: undefined })
      );
      assert.deepEqual(
        { },
        this.h.getTasks('SimpleModel', { id: null })
      );
      assert.deepEqual(
        { },
        this.h.getTasks('SimpleModel', { id: '' })
      );
    },

    'rel is a Model instance': function() {
      assert.deepEqual(
        { ModelWithChild: { 1000: true }, SimpleModel: { '123': true } },
        this.h.getTasks('ModelWithChild', { id: 1000, child: new SimpleModel({ id: 123 }) })
      );
    },

    'rel is a Collection of Models': function() {
      assert.deepEqual(
        { ModelWithChild: { 1000: true }, SimpleModel: { '456': true, '789': true } },
        this.h.getTasks('ModelWithChild', {
          id: 1000,
          child: new Backbone.Collection([
            new SimpleModel({ id: 456 }),
            new SimpleModel({ id: '789' })
            ])
        })
      );
    }
  },

  'cannot add a duplicate task to the queue': function() {
    assert.ok(this.h.add('test', 1));
    assert.ok(!this.h.add('test', 1));
  },

  'can fetch and store an item into the interim cache': function() {
    assert.ok(this.h.add('SimpleModel', 1));
    this.h.next(function() {
    });
  },

  'hydrate': {

    'a model with no associations': function(done) {
      mmm.hydrate('Comment', { text: 'foo' }, function(err, comment) {
        assert.ok(comment instanceof Model.Comment);
        assert.equal(comment.get('text'), 'foo');
        done();
      });
    },

    'an array of no-assoc models': function(done) {
      mmm.hydrate('Comment', [ { text: 'foo' }, { text: 'bar' } ], function(err, results) {
        assert.ok(Array.isArray(results));
        assert.ok(results[0] instanceof Model.Comment);
        assert.equal(results[0].get('text'), 'foo');
        assert.ok(results[1] instanceof Model.Comment);
        assert.equal(results[1].get('text'), 'bar');
        done();
      });
    },

    // TODO: test where the data is locally available and cache returns a 404

    'a model with an association': function(done) {
      var self = this;
      mmm.hydrate('Post', {
          id: 1,
          name: 'Foo',
          author: 1000
        }, function(err, val) {
        // console.log(val);
        assert.ok(val instanceof Model.Post);
        // check that the model id is correct
        assert.equal(val.get('id'), 1);
        assert.equal(val.get('name'), 'Foo');
        // and the model contains a child model, author
        assert.ok(val.get('author') instanceof Model.Person);
        assert.equal(val.get('author').get('name'), 'Bar');

        self.postInstance = val;

        done();
      });
    },

    'hydrate(..., id) is interpreted as hydrate(..., { id: id})': function(done) {
      mmm.hydrate('Post', 1, function(err, val) {
        assert.ok(val instanceof Model.Post);
        assert.equal(val.get('id'), 1);
        done();
      });
    },

    'hydrating a empty array should return a collection': function(done) {
      cache.store('Post', { id: 1000 });

      mmm.hydrate('Post', { id: 1000, author: [] }, function(err, val) {
        assert.ok(val instanceof Model.Post);
        assert.equal(val.get('id'), 1000);
        assert.ok(val.get('author') instanceof Backbone.Collection);
        assert.equal(val.get('author').length, 0);
        done();
      });
    },

    'a model with two associations': function(done) {
      var AAA = Backbone.Model.extend({
        sync: mmm.sync('AAA'),
        rels: {
          'first': { type: 'ModelWithChild' },
          'second': { type: 'SimpleModel' }
        }
      });
      mmm.define('AAA', AAA);

      mmm.hydrate('AAA', {
        name: 'AAA',
        first: 1,
        second: 2
      }, function(err, model) {
        assert.equal('AAA', model.get('name'));
        var first = model.get('first');
        assert.ok(first instanceof ModelWithChild);
        assert.equal(1, first.get('id'));
        assert.equal('Child1', first.get('name'));
        var second = model.get('second');
        assert.ok(second instanceof SimpleModel);
        assert.equal(2, second.get('id'));
        assert.equal('Simple2', second.get('name'));
        done();
      });
    },

    'a model with an association that has a child association': function(done) {
      mmm.hydrate('ModelWithGrandChild', {
        name: 'OP',
        child: 1
      }, function(err, model) {
        assert.equal('OP', model.get('name'));
        var current = model.get('child');
        assert.ok(current instanceof ModelWithChild);
        assert.equal(1, current.get('id'));
        assert.equal('Child1', current.get('name'));
        current = current.get('child');
        assert.ok(current instanceof SimpleModel);
        assert.ok(!(current instanceof ModelWithChild));
        assert.equal(1, current.get('id'));
        assert.equal('Simple1', current.get('name'));
        done();
      });
    },

    'a model with a circular association': function(done) {
      var FFF = Backbone.Model.extend({
        url: 'http://test/FFF/',
        sync: mmm.sync('FFF'),
        rels: {
          child: { type: 'GGG' }
        }
      });
      mmm.define('FFF', FFF);
      var GGG = Backbone.Model.extend({
        url: 'http://test/GGG',
        sync: mmm.sync('GGG'),
        rels: {
          parent: { type: 'FFF' }
        }
      });
      mmm.define('GGG', GGG);

      cache.store('GGG', { id: 6000, name: 'GGG', parent: 5000 });

      mmm.hydrate('FFF', { id: 5000, name: 'FFF', child: 6000 }, function(err, model) {
        // console.log(util.inspect(model, null, 30, true));
        assert.equal('FFF', model.get('name'));
        var a = model.get('child');
        assert.equal('GGG', a.get('name'));
        assert.strictEqual(model, model.get('child').get('parent'));
        done();
      });
    },

    'a model with a one to many relationship as a Collection': function(done) {
      cache.store('Post', { id: 200 });
      cache.store('Comment', { id: 100, value: 'C1' });
      cache.store('Comment', { id: 200, value: 'C2' });

      mmm.hydrate('Post', {
          id: 200,
          name: 'Foo',
          comments: [ 100, 200 ]
        }, function(err, val) {
        assert.ok(val instanceof Model.Post);
        assert.equal(val.get('id'), 200);
        assert.equal(val.get('name'), 'Foo');
        var collection = val.get('comments');
        // console.log(collection);
        assert.ok(collection instanceof Backbone.Collection);
        assert.deepEqual(collection.pluck('value'), [ 'C1', 'C2']);
        done();
      });
    },

    'if the model to be hydrated exists in cache, then update and reuse the cached model': function(done) {
      var self = this;
      this.ajaxCalls = [];
      mmm.hydrate('Post', {
          id: 1,
          name: 'New post',
          author: 1000
        }, function(err, val) {
        // assert that no ajax calls were made
        assert.equal(self.ajaxCalls.length, 0);

        // assert that the instance was reused
        assert.strictEqual(val,  self.postInstance);
        // with updated value
        assert.equal(val.get('name'), 'New post');
        // and the rest of the data is like before
        assert.equal(val.get('id'), 1);
        assert.equal(val.get('author').get('name'), 'Bar');

        done();
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
