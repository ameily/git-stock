
var git = require('nodegit');
var Promise = require('promise');
var util = require('util');
var _ = require('underscore');
var PluginPipeline = require('./pipeline');
var Stock = require('./stock');
var ansi = require('ansi');
var moment = require('moment');
var minimatch = require('minimatch');
var cursor = ansi(process.stdout);


function MarketDriver(options) {
  this.path = options.path;
  this.config = options.config;
  this.plugins = options.plugins;
  this.ignore = options.ignore || [];
  this.repo = null;
  this.stocks = {};
  this.commits = 0;
  this.commitHistory = {};
}

MarketDriver.prototype.pathMatches = function(path) {
  var b = true;
  this.ignore.forEach(function(mask) {
    if(minimatch(path, mask)) {
      b = false;
    }
  });

  return b;
};

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

MarketDriver.prototype._getFilePaths = function(tree) {
  var blobPaths = [];
  var blobList = [];
  var treeList = [];
  var self = this;
  var promise;

  tree.entries().forEach(function(entry) {
    if(entry.isFile() && self.pathMatches(entry.path())) {
      blobPaths.push(entry.path());
      blobList.push(entry.getBlob());
    } else if(entry.isTree()) {
      treeList.push(entry.getTree());
    }
  });

  if(blobList.length > 0) {
    promise = Promise.all(blobList).then(function(blobs) {
      var paths = [];
      _.zip(blobPaths, blobs).forEach(function(entry) {
        if(!entry[1].isBinary()) {
          paths.push(entry[0]);
        }
      });

      return paths;
    });
  } else {
    promise = Promise.resolve([]);
  }

  if(treeList.length > 0) {
    promise = promise.then(function(filePaths) {
      return Promise.all(treeList).then(function(trees) {
        return Promise.all(_.map(trees, function(child) { return self._getFilePaths(child); }));
      }).then(function(subFilePaths) {
        return _.union(_.flatten(subFilePaths), filePaths);
      });
    });
  }

  return promise;
};

MarketDriver.prototype._calcAverageLineLifespanInBlame = function(blame, now) {
  var commitList = [];
  var commitLineCount = [];
  var self = this;
  var totalAge = 0;
  var totalLineCount = 0;
  var stocks = {};

  for(var i = 0; i < blame.getHunkCount(); ++i) {
    var hunk = blame.getHunkByIndex(i);
    totalLineCount += hunk.linesInHunk();
    commitLineCount.push(hunk.linesInHunk());
    commitList.push(self.repo.getCommit(hunk.finalCommitId()));
  }

  return Promise.all(commitList).then(function(commits) {
    _.zip(commitLineCount, commits).forEach(function(entry) {
      // entry[0] => line count used from commit
      // entry[1] => commit object
      var email = entry[1].author().email();
      totalAge += (now - entry[1].timeMs()) * entry[0];

      if(email in stocks) {
        stocks[email] += entry[0];
      } else {
        stocks[email] = entry[0];
      }
    });

    return {
      totalAge: totalAge,
      totalLineCount: totalLineCount,
      stocks: stocks
    };
  });
};

MarketDriver.prototype.calcAverageLineLifespan = function(hash) {
  var paths = [];
  var self = this;
  var commit;
  var now = moment.utc().valueOf();

  return this.repo.getCommit(hash).then(function(c) {
    commit = c;
    return commit.getTree();
  }).then(function(tree) {
    return self._getFilePaths(tree);
  }).then(function(paths) {
    return Promise.all(_.map(paths, function(path) {
      var opts = new git.BlameOptions();
      opts.newestCommit = commit.id();
      console.log(">>", path);
      return git.Blame.file(self.repo, path, opts);
    }));
  }).then(function(blames) {
    return Promise.all(
      _.map(blames, function(blame) {
        return self._calcAverageLineLifespanInBlame(blame, now);
      })
    );
  }).then(function(results) {
    var r = {
      totalAge: 0,
      totalLineCount: 0,
      stocks: {}
    };

    results.forEach(function(result) {
      r.totalAge += result.totalAge;
      r.totalLineCount += result.totalLineCount;

      for(var email in result.stocks) {
        if(email in r.stocks) {
          r.stocks[email] += result.stocks[email];
        } else {
          r.stocks[email] = result.stocks[email];
        }
      }
    });

    console.log("total age:", r.totalAge);
    console.log("total lines:", r.totalLineCount);
    console.log("Avg Line Age:", (r.totalAge / r.totalLineCount / 1000 / 60 / 60 / 24).toFixed(2), "days");

    for(var email in r.stocks) {
      console.log(">>", email, "=>", r.stocks[email], ";", (r.stocks[email] / r.totalLineCount * 100.0).toFixed(2));
    }
  });
};


module.exports = MarketDriver;
