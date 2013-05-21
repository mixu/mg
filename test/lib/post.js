var Model = require('./model.js'),
    mmm = require('mmm');

function Post(attrs) {
  Model.call(this, attrs);
}

Model.mixin(Post);

// query methods

Post.findById = function(id, onDone) {
  return mmm.findById('Post', id, onDone);
};

Post.allCollection = function(onDone) {
  return mmm.stream('Post');
};

module.exports = Post;
