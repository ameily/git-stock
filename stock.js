
var _ = require('underscore');

function Stock(email) {
  this.email = email;
  this.newFiles = 0;
  this.delFiles = 0;
  this.additions = 0;
  this.removals = 0;
  this.commits = 0;
  this.merges = 0;
  this.value = 0;
  this.plugins = {};
}

/*
Stock.prototype.onNewFile = function(path) {
  this.newFiles += 1;
};

Stock.prototype.onDelFile = function(path) {
  this.delFiles += 1;
};

Stock.prototype.onDiffAddition = function(content) {
  this.additions += 1;
};

Stock.prototype.onDiffRemoval = function(content) {
  this.removals += 1;
};

Stock.prototype.onCommit = function() {
  this.commits += 1;
};
*/
Stock.prototype.log = function(id, value) {
  this.plugins[id] = (this.plugins[id] || 0) + value;
  this.value += value;
};

Stock.prototype.print = function() {
  var self = this;

  console.log("%s: %d", this.email, this.value);
  console.log("  commits: %d", this.commits);
  console.log("  merges: %d", this.merges);
  console.log("  new files: %d", this.newFiles);
  console.log("  del files: %d", this.delFiles);
  console.log('  add: +%d', this.additions);
  console.log("  rem: -%d", this.removals);
  console.log("  Plugins:");
  _.each(this.plugins, function(value, id) {
    console.log("    %s: %d (%d%%)", id, value, (value / self.value * 100).toFixed(2));
  });
  //console.log("=======================================================");
};

module.exports = Stock;
