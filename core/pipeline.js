
// TODO mail map support
// TODO blame report

var Commit = require('./models').Commit;
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var VError = require('verror');


function PluginPipeline(options) {
  var pipe = this;

  this.plugins = options.plugins;
  this.config = options.config;
  this.commit = options.commit;
  this.index = -1;

  this.data = new Commit({
    sha: this.commit.sha(),
    message: this.commit.message(),
    timestamp: this.commit.timeMs(),
    isMerge: this.commit.parentcount() > 1,
    branch: options.branch,
    market: options.market,
    stock: options.stock
  });

  //this.data.stock.commits += 1;
  //this.data.stock.commits.push(options.commit);

  EventEmitter.call(this);
}


util.inherits(PluginPipeline, EventEmitter);



PluginPipeline.prototype.next = function(err) {
  var self = this;
  if(err) {
    var plugin = this.plugins[this.index];
    console.log("ERROR in plugin");
    this.emit('error', new VError(err, "error in plugin %s", plugin.name || plugin.id));
  }

  this.index += 1;

  if(this.index >= this.plugins.length) {
    this.emit('end');
    return;
  }

  var plugin = this.plugins[this.index];
  var cfg = this.config.scope(plugin.id);


  try {
    plugin.processCommit(this.commit, cfg, this.data, function() {
      self.next();
    });
  } catch(err) {
    console.log("pipe error");
    console.trace(err);
    this.emit('error', err);
  }

  return this;
};

module.exports = PluginPipeline;
