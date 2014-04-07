var assert = require('assert'),
    util = require('util'),
    mg = require('mg'),
    Model = require('./lib/models.js'),
    cache = require('../lib/cache.js'),
    ajax = require('../lib/ajax.js'),
    meta = require('../lib/meta.js'),
    Backbone = require('backbone');

// require('minilog').enable();

exports['test cache'] = {

  before: function() {
    mg.define('test', Backbone.Model.extend({
      type: 'test',
      urlRoot: 'http://localhost:7000/test/'
    }));
  },

  after: function() {
    ajax._setAjax(require('../lib/ajax.js')._nodeFetch);
  },

  'can get the url': function() {
    // example 1: when urlRoot is set
    mg.define('url1', Backbone.Model.extend({
      sync: mg.sync('url1'),
      type: 'url1',
      urlRoot: 'http://localhost:7000/url1/'
    }));
    assert.equal(meta.uri('url1', 1000), 'http://localhost:7000/url1/1000');
    // example 2: when url is a function
    mg.define('url2', Backbone.Model.extend({
      sync: mg.sync('url2'),
      type: 'url2',
      url: function() {
        return 'http://localhost:7000/url2/' + encodeURIComponent(this.id) + '?exclude=foo';
      }
    }));
    assert.equal(meta.uri('url2', 2000), 'http://localhost:7000/url2/2000?exclude=foo');
  },

  'can initialize the cache from a json blob and local() an initialized value': function() {
    var values = [
      { id: 100, name: 'a' },
      { id: 200, name: 'b' }
    ], result;
    cache.store('test', values);

    result = cache.local('test', 100);
    assert.strictEqual(values[0], result);
    result = cache.local('test', 200);
    assert.strictEqual(values[1], result);
  },

  'can store() and local() a model': function() {
    var item = { id: 300, name: 'foo' },
        result;
    cache.store('test', item);
    result = cache.local('test', 300);
    assert.strictEqual(item, result);
  },

  'storing an existing model causes it to be updated': function() {
    var item = { id: 7000, name: 'foo' },
        result;
    cache.store('test', item);
    cache.store('test', { id: 7000, name: 'bar' });
    result = cache.local('test', 7000);
    assert.strictEqual(item, result);
    assert.equal(result.name, 'bar');
  },

  'can cache an model with a different idAttribute': function() {
    var item = { __id: 7000, name: 'foo' },
        result;
    mg.define('AttrTest', Backbone.Model.extend({
      sync: mg.sync('AttrTest'),
      type: 'AttrTest',
      idAttribute: '__id',
      url: 'http://'
    }));
    cache.store('AttrTest', item);
    result = cache.local('AttrTest', 7000);
    assert.strictEqual(item, result);
    assert.equal(result.name, 'foo');
    assert.equal(result.__id, 7000);
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
