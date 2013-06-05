if(typeof window == 'undefined') {
  var url = require('url'),
      request = require('../test/lib/request.js');
}

function fetch(uri, callback) {
  // only fetch if we're not already waiting for this resource
  // parse out the path
  var parts = url.parse(uri);
  return request({ hostname: parts.hostname, path: parts.pathname, port: parts.port }, function(err, data, res) {
    callback(err, data);
  });
};

// Backbone expects the response to be a plain object, not a instance of a model
// But that's fine, since this method is only used for .findX() calls, where Backbone is not directly
// involved.
function ajaxFetch(uri, callback) {
  $.ajax(uri, {
      dataType: 'json',
      success: function(data, status, jqXHR) {
        callback(null, data);
      },
      error: function(jqXHR, textStatus, httpPortion) {
        // the textStatus is often not helpful (e.g. "error" for HTTP errors)
        if(textStatus == 'error') {
          return callback(jqXHR.status, null);
        }
        callback(textStatus, null);
      }
    });
};

module.exports = (typeof window == 'undefined' ? fetch : ajaxFetch);