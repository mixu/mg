var assert = require('assert'),
    util = require('util'),
    mg = require('mg'),
    Backbone = require('backbone'),
    getTasksCore = require('../../lib/hydrate/get-tasks.js');

function getTasks(name, model) {
  var result = {};
  getTasksCore(name, model, function(childClass, cId, parentClass, pId) {
    if(!result[childClass]) {
      result[childClass] = {};
    }
    result[childClass][cId] = true;
  });
  return result;
}

var SimpleModel, ModelWithChild;

exports['get tasks test'] = {

  before: function() {
    // Model definitions
    SimpleModel = Backbone.Model.extend({
      urlRoot: 'http://test/SimpleModel',
      sync: mg.sync('SimpleModel')
    });
    mg.define('SimpleModel', SimpleModel);

    ModelWithChild = Backbone.Model.extend({
      urlRoot: 'http://test/ModelWithChild',
      sync: mg.sync('ModelWithChild'),
      rels: {
        child: { type: 'SimpleModel' }
      }
    });
    mg.define('ModelWithChild', ModelWithChild);

  },

  'simple': function() {
    assert.deepEqual(
      { SimpleModel: { 1000: true } },
      getTasks('SimpleModel', { id: 1000 })
    );
  },

  'rel is number or string': function() {
    assert.deepEqual(
      { ModelWithChild: { 1000: true }, SimpleModel: { '100': true } },
      getTasks('ModelWithChild', { id: 1000, child: 100 })
    );
    assert.deepEqual(
      { ModelWithChild: { 1000: true }, SimpleModel: { 'abcd': true } },
      getTasks('ModelWithChild', { id: 1000, child: 'abcd' })
    );
  },

  'rel is an array of numbers/strings': function() {
    assert.deepEqual(
      { ModelWithChild: { 1000: true }, SimpleModel: { 'qwe': true, '111': true } },
      getTasks('ModelWithChild', { id: 1000, child: [ 'qwe', 111 ] })
    );
  },

  'rel is undefined, null or empty string': function() {
    assert.deepEqual(
      { ModelWithChild: { 1000: true } },
      getTasks('ModelWithChild', { id: 1000 })
    );
    assert.deepEqual(
      { ModelWithChild: { 1000: true } },
      getTasks('ModelWithChild', { id: 1000, child: undefined })
    );
    assert.deepEqual(
      { ModelWithChild: { 1000: true } },
      getTasks('ModelWithChild', { id: 1000, child: null })
    );
    assert.deepEqual(
      { ModelWithChild: { 1000: true } },
      getTasks('ModelWithChild', { id: 1000, child: '' })
    );
  },

  'base model id is undefined, null or empty string': function() {
    assert.deepEqual(
      { },
      getTasks('SimpleModel', { })
    );
    assert.deepEqual(
      { },
      getTasks('SimpleModel', { id: undefined })
    );
    assert.deepEqual(
      { },
      getTasks('SimpleModel', { id: null })
    );
    assert.deepEqual(
      { },
      getTasks('SimpleModel', { id: '' })
    );
  },

  'rel is a Model instance': function() {
    assert.deepEqual(
      { ModelWithChild: { 1000: true }, SimpleModel: { '123': true } },
      getTasks('ModelWithChild', { id: 1000, child: new SimpleModel({ id: 123 }) })
    );
  },

  'rel is a Collection of Models': function() {
    assert.deepEqual(
      { ModelWithChild: { 1000: true }, SimpleModel: { '456': true, '789': true } },
      getTasks('ModelWithChild', {
        id: 1000,
        child: new Backbone.Collection([
          new SimpleModel({ id: 456 }),
          new SimpleModel({ id: '789' })
          ])
      })
    );
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
