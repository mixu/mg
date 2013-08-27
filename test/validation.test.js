var assert = require('assert'),
    util = require('util'),
    mg = require('mg'),
    Backbone = require('backbone'),
    Model = require('./lib/models.js'),
    cache = require('../lib/cache.js'),
    ajax = require('../lib/ajax.js'),
    fakeAjax = require('./lib/fake-ajax.js');

return;

var Foo = function() {};
Foo.prototype.validate = function() {
  return null;
};
var ValidatorError = null;

exports['validation'] = {

  'invalid arguments are rejected': function() {
    mg.define('Foo', { rels: { bar: { type: String, validation: 'nope' } }});
    mg.define('Foo', { rels: { bar: { type: String, validation: [ 'nope' ] } }});
  },

  'string - required': function() {
    mg.define('Foo', { rels: { bar: { type: String, required: true } }});
    assert.ok(new Foo({ id: 1, bar: null }).validate() instanceof ValidatorError);
    assert.ok(new Foo({ id: 1, bar: undefined }).validate() instanceof ValidatorError);
    assert.ok(new Foo({ id: 1, bar: '' }).validate() instanceof ValidatorError);
    assert.ok(!(new Foo({ id: 1, bar: 'bar' }).validate() instanceof ValidatorError));
  },

  'string - enum': function() {
    mg.define('Foo', { rels: { bar: { type: String, enum: ['a', 'b', undefined, 'c', null] } }});

    ['d', true, 10, {}].forEach(function(value) {
      assert.ok(new Foo({ bar: value }).validate() instanceof ValidatorError);
    });
  },

  'string - regexp': function() {
    mg.define('Foo', { rels: { bar: { type: String, match: /[a-z]/ } }});
    assert.equal(1, Foo.validators.length);
    assert.ok(new Foo({ bar: 'az' }).validate());
    assert.ok(new Foo({ bar: 'aZ' }).validate() instanceof ValidatorError);
  },

  'number - min max': function() {
    mg.define('Foo', { rels: { bar: { type: Number, max: 15, min: 5 } }});

    assert.ok(new Foo({ bar: 10 }).validate());

    assert.ok(new Foo({ bar: 100 }).validate(function(err){
        assert.ok(err instanceof ValidatorError);
        assert.equal('bar', err.path);
        assert.equal('max', err.type);
        assert.equal(100, err.value);
    }));
    assert.ok(new Foo({ bar: 1 }).validate() instanceof ValidatorError);
    // null is allowed
    assert.ok(new Foo({ bar: null }).validate());
  },

  'number - required': function() {
    mg.define('Foo', { rels: { bar: { type: Number, required: true } }});
    assert.ok(new Foo({ id: 1, bar: null }).validate() instanceof ValidatorError);
    assert.ok(new Foo({ id: 1, bar: undefined }).validate() instanceof ValidatorError);
    assert.ok(new Foo({ id: 1, bar: '' }).validate() instanceof ValidatorError);
    assert.ok(!(new Foo({ id: 1, bar: 0 }).validate() instanceof ValidatorError));
    assert.ok(!(new Foo({ id: 1, bar: 1 }).validate() instanceof ValidatorError));

  },

  'date - required': function() {
    mg.define('Foo', { rels: { bar: { type: Date, required: true } }});
    assert.ok(new Foo({ id: 1, bar: null }).validate() instanceof ValidatorError);
    assert.ok(new Foo({ id: 1, bar: undefined }).validate() instanceof ValidatorError);
    assert.ok(new Foo({ id: 1, bar: new Date() }).validate());
  },

  'boolean - required': function() {
    mg.define('Foo', { rels: { bar: { type: Date, required: true } }});
    assert.ok(new Foo({ id: 1, bar: null }).validate() instanceof ValidatorError);
    assert.ok(new Foo({ id: 1, bar: undefined }).validate() instanceof ValidatorError);
    assert.ok(new Foo({ id: 1, bar: false }).validate());
  },

  'class - required': function() {
    // single model
    // single id
    // collection of models
    // array of ids
  },

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
