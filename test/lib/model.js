var microee = require('microee');

function Model(attrs) {
  this.attributes = attrs;
}

Model.prototype.get = function(key) {
  return this.attributes[key];
};

Model.prototype.set = function(key, value) {
  this.attributes[key] = value;
  this.emit('change', this, {});
  this.emit('change:'+key, this, value, {});
  return this;
};

microee.mixin(Model);

module.exports = Model;
