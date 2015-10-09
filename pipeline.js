
var util = require('util');
var EventEmitter = require('events').EventEmitter;


function PluginPipeline(options) {
  var pipe = this;

  this.plugins = options.plugins;
  this.config = options.config;
  this.commit = options.commit;
  this.journal = [];
  this.index = -1;
  this.delta = 0;

  this.data = {
    branch: options.branch,
    market: options.market,
    diffList: options.diffList,
    journal: [],
    log: function(id, value) {
      this.journal.push({ id: id, value: value });
      pipe.delta += value;
      console.log("%s: %d", id, value);
    }
  };

  EventEmitter.call(this);
}


util.inherits(PluginPipeline, EventEmitter);



PluginPipeline.prototype.next = function() {
  var self = this;
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
    this.emit('error', err);
  }

  return this;
};

module.exports = PluginPipeline;
