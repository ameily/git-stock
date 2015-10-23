
var git = require('nodegit');
var Promise = require('promise');
var util = require('util');
var _ = require('underscore');
var PluginPipeline = require('./pipeline');
var Stock = require('./stock');
var ansi = require('ansi');
var cursor = ansi(process.stdout);


function MarketDriver(options) {
  this.path = options.path;
  this.config = options.config;
  this.plugins = options.plugins;
  this.repo = null;
  this.stocks = {};
  this.commits = 0;
  this.commitHistory = {};
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

  cursor
    .horizontalAbsolute(0)
    .eraseLine()
    .write("Processing Commit: " + hash.toString());

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
    console.log();
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
    var email = obj.commit.author().email();
    var stock;
    if(email in self.stocks) {
      stock = self.stocks[email];
    } else {
      stock = self.stocks[email] = new Stock(email);
    }

    var pipe = new PluginPipeline({
      branch: obj.branch,
      commit: obj.commit,
      market: null,
      config: self.config,
      plugins: self.plugins,
      diffList: obj.diffList,
      stock: stock
    });

    pipe.on('end', function() {
      self.commits += 1;
      resolve();
    }).on('error', function(err) {
      console.log("rejected");
      console.trace(err);
      reject(err);
    }).next();
  });

  return promise;
};

module.exports = MarketDriver;
