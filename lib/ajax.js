if(typeof window == 'undefined') {
  var url = require('url'),
      request = require('../test/lib/request.js');
}

var ajax = (typeof window == 'undefined' ? nodeFetch : jqFetch),
    log = require('minilog')('mg/ajax'),
    MicroEE = require('microee'),
    queue = new MicroEE();

module.exports = function(uri, onDone) {
  return fetch(uri, 'GET', onDone);
};

module.exports.put = function(uri, onDone) {
  return fetch(uri, 'PUT', onDone);
};

function fetch(uri, method, onDone) {
  var listeners = queue.listeners(uri),
      isPending = !(listeners && listeners.length === 0);
  if(onDone) {
    queue.once(uri, onDone);
  }

  if(!isPending) {
    log.debug('ajax fetch to ' + uri);
    ajax(uri, method, function(err, data) {
      if(err) return queue.emit(uri, err, null);
      // the data can be empty (e.g. nothing to hydrate)
      if(!data || Array.isArray(data) && data.length === 0) {
        log.debug('ajax empty onDone '+uri, data);
        return queue.emit(uri, null, data);
      }

      log.debug('ajax fetch onDone '+uri);
      if(typeof data === 'string') {
        throw new Error('Unexpected string: ' + data);
      }
      queue.emit(uri, null, data);
    });
  } else {
    log.debug('ajax queue for '+uri);
  }
}

function nodeFetch(uri, method, onDone) {
  // only fetch if we're not already waiting for this resource
  // parse out the path
  var parts = url.parse(uri);

  if(!parts.hostname && !parts.port) {
    parts.hostname = 'localhost';
    parts.port = 8000;
  }

  return request({
    type: method || 'GET',
    hostname: parts.hostname,
    path: parts.pathname,
    port: parts.port
  }, function(err, data, res) {
    onDone(err, data);
  });
}

function jqFetch(uri, method, onDone) {
  $.ajax(uri, {
      type: method || 'GET',
      dataType: 'json',
      // important: cache must be false, as otherwise jQuery can get into
      // a bad state if a request is aborted, cached and then never cachebusted
      cache: false,
      success: function(data, status, jqXHR) {
        onDone(null, data);
      },
      error: function(jqXHR, textStatus, httpPortion) {
        // the textStatus is often not helpful (e.g. "error" for HTTP errors)
        if(textStatus == 'error' && jqXHR) {
          return onDone(jqXHR, null);
        }
        onDone(textStatus, null);
      }
    });
}

module.exports._setAjax = function(obj) {
  ajax = obj;
};

module.exports._nodeFetch = nodeFetch;
