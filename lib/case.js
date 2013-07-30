var assert = require('assert'),
    mmm = require('../index.js'),
    Backbone = require('backbone'),
    cache = require('./cache.js'),
    fakeAjax = require('./fake-ajax.js');

require('minilog').enable();


cache._setAjax(fakeAjax({
  FFF: [ { id: 5000, name: 'FFF', child: 6000 }],
  GGG: [ { id: 6000, name: 'GGG', parent: 5000 }]
}));

var FFF = Backbone.Model.extend({
  url: 'http://test/FFF/',
  sync: mmm.sync('FFF'),
  rels: {
    child: { type: 'GGG' }
  }
});
mmm.define('FFF', FFF);
var GGG = Backbone.Model.extend({
  url: 'http://test/GGG',
  sync: mmm.sync('GGG'),
  rels: {
    parent: { type: 'FFF' }
  }
});
mmm.define('GGG', GGG);

mmm.hydrate('FFF', { id: 5000, name: 'FFF', child: 6000 }, function(err, model) {
  console.log('ONDONE');
  console.log(model);
  var a = model.get('child');
  assert.equal('GGG', a);
});
