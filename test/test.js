var assert = require('assert'),
    mmm = require('mmm'),
    Model = require('./lib/model.js'),
    util = require('util');

var Post;

exports['given a simple model'] = {

  before: function() {

    mmm.fetch = function(uri, callback) {
      console.log('fetch', uri);
      if(uri == 'http://localhost/posts/1') {
        callback(undefined, new Model({
          id: 1,
          name: 'Foo',
          author: 1000
        }));
      }
      if(uri == 'http://localhost/posts/2') {
        callback(undefined, new Model({
          id: 1,
          name: 'Foo',
          author: 1000,
          comments: [ 1, 2 ]
        }));
      }
      if(uri == 'http://localhost/people/1000') {
        return callback(undefined, new Model({
          id: 1000,
          name: 'Bar'
        }));
      }
      if(uri == 'http://localhost/comments/1') {
        return callback(undefined, new Model({
          id: 1,
          name: 'C-1'
        }));
      }
      if(uri == 'http://localhost/comments/2') {
        return callback(undefined, new Model({
          id: 2,
          name: 'C-2'
        }));
      }
    };

    mmm.define('Post', Model, {
      href: 'http://localhost/posts/{id}',
      rels: {
        'author': {
          href: 'http://localhost/people/{author}',
          type: 'Person'
        },
        'comments': {
          href: 'http://localhost/comments/{comments}',
          type: 'Comment'
        }
      }
     });

    mmm.define('Person', Model, { href: 'http://localhost/people/{id}' });
    mmm.define('Comment', Model, { href: 'http://localhost/comments/{id}' });

    Post = {
      find: function(search, onDone) {
        return mmm.find('Post', search, onDone);
      }
    };
  },

  'can find by id': function(done) {
    Post.find(1, function(err, val) {
      assert.equal(val.get('id'), 1);
      done();
    });
  },

  'multiple find calls return same instance': function(done) {
    Post.find(1, function(err, val) {
      Post.find(1, function(err, val2) {
        assert.equal(val.get('id'), 1);
        assert.strictEqual(val, val2);
        done();
      });
    });
  },

  'can hydrate a one-one relationship': function(done) {
    Post.find(1, function(err, val) {
      console.log(util.inspect(val, false, 10, true));
      // check that the model id is correct
      assert.equal(val.get('id'), 1);
      // and the model contains a child model, author
      assert.equal(val.get('author').get('name'), 'Bar');
      done();
    });
  },

  'can hydrate a one-many relationship to a collection': function(done) {
    // Post (id = 2) has many comments
    Post.find(2, function(err, val) {
      console.log(util.inspect(val, false, 10, true));
      done();
    });
  },

  'will wait properly for a pending request to complete rather than launching multiple requests': function(done) {
    done();
  },

  'can convert a new plain model to a JSON POST': function() {

  },

  'can convert a plain model attribute change to a JSON PATCH': function() {

  },

  'can convert a new one-one relationship to a JSON PATCH': function() {

  },

  'can convert a removal of a one-one relationship to a JSON PATCH': function() {

  },

  'can convert a new one-many relationship to a JSON PATCH': function() {

  },

  'can convert a removal of a one-many relationship to a JSON PATCH': function() {

  },

  'can initialize the cache from a JSON-API structure': function(done) {
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
