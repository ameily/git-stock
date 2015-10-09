
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

  console.log("Single:", hash);

  return this.repo.getCommit(hash).then(function(commit) {
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
    return self.makePipeline(obj);
  }).catch(function(error) {
    console.log("handleSingle error: ", error); // TODO
  });
};


MarketDriver.prototype.handleRange = function(begin, end, branch) {
  var self = this;
  console.log('before create walker');
  var walker = this.repo.createRevWalk();
  console.log("before pushRange");
  walker.pushRange(begin + ".." + end);
  var range = [];

  function revFoundCallback(oid) {
    if(!oid) {
      return;
    }

    console.log("found commit: ", oid);

    return self.handleSingle(oid, branch).then(function() {
      return walker.next().then(revFoundCallback);
    });
  }
  console.log("before walker.next()");
  return walker.next().then(revFoundCallback).then(function() {
    console.log("last commit:", begin);
    /*
    range.push(begin);
    range.reverse();
    return Promise.all(
      _.map(range, function(hash) {
        return self.handleSingle(hash, branch);
      })
    );
    */
    return self.handleSingle(begin, branch);
  });
};

MarketDriver.prototype.makePipeline = function(obj) {
  var self = this;
  console.log("makePipeline()");

  var promise = new Promise(function(resolve, reject) {
    var pipe = new PluginPipeline({
      branch: obj.branch,
      commit: obj.commit,
      market: null,
      config: self.config,
      plugins: self.plugins,
      diffList: obj.diffList
    });

    pipe.on('end', function() {
      console.log("Done");
      resolve();
    }).on('error', function(err) {
      console.log("Error: ", err);
      reject(err);
    }).next();
  });

  return promise;
};

module.exports = MarketDriver;
