var url = require('url'),
    log = require('minilog')('server'),
    Microee = require('microee'),
    Router = require('mixu_minimal').Router;

Router.prototype.patch = function(regexp, callback) {
  this.routes.push({ method: 'PATCH', expression: regexp, callback: callback });
};


function CollectionServer() {
  this.cache = {};
  this.nextId = {};
  this.app = new Router();
}

Microee.mixin(CollectionServer);

// items should be in the form { collectionName: [ { data 1 }, { data 2} ]  }
CollectionServer.prototype.add = function(items) {
  var self = this;
  Object.keys(items).forEach(function(key) {
    if(!Array.isArray(items[key])) {
      throw new Error('Collections must be arrays');
    }
    self.cache[key] = items[key];
    // add REST endpoint
    self.addRest(key);
  });
  // calculate max(id) for each collection
  Object.keys(this.cache).forEach(function(key) {
    self.nextId[key] = self.cache[key].reduce(function(prev, model) {
      return Math.max(prev, model.id);
    }, 0);
  });
};

CollectionServer.prototype.addRest = function(collection) {
  var self = this;
  // add CREATE
  this.app.post(new RegExp('^/'+collection+'/?$'), function(req, res) {
    // assign id
    req.body.id = ++self.nextId[collection];
    self.cache[collection].push(req.body);
    // MUST respond with a 201 Created
    res.statusCode = 201;
    // MUST include a Location
    res.setHeader('Location', 'http://localhost:8000/');
    res.setHeader('Content-Type', 'application/json');

    res.end(JSON.stringify(req.body));

    // JSONAPI:
    // result[collection] = [ req.body ];
    // res.end(JSON.stringify(result));
  });

  // add READ by ID
  this.app.get(new RegExp('^/'+collection+'/(.+)$'), function(req, res, match) {
    var id = match[0];
    // Reading:
    // - GET /item/:id
    // - GET /item/:id1,:id2
    var targets = (!isNaN(match[1]) ? [ match[1] ] : (match[1] ? match[1].split(',') : []) );

    var parsed = url.parse(req.url, true),
        parts = parsed.pathname.split('/').filter(function(item) {
          return item.length > 0;
        });

    // - GET /item?ids=:id1,:id2
    if(parsed.query.ids) {
      targets = targets.concat(parsed.query.ids.split(','));
    }
    self.findById(collection, targets, function(err, results) {
      if(results.length > 0) {
        res.setHeader('Content-Type', 'application/json');
        res.end((results.length == 1 ?  JSON.stringify(results[0]) :  JSON.stringify(results)));
        // JSONAPI:
        // result[collection] = results;
        // res.end(JSON.stringify(result));
        return;
      }
    });
    res.end();
  });

  // add LIST / search
  this.app.get(new RegExp('^/'+collection+'/?$'), function(req, res, match) {
    var results = self.cache[collection];
    if(results.length > 0) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(results));
      return;
    } else {
      res.end();
    }
  });



  // add UPDATE
  this.app.put(new RegExp('^/'+collection+'/(.+)$'), function(req, res, match) {
    console.log('PUT', match);

    res.statusCode = 200;
    res.end();
  });

  this.app.patch(new RegExp('^/'+collection+'/(.+)$'), function(req, res, match) {
    // fetch the item
    self.findById(collection, [ match[1] ], function(err, results) {
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
            break;
          default:
        }
      });
      res.statusCode = 204;
      res.end();
    });
  });

  // add DELETE
  this.app.delete(new RegExp('^/'+collection+'/(.+)$'), function(req, res, match) {
    var parsed = url.parse(req.url, true),
        parts = parsed.pathname.split('/').filter(function(item) {
          return item.length > 0;
        });
    var id =  parts[1];
    self.cache[collection].filter(function(model) {
      if(model.id == id) {
        console.log('delete', model);
        return false;
      }
      return true;
    });
    // JSONAPI: res.statusCode = 204;
    res.statusCode = 200;
    res.end();
  });
};


CollectionServer.prototype.findById = function(collection, ids, onDone) {
  var self = this,
      results = [];
  ids.filter(function(id) {
      return !isNaN(id);
    }).forEach(function(id) {
      self.cache[collection].some(function(model) {
        if(model.id == id || model.__id == id) {
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
      result = {};

  log.info(req.method, req.url);
  res.once('finish', function() {
    log.info('end', req.url);
  });

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

    // parse the body
   var body = '';
   req.on('data', function(chunk) {
     body += chunk;
   });
   req.on('end', function() {
     if(body.length > 0) {
       req.body = JSON.parse(body);
     }

    if(!self.app.route(req, res)) {
      var evname = req.method +' ' + req.url;
      self.emit(evname, req, res);
      if(!self._events[evname]) {
        log.warn('Nothing matched', req.url);
        res.end();
      }
    }
  });
};

module.exports = CollectionServer;
