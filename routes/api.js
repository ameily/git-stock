var express = require('express');
var router = express.Router();
var fs = require('fs');
var Promise = require('promise');
var path = require('path');
var _ = require('underscore');
var util = require('util');

var readdir = Promise.denodeify(fs.readdir);
var readFile = Promise.denodeify(fs.readFile);
var writeFile = Promise.denodeify(fs.writeFile);

var dataDir = path.resolve(__dirname, "..", "data");

function getLifetimeData() {
  return readdir(dataDir).then(function(files) {
    var promises = [];
    var days = _.filter(files, function(file) {
      return file.indexOf(".json", file.length - 5) > 0;
    }).map(function(file) {
      var entry = {
        day: file.substring(0, file.length - 5),
        path: path.join(dataDir, file)
      };

      promises.push(readFile(entry.path).then(function(data) {
        entry.data = JSON.parse(data);
        return entry;
      }));
    });

    return Promise.all(promises);
  }).then(function(days) {
    var data = days.map(function(day) {
      return {
        date: day.data.day.date,
        value: day.data.lifetime.value,
        commits: day.data.lifetime.commits
      };
    });
    return data;
  }).catch(function(err) {
    console.trace(err);
  });
}

function getLatestData() {
  return readdir(dataDir).then(function(files) {
    var latest = files.sort()[files.length - 1];
    return readFile(path.join(dataDir, latest));
  }).then(function(day) {
    return JSON.parse(day);
  }).catch(function(err) {
    console.trace(err);
  });
}


/* GET home page. */
router.get('/lifetime.json', function(req, res, next) {
  getLifetimeData().then(function(data) {
    res.json(data);
  });
});

router.get('/latest.json', function(req, res, next) {
  getLatestData().then(function(data) {

    res.json(data);
  });
});

module.exports = router;
