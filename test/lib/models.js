var Backbone = require('backbone'),
    mg = require('mg');

var Post = Backbone.Model.extend({
  type: 'Post',
  urlRoot: 'http://localhost:8721/posts',
  collectionType: 'Posts',
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

mg.define('Post', Post);

var Posts = Backbone.Collection.extend({
  url: 'http://localhost:8721/posts',
  // additional property
  special: true
});

mg.define('Posts', Posts);

var Person = Backbone.Model.extend({
  urlRoot: 'http://localhost:8721/people'
});

mg.define('Person', Person);

var Comment = Backbone.Model.extend({
  urlRoot: 'http://localhost:8721/comments'
});

mg.define('Comment', Comment);

module.exports = {
  Post: Post,
  Posts: Posts,
  Person: Person,
  Comment: Comment
};
