
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
  this.stocks = {};
  this.commits = 0;
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

  console.log("Processing commit:", hash);

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
    //console.log("handleSingle error: ", error); // TODO
    throw error;
  });
};


MarketDriver.prototype.handleRange = function(begin, end, branch) {
  var self = this;
  var walker = this.repo.createRevWalk();
  walker.pushRange(begin + ".." + end);
  var range = [];

  function revFoundCallback(oid) {
    if(!oid) {
      return;
    }

    return self.handleSingle(oid, branch).then(function() {
      return walker.next().then(revFoundCallback);
    });
  }

  return walker.next().then(revFoundCallback).then(function() {
    return self.handleSingle(begin, branch);
  });
};

MarketDriver.prototype.makePipeline = function(obj) {
  var self = this;

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
      var email = obj.commit.author().email();
      if(email in self.stocks) {
        self.stocks[email] += pipe.delta;
      } else {
        self.stocks[email] = pipe.delta;
      }
      self.commits += 1;
      resolve();
    }).on('error', function(err) {
      console.log("rejected:", reject);
      reject(err);
    }).next();
  });

  return promise;
};

module.exports = MarketDriver;
