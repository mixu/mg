var Backbone = require('backbone');

module.exports = function(mmm) {
  mmm.define('Post', {
    Model: require('./post.js'),
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
    Model: Backbone.Model,
    href: 'http://localhost:8000/people/{id}',
    plural: 'people'
  });

  mmm.define('Comment', {
    Model: Backbone.Model,
    href: 'http://localhost:8000/comments/{id}',
    plural: 'comments'
  });
};
