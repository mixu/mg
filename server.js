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

CollectionServer.prototype.onRequest = function(req, res) {
  var self = this,
      parsed = url.parse(req.url, true),
      parts = parsed.pathname.split('/').filter(function(item) {
        return item.length > 0;
      }),
      collection = parts[0],
      results = [],
      result = {};

  // console.log('path', parts);

  if(req.method == 'GET' && this.cache[collection]) {
    // Reading:
    // - GET /item/:id
    // - GET /item/:id1,:id2
    var targets = (!isNaN(parts[1]) ? [ parts[1] ] : (parts[1] ? parts[1].split(',') : []) );
    // - GET /item?ids=:id1,:id2
    if(parsed.query.ids) {
      targets = targets.concat(parsed.query.ids.split(','));
    }

    targets.filter(function(id) {
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
    if(results.length > 0) {
      result[collection] = results;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
      return;
    }
    res.end();
  } else if(req.method == 'POST') {
    // parse the body
    var body = '';
    req.on('data', function(chunk) {
      body += chunk;
    });
    req.on('end', function() {
      body = JSON.parse(body);
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
    });
  } else if(req.method == 'PATCH') {

  } else {
    res.end();
  }
};

module.exports = CollectionServer;
