
var _ = require('underscore');


function GitStockConfig(cfg) {
  this.root = cfg || {};
}


GitStockConfig.prototype.register = function(plugin) {
  var self = this;
  if(_.isArray(plugin)) {
    plugin.forEach(function(p) {
      self.register(p);
    });
  }

  _.each(plugin.config, function(cfg, key) {
    var id = plugin.id + "." + key;

    self.set(id, cfg);
  });
};

GitStockConfig.prototype.set = function(id, value) {
  var parts = id.split('.');
  var last = parts.pop();

  var current = this.root;

  parts.forEach(function(part) {
    if(part in current) {
      current = current[part];
    } else {
      current = current[part] = {};
    }
  });

  current[last] = value;
};

GitStockConfig.prototype.get = function(id, fallback) {
  var parts = id.split('.');
  var last = parts.pop();
  var current = this.root;

  for(var i = 0; i < parts.length; ++i) {
    if(part in current) {
      current = current[part];
    } else {
      return fallback;
    }
  }

  return last in current ? current[last] : fallback;
};

GitStockConfig.prototype.scope = function(id) {
  var parts = id.split('.');
  var current = this.root;
  var self = this;
  var ret = {};

  parts.forEach(function(part) {
    if(part in current) {
      current = current[part];
    } else {
      current = {};
    }
  });

  _.each(current, function(value, key) {
    ret[key] = value;
  });

  ret.get = function() {
    return GitStockConfig.get.apply(self, arguments);
  };

  return ret;
};

module.exports = GitStockConfig;
