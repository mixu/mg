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

Model.prototype.isNew = function() {
  return this.attributes['id'] == null;
};

Model.prototype.save = function(key, val, options) {
  var attrs, method, xhr, attributes = this.attributes;
  if (key == null || typeof key === 'object') {
    attrs = key;
    options = val;
  } else {
    (attrs = {})[key] = val;
  }

  options = {};

  method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
  if (method === 'patch') options.attrs = attrs;
  xhr = this.sync(method, this, options);

  // e.g. after backend save is successful
  this.emit('sync', this);
};

Model.prototype.destroy = function() {
  this.emit('destroy', this);
};

Model.mixin = function(dest) {
  var o = Model.prototype, k;
  for (k in o) {
    o.hasOwnProperty(k) && (dest.prototype[k] = o[k]);
  }
};

microee.mixin(Model);

module.exports = Model;
