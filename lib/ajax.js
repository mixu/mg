if(typeof window == 'undefined') {
  var url = require('url'),
      request = require('../test/lib/request.js');
}

var ajax = (typeof window == 'undefined' ? nodeFetch : jqFetch),
    log = require('minilog')('mg/ajax'),
    callbacks = {};

function emit(uri, err, result) {
  if(!callbacks[uri]) return;
  var temp = callbacks[uri];
  // delete before calling: otherwise, if fetch is called from a
  // done callback, it will be queued and then ignored
  delete callbacks[uri];
  temp.forEach(function(onDone) {
    onDone(err, result);
  });
}

module.exports = function(uri, onDone) {
  var isPending = (typeof callbacks[uri] != 'undefined');
  if(!callbacks[uri]) {
    callbacks[uri] = [];
  }
  if(onDone) {
    callbacks[uri].push(onDone);
  }

  if(!isPending) {
    log.debug('ajax fetch to ' + uri);
    ajax(uri, function(err, data) {
      if(err) return emit(uri, err, null);
      // the data can be empty (e.g. nothing to hydrate)
      if(!data || Array.isArray(data) && data.length === 0) {
        log.debug('ajax empty onDone '+uri, data);
        return emit(uri, null, data);
      }

      log.debug('ajax fetch onDone '+uri);
      if(typeof data === 'string') {
        throw new Error('Unexpected string: ' + data);
      }
      emit(uri, null, data);
    });
  } else {
    log.debug('ajax queue for '+uri);
  }
};

function nodeFetch(uri, callback) {
  // only fetch if we're not already waiting for this resource
  // parse out the path
  var parts = url.parse(uri);

  if(!parts.hostname && !parts.port) {
    parts.hostname = 'localhost';
    parts.port = 8000;
  }

  return request({ hostname: parts.hostname, path: parts.pathname, port: parts.port }, function(err, data, res) {
    callback(err, data);
  });
}

function jqFetch(uri, callback) {
  $.ajax(uri, {
      dataType: 'json',
      // important: cache must be false, as otherwise jQuery can get into
      // a bad state if a request is aborted, cached and then never cachebusted
      cache: false,
      success: function(data, status, jqXHR) {
        callback(null, data);
      },
      error: function(jqXHR, textStatus, httpPortion) {
        // the textStatus is often not helpful (e.g. "error" for HTTP errors)
        if(textStatus == 'error' && jqXHR) {
          return callback(jqXHR, null);
        }
        callback(textStatus, null);
      }
    });
}

module.exports._setAjax = function(obj) {
  ajax = obj;
};

module.exports._nodeFetch = nodeFetch;
