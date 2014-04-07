// Calls the getter if it exists, otherwise returns the property.
exports.get = function(obj, key) {
  if(!obj) return '';
  return (typeof obj.get == 'function' ? obj.get(key) : obj[key]);
};

// Similar to `_.result`: If the value of the named property is a function
// then invoke it with the object as context; otherwise, return it.
exports.result = function(obj, key) {
  if(!obj) return '';
  // if a property is a function, evaluate it
  return (typeof obj[key] === 'function' ? obj[key].call(obj) : obj[key]);
};

// call setter if exists, otherwise set property
exports.set = function(obj, key, value, options) {
  if(arguments.length === 2) {
    value = key;
  }
  if(typeof obj.set == 'function') {
    return obj.set(key, value, options);
  } else {
    obj[key] = value;
  }
};

// calls .keys() if exists, otherwise does Object.keys()
exports.keys = function(obj) {
  return (typeof obj.keys == 'function' ? obj.keys() : Object.keys(obj));
};
