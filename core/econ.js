
var _ = require('underscore');
var fs = require('fs');
var Promise = require('promise');
var yaml = require('js-yaml');
var VError = require('verror');
var path = require('path');
var MarketDriver = require('./driver');

var CONF_DIR = path.resolve(__dirname, "..", "conf");
var readFile = Promise.denodeify(fs.readFile);


function resolveIncludes(data) {
  var promises = [];
  if(_.isObject(data)) {
    if(data.include) {
      var file = path.resolve(CONF_DIR, data.include);
      return loadYaml(file);
    }

    _.each(data, function(value, key) {
      promises.push(resolveIncludes(value).then(function(child) {
        data[key] = child;
      }));
    });
  } else if(_.isArray(data)) {
    promises = data.map(function(d, i) {
      return resolveIncludes(d).then(function(child) {
        data[i] = child;
      });
    });
  } else {
    return Promise.resolve(data);
  }

  return Promise.all(promises).then(function() { return data; });
}

function loadYaml(path) {
  console.log("Loading config:", path);
  return readFile(path).then(function(data) {
    try {
      var doc = yaml.safeLoad(data);
      return resolveIncludes(doc);
    } catch(err) {
      throw new VError(err, "failed to parse config file: %s", path);
    }
  });
}

function Economy() {
  this.markets = [];
  this.plugins = [];
}

Economy.prototype.getMarket = function(id) {
  for(var i in this.markets) {
    var market = this.markets[i];
    if(market.id == id) {
      return market;
    }
  }

  return null;
};


Economy.prototype.bootstrap = function() {
  var self = this;
  this.plugins = require('./plugins');

  return loadYaml(path.join(CONF_DIR, "git-stock.yaml")).then(function(config) {
    console.log("done");
    config.markets.forEach(function(marketConfig) {
      self.markets.push(new MarketDriver(marketConfig), self.plugins);
    });

    return Promise.all(_.map(self.markets), function(m) { return m.init(); });
  });
};



module.exports = new Economy();
