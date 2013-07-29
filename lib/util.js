// call getter if it exists, otherwise return property
exports.get = function(obj, key) {
  if(!obj) return '';
  if(typeof obj.get == 'function') {
    return obj.get(key);
  } else {
    return obj[key];
  }
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
