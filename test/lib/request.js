var http = require('http');

function request(opts, onDone) {
  var req = http.request(opts, function(res) {
    var body = '';
    res.on('data', function(chunk) {
      body += chunk;
    });
    res.on('end', function() {
      if(res.headers['content-type'] == 'application/json') {
        try {
          onDone(undefined, JSON.parse(body), res);
          return;
        } catch(e) {
          throw e;
        }
      }
      onDone(undefined, body, res);
    });
  });
  if(opts.data) {
    req.write(opts.data);
  }
  req.end();
}

module.exports = request;

// return a wrapper that takes the opts param and
// sets it's values if the key is not already set
module.exports.defaults = function(defs) {
  return function(opts, onDone) {
    Object.keys(defs).forEach(function(k) {
      if(!opts[k]) {
        opts[k] = defs[k];
      }
    });
    return request(opts, onDone);
  };
};
