var assert = require('assert'),
    util = require('util'),
    http = require('http'),
    mmm = require('mmm'),
    server = require('./lib/test_server.js'),
    Model = require('./lib/model.js');

var Post;

exports['given two subscriptions to a model by id'] = {

  before: function(done) {
    var self = this;
    http.createServer(function(req, res) {
      server.onRequest(req, res);
    }).listen(8000).on('listening', function() {

      // create direct subscription
      Post.find(1, function(err, val) {
        if (err) throw err;
        self.model = val;
        // create wildcard subscription on all models of a type
        // => collection subscriptions are filtered versions of this

        // self.collection = Post.allAsCollection();
        done();
      });
    });

    mmm.define('Post', {
      Model: Model,
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

    mmm.define('Person', {
      Model: Model,
      href: 'http://localhost:8000/people/{id}',
      plural: 'people'
    });
    mmm.define('Comment', {
      Model: Model,
      href: 'http://localhost:8000/comments/{id}',
      plural: 'comments'
    });

    Post = {
      find: function(search, onDone) {
        return mmm.find('Post', search, onDone);
      },
      allAsCollection: function(onDone) {
        return mmm.allAsCollection('Post');
      }
    };
  },

  'direct subscription can get notified of an update': function(done) {
    var self = this;
    self.model.once('change:name', function(model, value, options) {
      console.log('change name to', value);
      done();
    });

    Post.find(1, function(err, val) {
      val.set('name', 'Foo');
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
