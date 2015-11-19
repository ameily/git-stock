
var _ = require('underscore');
var moment = require('moment');



function Commit(data) {
  this.sha = data.sha;
  this.message = data.message;
  this.timestamp = data.timestamp;
  this.stock = data.stock || null;
  this.branch = data.branch || null;
  this.market = data.market || null;

  this.dividends = data.dividends || [];
  this.isMerge = data.isMerge || false;

  this.additions = data.additions || 0;
  this.removals = data.removals || 0;
  this.newFiles = data.newFiles || [];
  this.delFiles = data.delFiles || [];
  this.modFiles = data.modFiles || [];

  this.value = data.value || 0;
}

Commit.prototype.mergePipeline = function(pipeline) {
  this.dividends = pipeline.data.journal;
  this.removals = pipeline.data.removals;
  this.additions = pipeline.data.additions;
  this.newFiles = pipeline.data.newFiles;
  this.modFiles = pipeline.data.modFiles;
  this.delFiles = pipeline.data.delFiles;
  this.value = pipeline.delta
};

Commit.prototype.serialize = function() {
  return {
    sha: this.sha,
    message: this.message,
    timestamp: this.timestamp,
    dividends: this.dividends,
    isMerge: this.isMerge,
    additions: this.additions,
    removals: this.removals,
    newFiles: this.newFiles,
    delFiles: this.delFiles,
    modFiles: this.modFiles,
    value: this.value
  };
};

Commit.prototype.log = function(id, value) {
  this.dividends.push({ id: id, value: value });
  this.value += value;
  return this;
};

Commit.prototype.updateStock = function() {
  mergeDividends(this.stock.dividends, this.dividends);

  this.stock.value += this.value;
  this.stock.additions += this.additions;
  this.stock.removals += this.removals;
  this.stock.newFiles = _.uniq(this.stock.newFiles.concat(this.newFiles));
  this.stock.delFiles = _.uniq(this.stock.delFiles.concat(this.delFiles));
  this.stock.modFiles = _.uniq(this.stock.modFiles.concat(this.modFiles));
};

exports.Commit = Commit;

/****************************************************************************
 *
 * Market Lifetime
 *
 ****************************************************************************/

function Market(data) {
  var self = this;

  this.name = data.name || null;
  this.stocks = data.stocks || [];
  this.additions = data.additions || 0;
  this.removals = data.removals || 0;
  this.commits = data.commits || 0;
  this.merges = data.merges || 0;
  this.value = data.value || 0;
  this.dividends = data.dividends || [];

  this.totalLineCount = data.totalLineCount || 0;
  this.totalLineAge = data.totalLineAge || 0;
  this.avgLineAge = data.avgLineAge || 0;

  this.stockLookup = {};
  this.stocks.forEach(function(stock) {
    self.stockLookup[stock.email] = stock;
  });
}

Market.prototype.beginDayTrading = function(date) {
  this.totalLineAge = this.totalLineCount = this.avgLineAge = 0;

  return new MarketDayTrading({
    name: this.name,
    date: date,
    stocks: _.map(this.stocks, function(stock) {
      return stock.beginDayTrading(date);
    })
  });
};

Market.prototype.mergeDayTrading = function(dt) {
  this.additions += dt.additions;
  this.removals += dt.removals;
  this.commits += dt.commits;
  this.merges += dt.merges;
  this.newFiles += dt.newFiles;
  this.delFiles += dt.delFiles;
  this.modFiles += dt.modFiles;
  this.value += dt.value;

  _.zip(this.stocks, dt.stocks).forEach(function(entry) {
    entry[0].mergeDayTrading(entry[1]);
  });

  mergeDividends(this.dividends, dt.dividends);
};

Market.prototype.getStock = function(email, name) {
  var stock = this.stockLookup[email];
  if(_.isUndefined(stock)) {
    stock = this.stockLookup[email] = new Stock({
      email: email,
      name: name
    });

    this.stocks.push(stock);
  }

  return stock;
}

Market.prototype.serialize = function() {
  return {
    name: this.name,
    stocks: _.map(this.stocks, function(stock) { return stock.serialize(); }),
    additions: this.additions,
    removals: this.removals,
    commits: this.commits,
    merges: this.merges,
    value: this.value,
    dividends: this.dividends,
    totalLineAge: this.totalLineAge,
    totalLineCount: this.totalLineCount,
    avgLineAge: this.avgLineAge
  };
};

Market.prototype.createRecord = function() {
  var record = {
    totalLineAge: 0,
    totalLineCount: 0,
    stocks: [],
    stockLookup: {}
  };

  this.stocks.forEach(function(stock) {
    var sr = {
      totalLineCount: 0,
      totalLineAge: 0,
      email: stock.email,
      name: stock.name
    };

    record.stocks.push(sr);
    record.stockLookup[stock.email] = sr;
  });

  return record;
};

Market.prototype.mergeRecord = function(record) {
  var self = this;

  this.totalLineAge = record.totalLineAge;
  this.totalLineCount = record.totalLineCount;
  this.avgLineAge = this.totalLineCount > 0 ? this.totalLineAge / this.totalLineCount : 0;

  record.stocks.forEach(function(rhs, i) {
    var lhs = self.stocks[i];
    lhs.totalLineAge = rhs.totalLineAge;
    lhs.totalLineCount = rhs.totalLineCount;
    lhs.avgLineAge = lhs.totalLineCount > 0 ? lhs.totalLineAge / lhs.totalLineCount : 0;
  });
};

exports.Market = Market;

/****************************************************************************
 *
 * Market Day Trading
 *
 ****************************************************************************/
function MarketDayTrading(data) {
  this.name = data.name;
  this.date = data.date;
  this.stocks = data.stocks || []; // list of stock objects
  this.additions = data.additions || 0;
  this.commits = data.commits || 0;
  this.merges = data.merges || 0;
  this.removals = data.removals || 0;
  this.newFiles = data.newFiles || 0;
  this.delFiles = data.delFiles || 0;
  this.modFiles = data.modFiles || 0;
  this.value = data.value || 0;
  this.dividends = data.dividends || [];
}

MarketDayTrading.prototype.getStock = function(email) {
  for(var i in this.stocks) {
    var stock = this.stocks[i];
    if(stock.email == email) {
      return stock;
    }
  }

  return null;
};

MarketDayTrading.prototype.getCommits = function() {
  return _.flatten(_.map(this.stocks, function(stock) {
    return stock.commits;
  }));
};

MarketDayTrading.prototype.getNewFiles = function() {
  return _.flatten(_.map(this.stocks, function(stock) {
    return stock.newFiles;
  }));
};

MarketDayTrading.prototype.getDelFiles = function() {
  return _.flatten(_.map(this.stocks, function(stock) {
    return stock.delFiles
  }));
};

MarketDayTrading.prototype.getModFiles = function() {
  return _.flatten(_.map(this.stocks, function(stock) {
    return stock.modFiles
  }));
};

MarketDayTrading.prototype.pollStocks = function() {
  var self = this;
  this.stocks.forEach(function(stock) {
    self.newFiles += stock.newFiles.length;
    self.modFiles += stock.modFiles.length;
    self.delFiles += stock.delFiles.length;
    self.additions += stock.additions;
    self.removals += stock.removals;
    self.commits += stock.commits.length;
    self.merges += _.filter(stock.commits, function(c) { return c.isMerge; }).length;
    self.value += stock.value;

    mergeDividends(self.dividends, stock.dividends);
  });
};

MarketDayTrading.prototype.serialize = function() {
  return {
    name: this.name,
    date: this.date,
    stocks: _.map(this.stocks, function(stock) { return stock.serialize(); }),
    additions: this.additions,
    removals: this.removals,
    newFiles: this.newFiles,
    delFiles: this.delFiles,
    modFiles: this.modFiles,
    commits: this.commits,

    value: this.value,
    dividends: this.dividends
  };
};



/*****************************************************************************
*
* Stock lifetime
*
******************************************************************************/
function Stock(data) {
  /// Stock name
  this.name = data.name;
  /// Stock email
  this.email = data.email;
  /// Stock value
  this.value = data.value || 0;

  /// Number of additions
  this.additions = data.additions || 0;
  /// Number of removals
  this.removals = data.removals || 0;
  // Number of files created
  this.newFiles = data.newFiles || 0;
  // Number of files deleted
  this.delFiles = data.delFiles || 0;
  // Number of files modified
  this.modFiles = data.modFiles || 0;

  /// Number of commits
  this.commits = data.commits || 0;
  this.merges = data.merges || 0;
  /// Plugin reward breakdown
  this.dividends = data.dividends || [];

  this.firstCommitDate = data.firstCommitDate || null;

  this.totalLineCount = data.totalLineCount || 0;
  this.totalLineAge = data.totalLineAge || 0;
  this.avgLineAge = data.avgLineAge || 0;
}

Stock.prototype.mergeDayTrading = function(stock) {
  this.additions += stock.additions;
  this.removals += stock.removals;
  this.commits += stock.commits.length;
  this.merges += _.filter(stock.commits, function(c) { return c.isMerge; }).length;
  this.newFiles += stock.newFiles.length;
  this.delFiles += stock.delFiles.length;
  this.modFiles += stock.modFiles.length;
  this.value += stock.value;

  mergeDividends(this.dividends, stock.dividends);
};

Stock.prototype.beginDayTrading = function(date) {
  this.totalLineAge = this.totalLineCount = this.avgLineAge = 0;

  return new StockDayTrading({
    date: date,
    name: this.name,
    email: this.email
  });
};

Stock.prototype.serialize = function() {
  return {
    name: this.name,
    email: this.email,
    value: this.value,
    additions: this.additions,
    removals: this.removals,
    newFiles: this.newFiles,
    delFiles: this.delFiles,
    modFiles: this.modFiles,
    commits: this.commits,
    merges: this.merges,
    dividends: this.dividends,
    firstCommitDate: this.firstCommitDate,
    totalLineAge: this.totalLineAge,
    totalLineCount: this.totalLineCount,
    avgLineAge: this.avgLineAge
  };
}

exports.Stock = Stock;


/*****************************************************************************
*
* Stock Day Trading
*
******************************************************************************/

function StockDayTrading(data) {
  /// Date
  this.date = data.date;
  /// Stock name
  this.name = data.name;
  /// Stock email address
  this.email = data.email;

  /// Stock value
  this.value = data.value || 0;

  /// Number of additions
  this.additions = data.additions || 0;
  /// Number of removals
  this.removals = data.removals || 0;
  this.newFiles = data.newFiles || [];
  this.delFiles = data.delFiles || [];
  this.modFiles = data.modFiles || [];

  /// Plugin reward breakdown for the day
  this.dividends = data.dividends || [];

  /// Commits
  this.commits = data.commits || [];
}

StockDayTrading.prototype.serialize = function() {
  return {
    date: this.date,
    name: this.name,
    email: this.email,
    value: this.value,
    additions: this.additions,
    removals: this.removals,
    newFiles: this.newFiles,
    delFiles: this.delFiles,
    modFiles: this.modFiles,
    commits: _.map(this.commits, function(commit) {
      return commit.serialize();
    }),
    dividends: this.dividends
  };
};

// StockDayTrading.prototype.pollCommit = function(commit) {
//   this.value += commit.value;
//   this.additions += commit.additions;
//   this.removals += commit.removals;
//   this.newFiles = _.uniq(this.newFiles.concat(commit.newFiles));
//   this.delFiles = _.uniq(this.delFiles.concat(commit.delFiles));
//   this.modFiles = _.uniq(this.modFiles.concat(commit.modFiles));
//   mergeDividends(this.dividends, commit.dividends);
// };


/*****************************************************************************
*
* Util functions
*
******************************************************************************/

function mergeDividends(result, src) {
  src.forEach(function(srcDividend) {
    var found = _.filter(result, function(d) { return d.id == srcDividend.id; });
    if(found.length > 0) {
      found[0].occurences += srcDividend.occurences || 1;
      found[0].value += srcDividend.value;
      if(found.length > 1) {
        console.log("Found more than 1");
      }
    } else {
      result.push({
        id: srcDividend.id,
        occurences: srcDividend.occurences || 1,
        value: srcDividend.value
      });
    }
  });
}
