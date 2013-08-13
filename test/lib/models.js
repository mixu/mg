var Backbone = require('backbone'),
    mmm = require('mmm');

var Post = Backbone.Model.extend({
  sync: mmm.sync('Post'),
  type: 'Post',
  url: 'http://localhost:8721/posts',
  plural: 'posts',
  collection: 'Posts',
  idAttribute: '__id',
  rels: {
    'author': {
      type: 'Person'
    },
    'comments': {
      type: 'Comment'
    }
  }
});

mmm.define('Post', Post);

var Posts = Backbone.Collection.extend({
  // additional property
  special: true
});

mmm.define('Posts', Posts);

var Person = Backbone.Model.extend({
  sync: mmm.sync('Person'),
  url: 'http://localhost:8721/people',
  plural: 'people'
});

mmm.define('Person', Person);

var Comment = Backbone.Model.extend({
  sync: mmm.sync('Comment'),
  url: 'http://localhost:8721/comments',
  plural: 'comments'
});

mmm.define('Comment', Comment);

module.exports = {
  Post: Post,
  Posts: Posts,
  Person: Person,
  Comment: Comment
};
