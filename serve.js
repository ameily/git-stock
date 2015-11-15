
var express = require('express');
var path = require('path');
var api = require('./routes/api');
var index = require('./routes/index');

var app = express();


app.set('view engine', 'jade');

app.use(express.static('public'));
app.use('/vendor', express.static(path.join(__dirname, 'bower_components')));

app.use('/', index);
app.use('/api/v1', api);


var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;
});
