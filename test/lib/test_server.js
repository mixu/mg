var Server = require('./server.js');

var server = new Server();

server.add({
  posts: [{
    __id: 1,
    name: 'Post1',
    author: 1000
  },
  {
    __id: 2,
    name: 'Post2',
    author: 1000,
    comments: [ 1, 2 ]
  }],
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
    },
    {
      id: 1234,
      name: 'C-1234'
    }
  ]
});

module.exports = server;
