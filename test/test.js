var assert = require('assert'),
    util = require('util'),
    http = require('http'),
    mmm = require('mmm'),
    server = require('./lib/test_server.js'),
    Model = require('./lib/model.js');

var Post;

exports['given a simple model'] = {

  before: function(done) {
    http.createServer(function(req, res) {
      server.onRequest(req, res);
    }).listen(8000).on('listening', done);

    mmm.define('Post', Model, {
      href: 'http://localhost:8000/posts/{id}',
      plural: 'posts',
      rels: {
        'author': {
          href: 'http://localhost:8000/people/{author}',
          type: 'Person'
        },
        'comments': {
          href: 'http://localhost:8000/comments/{comments}',
          type: 'Comment'
        }
      }
     });

    mmm.define('Person', Model, {
      href: 'http://localhost:8000/people/{id}',
      plural: 'people'
    });
    mmm.define('Comment', Model, {
      href: 'http://localhost:8000/comments/{id}',
      plural: 'comments'
    });

    Post = {
      find: function(search, onDone) {
        return mmm.find('Post', search, onDone);
      }
    };
  },

  'can find by id': function(done) {
    Post.find(1, function(err, val) {
      console.log(val);
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
//      console.log(util.inspect(val, false, 10, true));
      // check that the model id is correct
      assert.equal(val.get('id'), 1);
      // and the model contains a child model, author
      assert.equal(val.get('author').get('name'), 'Bar');
      done();
    });
  },

  'can hydrate a one-many relationship to a array': function(done) {
    // Post (id = 2) has many comments
    Post.find(2, function(err, val) {
      assert.equal(val.get('id'), 2);
      assert.equal(val.get('comments')[0].get('name'), 'C-1');
      assert.equal(val.get('comments')[1].get('name'), 'C-2');
//      console.log(util.inspect(val, false, 10, true));
      done();
    });
  },

  'will wait properly for a pending request to complete rather than launching multiple requests': function(done) {
    done();
  },

  'can convert a new plain model to a JSON POST': function() {
    // Backbone sync call convention:
    // .sync('create', model, { success: cb, error: cb })
    // .sync('update', model, { success: cb, error: cb })
    // .sync('patch', model, { success: cb, error: cb })
    //
    // Url is either in model.url or passed in as options.url

    // Expect:
    // POST /posts
    // Content-Type: application/json
    // Accept: application/json
    // { posts: [{ ... }] }


  },

  'can convert a plain model attribute change to a JSON PATCH': function() {

    // Expect:
    // PATCH /photos/1
    // Content-Type: application/json-patch+json
    //
    // [
    //  { "op": "replace", "path": "/src", "value": "http://example.com/hamster.png" }
    // ]


  },

  'can convert a new one-one relationship to a JSON PATCH': function() {

    // Expect:
    /*
    PATCH /photos/1
    Content-Type: application/json-patch+json
    Accept: application/json

    [
      { "op": "replace", "path": "/links/author", "value": 2 }
    ]
    */

  },

  'can convert a removal of a one-one relationship to a JSON PATCH': function() {

    /*
    PATCH /photos/1
    Content-Type: application/json-patch+json
    Accept: application/json

    [
      { "op": "remove", "path": "/links/author", "value": 2 }
    ]
    */


  },

  'can add a new one-many relationship to a JSON PATCH': function() {
    /*
    PATCH /photos/1

    [
      { "op": "add", "path": "/links/comments/-", "value": 30 }
    ]
    */

  },

  'can convert a removal of a one-many relationship to a JSON PATCH': function() {
    /*
    PATCH /photos/1

    [
      { "remove": "links/comments/5" }
    ]
    */
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
