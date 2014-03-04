var assert = require('assert'),
    util = require('util'),
    mg = require('mg'),
    Post = require('./lib/models.js').Post,
    Comment = require('./lib/models.js').Comment,
    Person = require('./lib/models.js').Person,
    Posts = require('./lib/models.js').Posts,
    Backbone = require('backbone'),
    Collection = Backbone.Collection;

require('minilog').enable();

// since shimming jQuery's promises-based ajax API is not directly supported by jQuery,
// probably for some good reason, simply fake the fetch requests

exports['given two subscriptions to a model by id'] = {

  before: function() {
    Post.prototype.fetch = function() {
      return {
        done: function(fn) {
          return fn({
            __id: 1,
            name: 'post1',
            comments: [
              { id: 5, text: 'comment5' }
            ]
          });
        }
      };
    };
  },

  'model.fetch with rels': function(done) {
    var post = new Post({ __id: 1}),
        op = post;

    post.fetch({ data: { rels: 'Comment' } }).done(function(data) {
      // console.log(data);
      mg.hydrate('Post', post, data);

      // post should be an instance of Post
      assert.ok(post instanceof Post);
      assert.strictEqual(post, op);
      assert.equal(post.get('name'), 'post1');
      // should have comments
      assert.ok(post.get('comments'));
      // comments should be an instance of collection
      assert.ok(post.get('comments') instanceof Collection);
      // comments should be instances of Comment
      assert.ok(post.get('comments').at(0) instanceof Comment);
      assert.equal(post.get('comments').at(0).get('text'), 'comment5');
      done();
    });
  },

  'model.fetch with multiple items': function() {
    var self = this;

    var post = new Post({ __id: 2}),
        data = {
            __id: 2,
            name: 'post2',
            author: {
              id: 100,
              name: 'author100'
            },
            comments: [
              { id: 1, text: 'comment1' },
              { id: 2, text: 'comment2' }
            ]
          };

    // console.log(data);
    mg.hydrate('Post', post, data);

    // post should be an instance of Post
    assert.ok(post instanceof Post);
    assert.equal(post.get('name'), 'post2');
    // should have author
    assert.ok(post.get('author'));
    assert.ok(post.get('author') instanceof Person);
    // should have comments
    assert.ok(post.get('comments'));
    // comments should be an instance of collection
    assert.ok(post.get('comments') instanceof Collection);
    // comments should be instances of Comment
    assert.ok(post.get('comments').at(0) instanceof Comment);
    assert.equal(post.get('comments').at(0).get('text'), 'comment1');
    assert.ok(post.get('comments').at(1) instanceof Comment);
    assert.equal(post.get('comments').at(1).get('text'), 'comment2');
  },

  'findById with rels': function(done) {
    mg.findById('Post', 1, { rels: 'Comment' }, function(err, post) {
      // post should be an instance of Post
      assert.ok(post instanceof Post);
      assert.equal(post.get('name'), 'post1');
      // should have comments
      assert.ok(post.get('comments'));
      // comments should be an instance of collection
      assert.ok(post.get('comments') instanceof Collection);
      // comments should be instances of Comment
      assert.ok(post.get('comments').at(0) instanceof Comment);
      assert.equal(post.get('comments').at(0).get('text'), 'comment5');
      done();
    });
  },

  'collection': {

    beforeEach: function() {
      Posts.prototype.fetch = function() {
        return {
          done: function(fn) {
            return fn([{
              __id: 4,
              name: 'post4',
              comments: [
                { id: 7, text: 'comment7' }
              ]
            },
            {
              __id: 3,
              name: 'post3',
              comments: [ ]
            }]);
          }
        };
      };
    },

    'collection.fetch with rels': function(done) {
      var collection = new Posts();
      // call collection.fetch
      collection.fetch().done(function(data) {
        // apply hydration
        mg.hydrate('Post', collection, data);
        assert.ok(collection instanceof Collection);
        assert.equal(collection.length, 2);
        assert.ok(collection.at(0) instanceof Post);
        assert.equal(collection.at(0).get('name'), 'post4');
        assert.ok(collection.at(0).get('comments') instanceof Collection);
        assert.ok(collection.at(0).get('comments').at(0) instanceof Comment);
        assert.equal(collection.at(0).get('comments').at(0).get('text'), 'comment7');
        assert.ok(collection.at(1) instanceof Post);
        assert.equal(collection.at(1).get('name'), 'post3');
        assert.ok(collection.at(1).get('comments') instanceof Collection);
        assert.equal(collection.at(1).get('comments').length, 0);
        done();
      });
    },

    'mg.collection with rels': function(done) {
      mg.stream('Post', { rels: 'Comment' }, function(err, collection) {
        assert.ok(collection instanceof Collection);
        assert.equal(collection.length, 2);
        assert.ok(collection.at(0) instanceof Post);
        assert.equal(collection.at(0).get('name'), 'post4');
        assert.ok(collection.at(0).get('comments') instanceof Collection);
        assert.ok(collection.at(0).get('comments').at(0) instanceof Comment);
        assert.equal(collection.at(0).get('comments').at(0).get('text'), 'comment7');
        assert.ok(collection.at(1) instanceof Post);
        assert.equal(collection.at(1).get('name'), 'post3');
        assert.ok(collection.at(1).get('comments') instanceof Collection);
        assert.equal(collection.at(1).get('comments').length, 0);
        done();
      });
    },

  },

/*
  'model.link': function(done) {
    post.link(comments, function() {
      // should cause ajax
      // should add collection / single model
    });
  },

  'model.unlink': function(done) {
    post.link(comments, function() {
      // should cause ajax
      // should remove collection / single model
      // should invalidate fetched
    });
  }
*/
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
