var assert = require('assert'),
    util = require('util'),
    mmm = require('mmm'),
    Model = require('./lib/models.js'),
    cache = require('../lib/cache.js'),
    Backbone = require('backbone');

require('minilog').enable();

exports['test cache'] = {

  'can initialize the cache from a json blob and get() an initialized value': function(done) {
    var values = [
      { id: 100, name: 'a' },
      { id: 200, name: 'b' }
    ];
    cache.store('test', values);

    cache.get('test', 100, function(err, result) {
      assert.strictEqual(values[0], result);
      cache.get('test', 200, function(err, result) {
        assert.strictEqual(values[1], result);
        done();
      });
    });
  },

  'can store() and get() a model': function(done) {
    var item = { id: 300, name: 'foo' };
    cache.store('test', item);
    cache.get('test', 300, function(err, result) {
      assert.strictEqual(item, result);
      done();
    });
  },

  'fetching a model thats not available causes a external fetch': function(done) {
    var ajax = require('../lib/ajax.js');
    var test = Backbone.Model.extend({
      sync: mmm.sync('test'), // really only needed for writing
      url: 'http://localhost:7000/test/'
    });
    mmm.define('test', test);

    cache._setAjax(function(uri, onDone) {
      assert.equal('http://localhost:7000/test/9000', uri);
      cache._setAjax(ajax);
      done();
    });
    cache.get('test', 9000);
  },

  'if the external fetch is still pending, do not queue a second external fetch': function() {
    assert.ok(false);
  },

  'storing an existing model causes it to be updated': function(done) {
    var item = { id: 7000, name: 'foo' };
    cache.store('test', item);
    cache.store('test', { id: 7000, name: 'bar' });
    cache.get('test', 7000, function(err, result) {
      assert.strictEqual(item, result);
      assert.equal(result.name, 'bar');
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
