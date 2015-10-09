
var git = require('nodegit');
var Promise = require('promise');
var util = require('util');
var _ = require('underscore');
var PluginPipeline = require('./pipeline');


function MarketDriver(options) {
  this.path = options.path;
  this.config = options.config;
  this.plugins = options.plugins;
  this.repo = null;
}


MarketDriver.prototype.init = function() {
  var self = this;
  return git.Repository.open(this.path).then(function(repo) {
    self.repo = repo;
    return self;
  });
};

MarketDriver.prototype.handleSingle = function(hash, branch) {
  var self = this;
  var obj = {
    hash: hash,
    branch: branch
  };

  this.repo.getCommit(hash).then(function(commit) {
    obj.commit = commit;
    return commit.getDiff();
  }).then(function(diffList) {
    obj.diffList = diffList;
    var children = _.map(diffList, function(diff) {
      return diff.findSimilar({
        flags: git.Diff.FIND.RENAMES |
               git.Diff.IGNORE_WHITESPACE |
               git.Diff.REMOVE_UNMODIFIED
      });
    });

    return Promise.all(children);
  }).then(function() {
    self.makePipeline(obj);
  }).catch(function(error) {
    console.log("handleSingle error: ", error); // TODO
  });
};


MarketDriver.prototype.handleRange = function(begin, end, branch) {
  var self = this;
  var walker = this.repo.createRevWalk();
  walker.pushRange(end + ".." + begin);

  function revFoundCallback(oid) {
    if(!oid) {
      return;
    }

    console.log("found commit: ", oid);

    self.handleSingle(oid, branch);
    return walker.next().then(revFoundCallback);
  }

  walker.next().then(revFoundCallback).done(function() {
    self.handleSingle(end, branch);
  });
};

MarketDriver.prototype.makePipeline = function(obj) {
  var pipe = new PluginPipeline({
    branch: obj.branch,
    commit: obj.commit,
    market: null,
    config: this.config,
    plugins: this.plugins,
    diffList: obj.diffList
  });

  pipe.on('end', function() {
    console.log("Done");
  }).on('error', function(err) {
    console.log("Error: ", err);
  }).next();
};

module.exports = MarketDriver;
