var assert = require('assert'),
    util = require('util'),
    mmm = require('mmm'),
    Model = require('./lib/models.js'),
    cache = require('../lib/cache.js'),
    ajax = require('../lib/ajax.js');

require('minilog').enable();

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
    cache._setAjax(function(uri, callback) {
      self.ajaxCalls.push([uri]);
      if(uri == 'http://localhost:8721/people/1000') {
        callback(null, {
          id: 1000,
          name: 'Bar'
        });
      }
    });
  },

  after: function() {
    cache._setAjax(ajax);
  },

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

  'a model with an association': function(done) {
    var self = this;
    mmm.hydrate('Post', {
        id: 1,
        name: 'Foo',
        author: 1000
      }, function(err, val) {
      // check that the model id is correct
      assert.equal(val.get('id'), 1);
      // and the model contains a child model, author
      assert.equal(val.get('author').get('name'), 'Bar');

      self.postInstance = val;

      done();
    });
  },

  'a model with two associations': function() {

  },

  'a model with an association that has a child association': function() {

  },

  'a model with a circular association': function() {

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
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
