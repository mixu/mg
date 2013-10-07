// Makes it easier to work with things that are either
// plain objects (direct access via obj[key]) or Backbone models
// (access via obj.get(key)). Calls the getter if it exists,
// otherwise returns the property.
exports.get = function(obj, key) {
  if(!obj) return '';
  if(typeof obj.get == 'function') {
    return obj.get(key);
  } else {
    return obj[key];
  }
};

// Similar to `_.result`: If the value of the named property is a function
// then invoke it with the object as context; otherwise, return it.
exports.result = function(obj, key) {
  if(!obj) return '';
  // if a property is a function, evaluate it
  return (typeof obj[key] === 'function' ? obj[key].call(obj) : obj[key]);
};

// call setter if exists, otherwise set property
exports.set = function(obj, key, value) {
  if(typeof obj.set == 'function') {
    return obj.set(key, value);
  } else {
    obj[key] = value;
  }
};

// calls .keys() if exists, otherwise does Object.keys()
exports.keys = function(obj) {
  return (typeof obj.keys == 'function' ? obj.keys() : Object.keys(obj));
};
