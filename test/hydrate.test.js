var assert = require('assert'),
    util = require('util'),
    mg = require('mg'),
    Backbone = require('backbone'),
    Model = require('./lib/models.js'),
    cache = require('../lib/cache.js'),
    ajax = require('../lib/ajax.js'),
    fakeAjax = require('./lib/fake-ajax.js');

// require('minilog').enable();

// Model definitions
var SimpleModel = Backbone.Model.extend({
  urlRoot: 'http://test/SimpleModel'
});
mg.define('SimpleModel', SimpleModel);

var ModelWithChild = Backbone.Model.extend({
  urlRoot: 'http://test/ModelWithChild',
  rels: {
    child: { type: 'SimpleModel' }
  }
});
mg.define('ModelWithChild', ModelWithChild);

var ModelWithGrandChild = Backbone.Model.extend({
  urlRoot: 'http://test/ModelWithGrandChild',
  rels: {
    child: { type: 'ModelWithChild' }
  }
});
mg.define('ModelWithGrandChild', ModelWithGrandChild);

exports['hydrate values...'] = {
  'date string as date object': function() {
    var WithDate = Backbone.Model.extend({
      rels: {
        'date': { type: Date }
      }
    });
    mg.define('WithDate', WithDate);
  },

  'empty date as a 1970\'s date object': function() {

  },

  'regexp string as regexp object': function() {
    var WithRe = Backbone.Model.extend({
      rels: {
        're': { type: RegExp }
      }
    });
    mg.define('WithRe', WithRe);
  },

  'empty regexp as regexp object': function() {

  },

  'hydrate a default value': function() {
    var WithDefault = Backbone.Model.extend({
      rels: {
        'foo': { type: String, default: 'bar' }
      }
    });
    mg.define('WithDefault', WithDefault);

  }
};

exports['hydrate associations...'] = {

  before: function() {
    var self = this;
    this.ajaxCalls = [];
    ajax._setAjax(fakeAjax({
      posts: [
          { __id: 1, name: 'Posts1' },
          { __id: 555, name: 'Posts1' },
          { __id: 223344, name: 'AncientPostFromServer' },
          { __id: 1122 },
      ],
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
    ajax._setAjax(require('../lib/ajax.js')._nodeFetch);
  },

  'hydrate': {

    'a model with no associations': function() {
      var model = new Model.Comment();
      mg.hydrate('Comment', model, { id: 1, text: 'foo' });

      var comment = model;
      assert.ok(comment instanceof Model.Comment);
      assert.equal(comment.get('text'), 'foo');
    },

    'a model with an association': function() {
      var self = this,
          model = new Model.Post();

      mg.hydrate('Post', model, {
          __id: 1,
          name: 'Foo',
          author: {
            id: 1000,
            name: 'Bar'
          }
        });

      var val = model;

      assert.ok(val instanceof Model.Post);
      // check that the model id is correct
      assert.equal(val.get('__id'), 1);
      assert.equal(val.get('name'), 'Foo');
      // and the model contains a child model, author
      assert.ok(val.get('author') instanceof Model.Person);
      assert.equal(val.get('author').get('name'), 'Bar');

      self.postInstance = val;
    },

    'hydrating a empty array should return a collection': function() {
      cache.store('Post', { __id: 1000 });

      var val = mg.hydrate('Post', new Model.Post(), { __id: 1000, author: [] });
      assert.ok(val instanceof Model.Post);
      assert.equal(val.get('__id'), 1000);
      assert.ok(val.get('author') instanceof Backbone.Collection);
      assert.equal(val.get('author').length, 0);
    },

    'a model with two associations': function() {
      var AAA = Backbone.Model.extend({
        rels: {
          'first': { type: 'ModelWithChild' },
          'second': { type: 'SimpleModel' }
        }
      });
      mg.define('AAA', AAA);

      var model = mg.hydrate('AAA', new AAA(), {
        id: 11,
        name: 'AAA',
        first: { id: 1, name: 'Child1' },
        second: { id: 2, name: 'Simple2' }
      });

      assert.equal('AAA', model.get('name'));
      var first = model.get('first');
      assert.ok(first instanceof ModelWithChild);
      assert.equal(1, first.get('id'));
      assert.equal('Child1', first.get('name'));
      var second = model.get('second');
      assert.ok(second instanceof SimpleModel);
      assert.equal(2, second.get('id'));
      assert.equal('Simple2', second.get('name'));
    },

    /* depth-2 is not supported
    'a model with an association that has a child association': function() {
      var model = mg.hydrate('ModelWithGrandChild', new ModelWithGrandChild(), {
        id: 111,
        name: 'OP',
        child: {
          id: 1,
          name: 'Child1',
          child: {
            id: 1,
            name: 'Simple1'
          }
        }
      });

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
    },
    */

    'a model with a circular association': function() {
      var FFF = Backbone.Model.extend({
        urlRoot: 'http://test/FFF/',
        rels: {
          child: { type: 'GGG' }
        }
      });
      mg.define('FFF', FFF);
      var GGG = Backbone.Model.extend({
        urlRoot: 'http://test/GGG',
        rels: {
          parent: { type: 'FFF' }
        }
      });
      mg.define('GGG', GGG);

      mg.hydrate('GGG', new GGG(), { id: 6000, name: 'GGG', parent: { id: 5000 } });

      var model = mg.hydrate('FFF', new FFF(), { id: 5000, name: 'FFF', child: { id: 6000 } });
      // console.log(util.inspect(model, null, 30, true));
      assert.equal('FFF', model.get('name'));
      var a = model.get('child');
      assert.equal('GGG', a.get('name'));
      assert.strictEqual(model, model.get('child').get('parent'));
    },

    'a model with a one to many relationship as a Collection': function() {
      mg.hydrate('Comment', new Model.Comment(), { id: 100, value: 'C1' });
      mg.hydrate('Comment', new Model.Comment(), { id: 200, value: 'C2' });

      var val = mg.hydrate('Post', new Model.Post(), {
          __id: 200,
          name: 'Foo',
          comments: [ { id: 100 }, { id: 200 } ]
        });
      assert.ok(val instanceof Model.Post);
      assert.equal(val.get('__id'), 200);
      assert.equal(val.get('name'), 'Foo');
      var collection = val.get('comments');
      // console.log(util.inspect(collection, null, 30, true));
      assert.ok(collection instanceof Backbone.Collection);
      assert.deepEqual(collection.pluck('value'), [ 'C1', 'C2']);
    },

    'if the model to be hydrated exists in cache, then update and reuse the cached model': function() {
      var self = this;

      var postInstance = mg.hydrate('Post', new Model.Post(), { __id: 223344, name: 'Ancient post' });

      assert.ok(cache.local('Post', 223344));

      var val = mg.hydrate('Post', new Model.Post(), {
            __id: 223344,
            name: 'New post',
            author: {
              id: 124,
              name: 'Bar'
            }
          });

      // assert that the instance was reused
      assert.notStrictEqual(val, postInstance);

      // with updated value
      assert.equal(val.get('name'), 'New post');
      // and the rest of the data is like before
      assert.equal(val.get('__id'), 223344);
      assert.equal(val.get('author').get('name'), 'Bar');
      // with updated value
      assert.equal(postInstance.get('name'), 'New post');
      // and the rest of the data is like before
      assert.equal(postInstance.get('__id'), 223344);
      assert.equal(postInstance.get('author').get('name'), 'Bar');
    },

    /*
    // Cache precedence:
    // 1) top priority: any values passed directly to Hydrate
    // 2) second priority: any values from the server
    // 3) any values in the cache from a previous hydrate
    'cache precedence': function(done) {
      // start by writing a value into the cache
      mg.hydrate('Post', {
        __id: 1122,
        value1: 'second',
        value2: 'second'
      }, function(err, first) {

        // instantiate another model by force because
        // the issue arises when the input cache and the global cache disagree
        // on what the canonical model instance is
        var model = new Model.Post({ __id: 1122, value1: 'last' });
        mg.hydrate('Post', model, function(err, instance) {
          // when a disagreement occurs, the global model should always win
          assert.strictEqual(instance, first);
          // the input from the disagreeing model should be taken into account
          assert.equal(instance.get('value1'), 'last');
          assert.equal(instance.get('value2'), 'second');
          // when a disagreement occurs, the disagreeing model should also be updated
          assert.equal(model.get('value1'), 'last');
          assert.equal(model.get('value2'), 'second');

          done();
        });
      });
    },


    // for newly created models, we have an instance of the model already,
    // and the purpose of hydration is to assign an id and to hydrate any new dependent properties
    // E.g. send { name: 'foo' } -> receive { id: 2, name: 'foo', child: 1000 }
    // and the result needs to be translated into a set of properties to set on the
    // already-instantiated model (which also needs to be cached after the set has occurred)

    'if the data is a model instance, use it rather than creating a new instance, from cache': function(done) {
      mg.hydrate('Post', { __id: 1 } , function(err, instance) {
        instance.set('Foo', 'bar');
        mg.hydrate('Post', instance, function(err, val) {
          assert.strictEqual(instance, val);
          assert.equal(val.get('Foo'), 'bar');
          done();
        });
      });
    },

    'if the data is a model instance, use it rather than creating a new instance, external': function(done) {
      var instance = new Model.Post();
      instance.set('Foo', 'bar');
      instance.set('author', 1000);
      mg.hydrate('Post', instance, function(err, val) {
        assert.ok(instance === val);
        assert.equal(val.get('Foo'), 'bar');
        assert.equal(val.get('author').get('name'), 'Bar');
        done();
      });
    },

    'if the data is a model instance, use it rather than creating a new instance, external, with id': function(done) {
      require('minilog').enable();
      var instance = new Model.Post();
      // adding an ID tempts the hydration layer to fetch it
      // this happens for real when saving -> success -> hydrate -> (parse) -> return
      instance.set('__id', 555);
      instance.set('Foo', 'bar');
      instance.set('author', 1000);
      assert.ok(instance instanceof Model.Post);
      mg.hydrate('Post', instance, function(err, val) {
        assert.ok(val instanceof Model.Post);

        // Change in behavior: always reuse the model from the global cache,
        // even if some external operation has created a duplicate
        // assert.notStrictEqual(instance, val);

        // Both the returned global instance and the
        // duplicate instance should have the most recent (hydrated)
        // information
        assert.equal(val.get('Foo'), 'bar');
        assert.equal(val.get('author').get('name'), 'Bar');
        assert.equal(instance.get('Foo'), 'bar');
//        assert.equal(instance.get('author').get('name'), 'Bar');
        done();
      });
    }
  */
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
