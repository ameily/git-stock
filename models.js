
var _ = require('underscore');



function StockSummary(options) {
  this.email = options.email;
  this.name = options.name;

  this.timestamp = options.timestamp || null;
  this.value = options.value || 0;
  this.additions = options.additions || 0;
  this.removals = options.removals || 0;
  this.commits = options.commits || 0;
  this.merges = options.merges || 0;

  this.plugins = {};

  this.totalLineCount = options.lineCount || 0;
  this.totalLineAge = options.totalLineAge || 0;
  this.avgLineAge = options.avgLineAge || null;
}

StockSummary.prototype.calculateAvgLineAge = function() {
  return this.avgLineAge != null ? this.avgLineAge : (
    this.totalLineCount > 0 ? this.totalLineAge / this.totalLineCount : 0
  );
};

StockSummary.prototype.addLines = function(count, timestamp) {
  this.totalLineCount += count;
  this.totalLineAge = count * timestamp;
};

StockSummary.prototype.log = function(id, value) {
  if(_.isArray(id) && _.isUndefined(value)) {
    var self = this;
    id.forEach(function(entry) {
      self.log(entry[0])
    });
  }

  var plugin = this.plugins[id];
  if(!plugin) {
    plugin = this.plugins[id] = {
      id: id,
      count: 0,
      value: 0
    };
  }
  this.value += value;

  plugin.count += 1;
  plugin.value += value;
};

StockSummary.prototype.fork = function() {
  return new StockSummary({
    email: this email,
    name: this.name,
    value: this.value,
    additions: this.additions,
    removals: this.removals,
    commits: this.commits,
    merges: this.merges
  });
};

///////////////////////////////////////////////////////////////////////////////

function MarketSummary(options) {
  this.timestamp = options.timestamp;
  this.branch = options.branch;
  this.value = options.value || 0;
  this.files = options.files || 0;
  this.commits = options.commits || 0;

  this.totalLineCount = 0;
  this.totalLineAge = 0;

  this.stocks = options.stocks || [];
  this.stockLookup = {};
}

MarketSummary.prototype._buildStockLookup = function() {
  var self = this;

  this.stockLookup = {};
  this.stocks.forEach(function(stock) {
    self.stockLookup[stock.email] = stock;
  });
};

MarketSummary.prototype.getStock = function(email, name) {
  var stock = this.stockLookup[email];
  if(!stock) {
    stock = this.stockLookup[email] = new StockSummary({
      email: email,
      name: name,
      branch: this.branch
    });
  }

  return stock;
};

MarketSummary.prototype.fork = function() {
  var market = new MarketSummary({
    branch: this.branch,
    value: this.value,
    files: this.files,
    commits: this.commits,
    stocks: _.map(this.stocks, function(stock) { return stock.fork(); }),
    plugins: _.clone(this.plugins)
  });

  market._buildStockLookup();

  return market;
};

MarketSummary.prototype.log = function(id, value) {
  this.plugins[id] = (this.plugins[id] || 0) + value;
  this.value += value;
};

MarketSummary.prototype.addLines = function(count, commit) {
  var stock = this.getStock(commit.author().email());
  stock.addLines(count, commit.timeMs());

  this.totalLineCount += count;
  this.totalLineTimestamp += commit.timeMs();
};


/*
*/
