var Backbone = require('backbone'),
    mmm = require('mmm');

var Post = Backbone.Model.extend({
  sync: mmm.sync,
  type: 'Post'
});

// query methods

Post.findById = function(id, onDone) {
  return mmm.findById('Post', id, onDone);
};

Post.allCollection = function(onDone) {
  return mmm.stream('Post');
};

module.exports = Post;
