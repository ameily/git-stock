
var git = require('nodegit');
var Promise = require('promise');
var util = require('util');
var _ = require('underscore');
var PluginPipeline = require('./pipeline');
var Stock = require('./stock');
var ansi = require('ansi');
var moment = require('moment');
var minimatch = require('minimatch');
var path = require('path');
var fs = require('fs');
var cursor = ansi(process.stdout);
var models = require('./models');
var ProgressBar = require('progress');

var writeFile = Promise.denodeify(fs.writeFile);


var Commit = models.Commit,
    Market = models.Market,
    Stock  = models.Stock;


function getDayKey(timeMs) {
  return moment(timeMs).local().format("YYYYMMDD");
}


function MarketDriver(options) {
  this.path = options.path;
  this.config = options.config;
  this.plugins = options.plugins;
  this.dest = options.dest;
  this.silent = options.silent || false;
  this.ignore = options.ignore || [];
  this.repo = null;

  this.timeline = [];

  this.stocks = [];
  this.stockLookup = {};
  this._timelineBldr = {};
  this._commitHashes = {};
  this.commitCount = 0;
  this.progress = null;

  this.market = new Market({
    name: path.basename(this.path),
    stocks: this.stocks
  });
}

MarketDriver.prototype.print = function() {
  if(!this.silent) {
    process.stderr.write(
      util.format.apply(null, arguments)
    );
  }
};

MarketDriver.prototype.printStatus = function() {
  if(!this.silent) {
    var s = util.format.apply(null, arguments);
    if(s.length < 40) {
      s += ' ' * (40 - s.length);
    }
    process.stderr.write(s);
  }
};

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

MarketDriver.prototype.getStock = function(email, name) {
  var stock = this.stockLookup[email];
  if(_.isUndefined(stock)) {
    stock = this.stockLookup[email] = new Stock({
      email: email,
      name: name
    });

    this.stocks.push(stock);
  }

  return stock;
};

MarketDriver.prototype.addCommit = function(commit) {
  if(commit.sha() in this._commitHashes) {
    return;
  } else {
    this._commitHashes[commit.sha()] = true;
    this.commitCount += 1;
  }

  var self = this;

  var stock = this.getStock(commit.author().email(), commit.author().name());
  var date = getDayKey(commit.timeMs());
  var day = this._timelineBldr[date];

  if(!stock.firstCommitDate || stock.firstCommitDate > date) {
    stock.firstCommitDate = date;
  }

  if(_.isUndefined(day)) {
    this._timelineBldr[date] = {
      date: date,
      commits: [commit]
    };
  } else {
    day.commits.push(commit);
  }

  return commit.getParents().then(function(parents) {
    return Promise.all(
      _.map(parents, function(p) { return self.addCommit(p); })
    );
  });
}

MarketDriver.prototype._buildTimeline = function() {
  var self = this;
  var days = _.keys(this._timelineBldr).sort();

  days.forEach(function(date) {
    // console.log("Date:", date);
    var commits = self._timelineBldr[date].commits.sort(function(a,b) {
      return a.timeMs() < b.timeMs() ? -1 : 1;
    });

    // commits.forEach(function(c) {
    //   console.log(">>", c.timeMs());
    // });

    self.timeline.push({
      date: date,
      commits: commits
    });
  });

  //console.log("=====================================");
  this._timelineBldr = null;
};

MarketDriver.prototype.run = function(branch) {
  var self = this;
  branch = branch || "master";

  this.print("Getting HEAD...          ");
  return this.repo.getBranchCommit(branch).then(function(commit) {
    self.print(commit.sha() + "\n");
    self.print("Loading commits...       ");
    return self.addCommit(commit);
  }).then(function() {
    self.print(self.commitCount.toString() + "\n");

    self.print("Building timeline...     ");
    return self._buildTimeline();
  }).then(function() {
    return self._writeFirstDay();
  }).then(function() {
    self.print("Done\n")

    self.progress = new ProgressBar('Processing [:bar] :percent', {
      total: self.commitCount,
      complete: '=',
      incomplete: ' ',
      width: 50
    });

    var promise = Promise.resolve(null);
    self.timeline.forEach(function(day) {
      promise = promise.then(function() { return self._runDay(day, branch); });
    });

    /*
    return Promise.all(
      _.map(self.timeline, function(day) {
        return self._runDay(day, branch);
      })
    );
    */
    return promise;
  }).then(function() {
    self.print("\nDone\n");
  });
};

MarketDriver.prototype._writeFirstDay = function() {
  var dayTrading = this.market.beginDayTrading();
  var data = JSON.stringify({
    day: dayTrading.serialize(),
    lifetime: this.market.serialize()
  }, null, '  ');

  //console.log('after merge: %s', path.join(self.dest, day.date + ".json"));
  return writeFile(path.join(this.dest, "0.json"), data);
};

MarketDriver.prototype._runDay = function(day, branch) {
  //console.log("Day:", day.date);
  var self = this;
  // console.log("Processing day: %s", day.date);

  // Make the day market
  var dayTrading = this.market.beginDayTrading(day.date);

  return Promise.all(
    _.map(day.commits, function(commit) {
      return self._runCommit(commit, branch, dayTrading);
    })
  ).then(function() {
    //return self.calcAverageLineLifespan(dayTrading.lastCommit());

    // update the day trading based on stock activity
    dayTrading.pollStocks();

    self.market.mergeDayTrading(dayTrading);

    var data = JSON.stringify({
      day: dayTrading.serialize(),
      lifetime: self.market.serialize()
    }, null, '  ');

    //console.log('after merge: %s', path.join(self.dest, day.date + ".json"));
    return writeFile(path.join(self.dest, day.date + ".json"), data);
  }).then(function(record) {
    //TODO
    //console.log("after write");

    // merge the day market results into the lifetime market

  });
};

MarketDriver.prototype._runCommit = function(commit, branch, dayTrading) {
  //console.log("Commit:", commit.sha());
  var self = this;
  var stock = dayTrading.getStock(commit.author().email());

  var pipeline = new PluginPipeline({
    branch: branch,
    commit: commit,
    market: dayTrading,
    config: this.config,
    plugins: this.plugins,
    stock: stock
  });

  // pipeline.data is a Commit object
  stock.commits.push(pipeline.data);

  return commit.getDiff().then(function(diffList) {
    pipeline.data.diffList = diffList;
    var children = _.map(diffList, function(diff) {
      return diff.findSimilar({
        flags: git.Diff.FIND.RENAMES |
               git.Diff.IGNORE_WHITESPACE |
               git.Diff.REMOVE_UNMODIFIED
      });
    });

    return Promise.all(children);
  }).then(function() {
    var promise = new Promise(function(resolve, reject) {
      pipeline.on('end', function() {
        // update commit object
        //console.log(pipeline.data);
        // obj.mergePipeline(pipeline);

        // stock.pollCommit();

        self.progress.tick();
        pipeline.data.updateStock();

        resolve();
      }).on('error', function(err) {
        console.log("rejected");
        console.trace(err);
        reject(err);
      }).next();
    });

    return promise;
  }).catch(function(error) {
    console.log();
    console.log("handleSingle error: ", error); // TODO
    throw error;
  });
};

MarketDriver.prototype._handleCommit = function(commit, dayTrading) {
  var self = this;
  var obj = {
    market: dayTrading,
    hash: commit.sha(),
    commit: commit,
    stock: this.getStock(commit.author().email()),
    branch: branch
  };

  cursor
    .horizontalAbsolute(0)
    .eraseLine()
    .write("Commit: " + this.commits.toString());
    //.write("Processing Commit: " + commit.sha());


  return commit.getDiff().then(function(diffList) {
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
    var promise = new Promise(function(resolve, reject) {
      pipe.on('end', function() {
        //self.commits += 1;
        resolve();
      }).on('error', function(err) {
        console.log("rejected");
        console.trace(err);
        reject(err);
      }).next();
    });

    return promise;
  }).catch(function(error) {
    console.log();
    console.log("handleSingle error: ", error); // TODO
    throw error;
  });
};

MarketDriver.prototype.handleSingle = function(hash, branch, processParents) {
  var self = this;
  var obj = {
    hash: hash,
    branch: branch
  };

  return this.repo.getCommit(hash).then(function(commit) {
    return self._handleCommit(commit, branch, processParents);
  });
};

MarketDriver.prototype.walk = function(branch) {
  var self = this;
  var history = {};

  return this.repo.getBranchCommit(branch).then(function(commit) {
    return self._handleCommit(commit, branch, true);
  }).then(function() {
    console.log();
    console.log("Done");
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
    pipe.on('end', function() {
      //self.commits += 1;
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
