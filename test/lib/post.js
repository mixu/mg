var Backbone = require('backbone'),
    mmm = require('mmm');

var Post = Backbone.Model.extend({
  sync: mmm.sync,
  type: 'Post',
  url: 'http://localhost:8000/posts',
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

mmm.define('Post', Post);

var Person = Backbone.Model.extend({
  url: 'http://localhost:8000/people',
  plural: 'people'
});

mmm.define('Person', Person);

var Comment = Backbone.Model.extend({
  url: 'http://localhost:8000/comments',
  plural: 'comments'
});

mmm.define('Comment', Comment);

module.exports = Post;
