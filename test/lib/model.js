function Model(attrs) {
  this.attributes = attrs;
}

Model.prototype.get = function(key) {
  return this.attributes[key];
};

Model.prototype.set = function(key, value) {
  this.attributes[key] = value;
}

module.exports = Model;
