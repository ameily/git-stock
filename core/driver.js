
var git = require('nodegit');
var Promise = require('promise');
var util = require('util');
var _ = require('underscore');
var PluginPipeline = require('./pipeline');
var ansi = require('ansi');
var moment = require('moment');
var minimatch = require('minimatch');
var path = require('path');
var fs = require('fs');
var cursor = ansi(process.stdout);
var models = require('./models');
var ProgressBar = require('progress');
var slug = require('slug');

var writeFile = Promise.denodeify(fs.writeFile);
var stat = Promise.denodeify(fs.stat);


var Commit = models.Commit,
    Market = models.Market,
    Stock  = models.Stock;


function getDayKey(timeMs) {
  return moment(timeMs).local().format("YYYYMMDD");
}


function MarketDriver(options) {
  this.path = options.path;
  this.name = options.name;
  this.id = options.id || slug(this.name, {lower: true});
  this.db = path.join(options.db, this.id);

  this.mailmap = options.mailmap || {};
  this.milestones = options.milestones || [];
  this.milestoneLookup = {};
  this.ignore = options.ignore || [];
  this.config = options.config;
  this.plugins = options.plugins;
  this.repo = null;
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
    self.milestones.forEach(function(milestone) {
      self.milestoneLookup[milestone.date] = milestone;
    });

    self.market = new Market({
      name: self.name
    });

    try {
      var stats = fs.statSync(self.db);
      if(!stats.isDirectory()) {
        throw new Error("path is not a directory: " + options.input);
      }
    } catch(err) {
      try {
        fs.mkdirSync(self.db);
      } catch(err2) {
        console.error('failed to create output directory: %s', err2);
        throw err2;
      }
    }

    return self;
  });
};
/*
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
*/

MarketDriver.prototype.resolveAuthor = function(email, name) {
  var entry = this.mailmap[email];
  if(!entry) {
    return {
      email: email,
      name: name
    };
  }

  if(_.isString(entry)) {
    return {
      email: entry,
      name: name
    };
  }

  return entry;
}

MarketDriver.prototype._addCommit = function(commit, cache, calendar) {
  if(commit.sha() in cache) {
    return;
  } else {
    cache[commit.sha()] = true;
    cache.__count += 1;
  }

  var self = this;

  var author = this.resolveAuthor(commit.author().email(), commit.author().name());

  var stock = this.market.getStock(author.email, author.name);
  var date = getDayKey(commit.timeMs());
  var day = calendar[date];

  if(!stock.firstCommitDate || stock.firstCommitDate > date) {
    stock.firstCommitDate = date;
  }

  if(_.isUndefined(day)) {
    calendar[date] = {
      date: date,
      commits: [commit]
    };
  } else {
    day.commits.push(commit);
  }

  return commit.getParents().then(function(parents) {
    return Promise.all(
      _.map(parents, function(p) { return self._addCommit(p, cache, calendar); })
    );
  });
}

MarketDriver.prototype._buildTimeline = function(calendar) {
  var self = this;
  var days = _.keys(calendar).sort();
  var timeline = [];
  var day0 = moment(days[0], "YYYYMMDD").subtract(1, 'days').format('YYYYMMDD');

  timeline.push({
    date: day0,
    commits: []
  });

  days.forEach(function(date) {
    // console.log("Date:", date);
    var commits = calendar[date].commits.sort(function(a,b) {
      return a.timeMs() < b.timeMs() ? -1 : 1;
    });

    timeline.push({
      date: date,
      commits: commits
    });
  });

  return timeline;
};

MarketDriver.prototype.run = function(branch) {
  var self = this;
  var cache = {
    __count: 0
  };
  var calendar = { };

  branch = branch || "master";

  this.print("Getting HEAD...          ");
  return this.repo.getBranchCommit(branch).then(function(commit) {
    self.print(commit.sha() + "\n");
    self.print("Loading commits...       ");
    return self._addCommit(commit, cache, calendar);
  }).then(function() {
    self.print(cache.__count.toString() + "\n");

    self.print("Building timeline...     ");
    return self._buildTimeline(calendar);
  }).then(function(timeline) {
    self.print(timeline.length + " Days\n");
    var lastIndex = timeline.length - 1;

    // if(true) {
    //   var day = self.timeline[self.timeline.length - 1];
    //   var commit = day.commits[day.commits.length - 1];
    //   return self.calcAverageLineLifespan(commit, commit.timeMs());
    // }

    var progress = new ProgressBar('Processing [:bar] :percent', {
      total: cache.__count,
      complete: '=',
      incomplete: ' ',
      width: 50
    });

    var promise = Promise.resolve(null);
    timeline.forEach(function(day, i) {
      promise = promise.then(function() {
        return self._runDay(day, branch, progress);
      }).then(function(dayTrading) {
        if(lastIndex == i) {
          // We just completed running the last day. Perform blame analysis to
          // determine file ownership and code age.
          var commit = day.commits[day.commits.length - 1];
          self.print("Calculating code age...  ");
          return self.calcAverageLineLifespan(commit, commit.timeMs()).then(function(record) {
            self.print("Done\n");
            self.market.mergeRecord(record);
            return self._writeDay(dayTrading);
          });
        } else {
          return self._writeDay(dayTrading);
        }
      });
    });

    return promise;
  }).then(function() {
    self.print("\nDone\n");
  });
};

MarketDriver.prototype._writeDay = function(dayTrading) {
  var data = JSON.stringify({
    day: dayTrading.serialize(),
    lifetime: this.market.serialize()
  }, null, '  ');

  //console.log('after merge: %s', path.join(self.dest, day.date + ".json"));
  return writeFile(path.join(this.db, dayTrading.date + ".json"), data);
};


MarketDriver.prototype._runDay = function(day, branch, progress) {
  //console.log("Day:", day.date);
  var self = this;
  //console.log("Processing day: %s", day.date);

  // Make the day market
  var dayTrading = this.market.beginDayTrading(day.date);
  //console.log("Day:", day);

  return Promise.all(
    _.map(day.commits, function(commit) {
      return self._runCommit(commit, branch, dayTrading).then(function() {
        progress.tick();
      });
    })
  ).then(function() {
    // update the day trading based on stock activity
    dayTrading.pollStocks();

    self.market.mergeDayTrading(dayTrading);
    return dayTrading;
  });
};

MarketDriver.prototype._runCommit = function(commit, branch, dayTrading) {
  //console.log("Commit:", commit.sha());
  var self = this;
  var email = this.resolveAuthor(commit.author().email(), "").email;
  var stock = dayTrading.getStock(email);
  //console.log("stock:", stock);

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

        //self.progress.tick();
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

        //entry[1].free();
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

MarketDriver.prototype._calcAverageLineLifespanInBlame = function(blame, record, now) {
  var commitList = [];
  var commitLineCount = [];
  var self = this;

  for(var i = 0; i < blame.getHunkCount(); ++i) {
    var hunk = blame.getHunkByIndex(i);
    record.totalLineCount += hunk.linesInHunk();
    commitLineCount.push(hunk.linesInHunk());
    commitList.push(self.repo.getCommit(hunk.finalCommitId()));
  }

  return Promise.all(commitList).then(function(commits) {
    _.zip(commitLineCount, commits).forEach(function(entry) {
      // entry[0] => line count used from commit
      // entry[1] => commit object
      var email = entry[1].author().email();
      var age = (now - entry[1].timeMs()) * entry[0];
      var stock = record.stockLookup[email];

      record.totalLineAge += age;

      stock.totalLineCount += entry[0];
      stock.totalLineAge += age;

      //entry[1].free();
    });
    //blame.free();
  });
};

MarketDriver.prototype.calcAverageLineLifespan = function(hash, now) {
  var paths = [];
  var self = this;
  var commit;
  var now = now || moment.utc().valueOf();
  var record = this.market.createRecord();

  var p1;
  if(_.isString(hash)) {
    p1 = this.repo.getCommit(hash);
  } else {
    p1 = Promise.resolve(hash);
  }

  return p1.then(function(c) {
    commit = c;
    return commit.getTree();
  }).then(function(tree) {
    return self._getFilePaths(tree);
  }).then(function(paths) {
    return Promise.all(_.map(paths, function(path) {
      var opts = new git.BlameOptions();
      opts.newestCommit = commit.id();
      return git.Blame.file(self.repo, path, opts);
    }));
  }).then(function(blames) {
    return Promise.all(
      _.map(blames, function(blame) {
        return self._calcAverageLineLifespanInBlame(blame, record, now);
      })
    );
  }).then(function() {
    /*
    results.forEach(function(result) {
      self.market.totalAge += result.totalAge;
      self.market.totalLineCount += result.totalLineCount;

      for(var email in result.stocks) {
        self.stocks[email].
        if(email in r.stocks) {
          r.stocks[email] += result.stocks[email];
        } else {
          r.stocks[email] = result.stocks[email];
        }
      }
    });
    */


    // var r = record;
    // console.log("total age:", r.totalLineAge);
    // console.log("total lines:", r.totalLineCount);
    // console.log("Avg Line Age:", (r.totalLineAge / r.totalLineCount / 1000 / 60 / 60 / 24).toFixed(2), "days");

    return record;
  });
};


module.exports = MarketDriver;
