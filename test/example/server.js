var express = require('express'),
    Glue = require('gluejs');

var app = express(),
    glue = new Glue();

glue.basepath('../lib')
    .include('../lib/post.js')
    .main('/post.js')
    .replace('jquery', 'window.$')
    .export('App');

app.use(express.static(__dirname + '/public'));

app.get('/models.js', function(req, res) {
  res.setHeader('Content-type', 'text/javascript')
  glue.render(res);
});

app.listen(5000);
