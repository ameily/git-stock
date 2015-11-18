
var fs = require('fs');
var _ = require('underscore');
var Promise = require('promise');
var path = require('path');


var readdir = Promise.denodeify(fs.readdir);
var readFile = Promise.denodeify(fs.readFile);


function Market(options) {
  var self = this;

  this.repoPath = options.repoPath;
  this.dataPath = options.dataPath;
  this.mailmap = options.mailmap || {};
  this.milestones = options.milestones || [];

  this.milestoneLookup = {};
  this.milestones.forEach(function(milestone) {
    self.milestoneLookup[milestone.date] = milestone;
  });
}


Market.prototype.getDay = function(day) {

};

Market.prototype.getLifetimeData = function() {

};

Market.prototype.getLatestDay = function() {
  var self = this;
  return readdir(this.dataPath).then(function(files) {
    var latest = files.sort()[files.length - 1];
    return readFile(path.join(self.dataPath, latest));
  }).then(function(day) {
    return JSON.parse(day);
  }).catch(function(err) {
    console.trace(err);
  });
};

Market.prototype.getNumberOfDays = function() {
  readdir(this.dataPath).then(function(files) {
    return files.length - 1;
  });
};
