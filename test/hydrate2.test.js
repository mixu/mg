var assert = require('assert'),
    util = require('util'),
    mmm = require('mmm'),
    Backbone = require('backbone'),
    Model = require('./lib/models.js'),
    cache = require('../lib/cache.js'),
    ajax = require('../lib/ajax.js'),
    fakeAjax = require('./lib/fake-ajax.js');

// require('minilog').enable();

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

exports['hydrate associations...'] = {

  before: function() {
    var self = this;
    this.ajaxCalls = [];
    cache._setAjax(fakeAjax({
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

  'deps': {

    beforeEach: function() {
      this.h = new mmm.hydrate2();
    },

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

  },

  'can fetch and store an item into the interim cache': function() {

  },

  'given the interim cache, can link the items together': function() {

  },

  'when the run queue is empty and all tasks have finished, the next task is link and return': function() {

  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
