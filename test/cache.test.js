var assert = require('assert'),
    util = require('util'),
    mmm = require('mmm'),
    Model = require('./lib/models.js');

exports['test cache'] = {

  'can initialize the cache from a json blob': function(done) {
    done();
  },

  'can store() and get() a model': function(done) {
    done();
  },

  'fetching a stored model gets from the cache': function(done) {

  },

  'fetching a model thats not available causes a external fetch': function(done) {

  },

  'storing an existing model causes it to be updated': function(done) {
    done();
  }
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
