var url = require('url');

var ajaxCalls = [];

module.exports = function(dataset) {
  ajaxCalls = [];

  return function(uri, callback) {
      ajaxCalls.push([uri]);

      var parts = url.parse(uri).pathname.split('/').filter(function(item) {
          return item.length > 0;
        }),
        type = parts[0],
        id = parts[1];

      if(!dataset[type]) {
        throw new Error(type + ' not in test dataset!');
      }
      var result;

      dataset[type].some(function(item) {
        var match = item.id == id;
        if(match) {
          result = item;
        }
        return match;
      });

      if(!result) {
        throw new Error(type + ', id=' +id+ ' not found!');
      }
      callback(null, result);
  }
};

module.exports.ajaxCalls = function() {
  return ajaxCalls;
};
