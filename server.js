var url = require('url');

function CollectionServer() {
 this.cache = {};
 this.nextId = {};
}

// items should be in the form { collectionName: [ { data 1 }, { data 2} ]  }
CollectionServer.prototype.add = function(items) {
  var self = this;
  Object.keys(items).forEach(function(key) {
    if(!Array.isArray(items[key])) {
      throw new Error('Collections must be arrays');
    }
    self.cache[key] = items[key];
  });
  // calculate max(id) for each collection
  Object.keys(this.cache).forEach(function(key) {
    self.nextId[key] = self.cache[key].reduce(function(prev, model) {
      return Math.max(prev, model.id);
    }, 0);
  });
};

CollectionServer.prototype.findById = function(collection, ids, onDone) {
  var self = this,
      results = [];
  ids.filter(function(id) {
      return !isNaN(id);
    }).forEach(function(id) {
      self.cache[collection].some(function(model) {
        if(model.id == id) {
          results.push(model);
          return true;
        }
        return false;
      });
    });
  onDone(undefined, results);
};

CollectionServer.prototype.onRequest = function(req, res) {
  var self = this,
      parsed = url.parse(req.url, true),
      parts = parsed.pathname.split('/').filter(function(item) {
        return item.length > 0;
      }),
      collection = parts[0],
      result = {};

  // console.log('path', parts);

  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  if(req.method == 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '1728000');
    res.end();
  }


  if(req.method == 'GET' && this.cache[collection]) {
    // Reading:
    // - GET /item/:id
    // - GET /item/:id1,:id2
    var targets = (!isNaN(parts[1]) ? [ parts[1] ] : (parts[1] ? parts[1].split(',') : []) );
    // - GET /item?ids=:id1,:id2
    if(parsed.query.ids) {
      targets = targets.concat(parsed.query.ids.split(','));
    }
    this.findById(collection, targets, function(err, results) {
      if(results.length > 0) {
        result[collection] = results;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
        return;
      }
    });
    res.end();
  } else if(req.method == 'POST' || req.method == 'PATCH' || req.method == 'DELETE') {
    // parse the body
    var body = '';
    req.on('data', function(chunk) {
      body += chunk;
    });
    req.on('end', function() {
      if(body.length > 0) {
        body = JSON.parse(body);
      }

      // create
      if(req.method == 'POST') {
        // assign id
        body.id = ++self.nextId[collection];
        self.cache[collection].push(body);
        // MUST respond with a 201 Created
        res.statusCode = 201;
        // MUST include a Location
        res.setHeader('Location', 'http://localhost:8000/');
        res.setHeader('Content-Type', 'application/json');
        result[collection] = [ body ];
        res.end(JSON.stringify(result));
      } else if(req.method == 'PATCH' && Array.isArray(body)) {
        // fetch the item
        self.findById(collection, [ parts[1] ], function(err, results) {
          // interpret the operation
          body.forEach(function(op) {
            var path = op.path.split('/').filter(function(item) { return item.length > 0; });

            switch(op.op) {
              case 'replace':
                // is it on /links?

                // 204 No content if the update was successful and the client's current attributes remain up to date
                res.statusCode = 204;
                results[0][path[0]] = op.value;
                console.log('replace', op.path.slice(1), '=', op.value);
                break;
              case 'add':
                // is it on /links?
                if(path[0] == 'links') {
                  results[0][path[1]].push(op.value);
                  console.log('added', op.value, results[0][path[1]]);
                }
                break;
              case 'remove':
                // is it on /links?
                if(path[0] == 'links') {
                  var value = op.value || path[path.length - 1];
                  results[0][path[1]] = results[0][path[1]].filter(function(v) { return v != value; });
                  console.log('removed', value, results[0][path[1]]);
                }
                break;
              // not implemented:
              case 'test':
              case 'move':
              case 'copy':
              default:
            }
          });
          res.statusCode = 204;
          res.end();
        });
      } else if(req.method == 'DELETE') {
        var id =  parts[1];
        self.cache[collection].filter(function(model) {
          if(model.id == id) {
            console.log('delete', model);
            return false;
          }
          return true;
        });
        res.statusCode = 204;
        res.end();
      } else {
        res.end();
      }
    });
  } else {
    res.end();
  }
};

module.exports = CollectionServer;
