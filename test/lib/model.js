function Model(attrs) {
  this.attributes = attrs;
}

Model.prototype.get = function(key) {
  return this.attributes[key];
};

module.exports = Model;
