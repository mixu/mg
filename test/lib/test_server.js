var Server = require('./server.js');

var server = new Server();

var authorObj = {
  id: 1000,
  name: 'Bar'
};

var comment1 = {
  id: 1,
  name: 'C-1'
};

var comment2 = {
  id: 2,
  name: 'C-2'
};

var circular1 = {
  id: 1,
  name: 'A'
};

var circular2 = {
  id: 2,
  name: 'B',
  other: circular1
};

circular1.other = JSON.parse(JSON.stringify(circular2));

server.add({
  posts: [{
    __id: 1,
    name: 'Post1',
    author: authorObj
  },
  {
    __id: 2,
    name: 'Post2',
    author: authorObj,
    comments: [ comment1, comment2 ]
  }],
  people: [ authorObj ],
  comments: [
    comment1,
    comment2,
    {
      id: 1234,
      name: 'C-1234'
    }
  ],
  circular: [
    circular1,
    circular2
  ],
  parsehydration: [
    {
      id: 1,
      name: 'AA'
    }
  ],
  collectiontest: [ ]
});

module.exports = server;
