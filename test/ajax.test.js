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

  'fetching a url causes a external fetch': function(done) {
    ajax._setAjax(function(uri, method, onDone) {
      assert.equal('http://localhost:7000/test/9000', uri);
      onDone(null, { id: 7000});
      done();
    });

    ajax('http://localhost:7000/test/9000', function() { });
  },

  'if the external fetch is still pending, do not queue a second external fetch': function(done) {
    var calls = 0,
        resultCalls = 0;
    ajax._setAjax(function(uri, method, onDone) {
      calls++;
      if(calls == 1) {
        setTimeout(function() {
          onDone(null, { id: 7000, name: 'ok' });
        }, 10);
      } else {
        assert.ok(false, 'Should not be called twice since still pending');
      }
    });
    function results(err, value) {
      resultCalls++;
      if(resultCalls == 2) {
        assert.equal(resultCalls, 2);
        assert.equal(err, null);
        assert.equal(value.name, 'ok');
        done();
      }
    }
    ajax('http://localhost:7000/test/7000', results);
    ajax('http://localhost:7000/test/7000', results);
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
