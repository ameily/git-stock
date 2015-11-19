



var Getopt = require('node-getopt');
var fs = require('fs');
var GitStockConfig = require('./core/config');
var MarketDriver = require('./core/driver');
var Plugins = require('./core/plugins').__all__;


var getopt = new Getopt([
  ['b', 'branch=BRANCH', 'perform analysis on specific branch (default: master).'],
  ['i', 'input=PATH', 'path to the git repository.'],
  ['o', 'output=PATH', 'path to save result data'],
  ['s', 'silent', 'do not print anyting to the screen.'],
  ['V', 'version', 'print version information.'],
  ['h', 'help', 'print help']
]);

getopt.setHelp(
  "Usage: node index.js -i PATH -o PATH [-b BRANCH] [options]\n" +
  "\n[[OPTIONS]]\n"
);

var cmdline = getopt.bindHelp().parseSystem();
var options = cmdline.options;

options.branch = options.branch || 'master';

if(!options.input) {
  console.error("git-stock: missing required argument: -i/--input");
  getopt.showHelp();
  process.exit(1);
}

if(!options.output) {
  console.error("git-stock: missing required argument: -o/--output");
  getopt.showHelp();
  process.exit(1);
}

try {
  var stats = fs.statSync(options.input);
  if(!stats.isDirectory()) {
    throw new Error("path is not a directory: " + options.input);
  }
} catch(err) {
  console.error("failed to open repository: %s", err);
  process.exit(1);
}

try {
  var stats = fs.statSync(options.output);
  if(!stats.isDirectory()) {
    throw new Error("path is not a directory: " + options.input);
  }
} catch(err) {
  try {
    fs.mkdirSync(options.output);
  } catch(err2) {
    console.error('failed to create output directory: %s', err2);
    process.exit(1);
  }
}


var config = new GitStockConfig();
config.register(Plugins);

var driver = new MarketDriver({
  name: path.basename(options.input),
  path: options.input,
  db: options.output,
  config: config,
  plugins: Plugins,
  silent: options.silent || false
});


driver.init().then(function() {
  return driver.run(options.branch);
}).catch(function(err) {
  console.error(err.toString());
  console.trace(err);
});
