var assert = require('assert'),
    util = require('util'),
    mmm = require('mmm'),
    Model = require('./lib/models.js');

require('minilog').enable();

exports['test hydration'] = {

  'can hydrate a simple model': function(done) {
    mmm.hydrate('Comment', { text: 'foo' }, function(err, comment) {
      assert.ok(comment instanceof Model.Comment);
      assert.equal(comment.get('text'), 'foo');
      done();
    });
  },

  'can hydrate an array of simple models': function(done) {
    mmm.hydrate('Comment', [ { text: 'foo' }, { text: 'bar' } ], function(err, results) {
      assert.ok(Array.isArray(results));
      assert.ok(results[0] instanceof Model.Comment);
      assert.equal(results[0].get('text'), 'foo');
      assert.ok(results[1] instanceof Model.Comment);
      assert.equal(results[1].get('text'), 'bar');
      done();
    });
  },

  //'if the model to be hydrated exists in cache, then update and reuse the cached model': function(done)

  //'if the hydration is passed an instance of a model and new data ...'

  // Post has a rel to author and comment

  //'can hydrate a model with a association':

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
