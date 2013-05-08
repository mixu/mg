var assert = require('assert'),
    mmm = require('mmm'),
    Model = require('./lib/model.js');

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
      if(uri == 'http://localhost/people/1000') {
        return callback(undefined, new Model({
          id: 1000,
          name: 'Bar'
        }));
      }

    };

    mmm.define('Post', Model, {
      href: 'http://localhost/posts/{id}',
      rels: {
        'author': {
          href: 'http://localhost/people/{author}',
          type: 'People'
        }
      }
     });

    mmm.define('People', Model, { href: 'http://localhost/people/{id}' });

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

  'can get one related model': function(done) {
    Post.find(1, function(err, val) {
      console.log(val);
      assert.equal(val.get('id'), 1);
      assert.equal(val.get('author').get('name'), 'Bar');
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
