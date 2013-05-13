var assert = require('assert'),
    mmm = require('mmm'),
    http = require('http'),
    Server = require('../server.js');

var server = new Server();

function request(opts, onDone) {
  opts.hostname = 'localhost';
  opts.port = 8000;
  http.request(opts, function(res) {
      var body = '';
      res.on('data', function(chunk) {
        body += chunk;
      });
      res.on('end', function() {
        if(res.headers['content-type'] == 'application/json') {
          try {
            onDone(undefined, JSON.parse(body));
            return;
          } catch(e) {
            throw e;
          }
        }
        onDone(undefined, body);
      });
    }).end();
}

server.add({
  people: [{
    id: 1000,
    name: 'Bar'
  }],
  comments: [
    {
      id: 1,
      name: 'C-1'
    },
    {
      id: 2,
      name: 'C-2'
    }
  ]
});

exports['reading items'] = {

  before: function(done) {
    http.createServer(function(req, res) {
      server.onRequest(req, res);
    }).listen(8000).on('listening', done);
  },

  'can read /item/:id': function(done) {
    request({
      path: '/people/1000',
      method: 'GET'
    }, function(err, data) {
      console.log(data);
      // expect { people: [ { .. model .. } ] }
      assert.ok(data.people);
      assert.ok(Array.isArray(data.people));
      assert.ok(data.people.length, 1);
      assert.equal(data.people[0].id, 1000);
      done();
    });
  },

  'can read /item?ids=:id1,:id2': function(done) {
    request({
      path: '/comments?ids=1,2',
      method: 'GET'
    }, function(err, data) {
      console.log(data);
      // expect { comments: [ { .. model .. } ] }
      assert.ok(data.comments);
      assert.ok(Array.isArray(data.comments));
      assert.ok(data.comments.length, 2);
      assert.equal(data.comments[0].id, 1);
      assert.equal(data.comments[1].id, 2);
      done();
    });
  },

  'can read /item/:id1,:id2': function(done) {
    request({
      path: '/comments/1,2',
      method: 'GET'
    }, function(err, data) {
      console.log(data);
      // expect { comments: [ { .. model .. } ] }
      assert.ok(data.comments);
      assert.ok(Array.isArray(data.comments));
      assert.ok(data.comments.length, 2);
      assert.equal(data.comments[0].id, 1);
      assert.equal(data.comments[1].id, 2);
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
