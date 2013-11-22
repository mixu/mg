var url = require('url'),
    meta = require('../../lib/meta.js');

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
    var result,
        idAttribute = 'id';
    if(type == 'posts') {
      idAttribute = '__id';
    }

    dataset[type].some(function(item) {
      var match = item[idAttribute] == id;
      if(match) {
        result = item;
      }
      return match;
    });

    if(!result) {
      throw new Error(type + ', '+idAttribute+'=' +id+ ' not found!');
    }
    callback(null, result);
  };
};

module.exports.ajaxCalls = function() {
  return ajaxCalls;
};
