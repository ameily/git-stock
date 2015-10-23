
var _ = require('underscore');
var gitUtils = require('./git-utils');


exports.BaseCommit = {
  id: "commit",
  name: "Commit reward",
  description: "Base reward for a single commit",

  config: {
    value: 10
  },

  processCommit: function(commit, config, data, next) {
    data.log(this.id, config.value);
    next();
  }
};



exports.WellformedMessage = {
  id: "commit.message",
  name: "Commit subject reward",
  description: "Check for valid and wellformed commit subject and body",

  config: {
    deltaPerLine: 5,
    maxLineLength: 79,
    maxDelta: 30
  },

  processCommit: function(commit, config, data, next) {
    if(commit.parentcount() == 2) {
      return next();
    }

    var delta = 0;
    var lines = commit.message().replace('\r', '').split('\n');

    for(var i = 0; i < lines.length; ++i) {
      var line = lines[i];
      if(line.length > config.maxLineLength) {
        delta -= config.deltaPerLine;
      } else {
        if(i == 1 && line.length > 0) {
          delta -= config.deltaPerLine;
        } else if(line.length > 0) {
          delta += config.deltaPerLine;
        }
      }
    }

    if(delta != 0) {
      if(delta < 0 && delta < -config.maxDelta) {
        delta = -config.maxDelta;
      } else if(delta > config.maxDelta) {
        delta = config.maxDelta;
      }

      data.log(this.id, delta);
    }

    next();
  }
};

exports.IssueReferences = {
  id: 'commit.message.issue',

  config: {
    close: 20,
    refs: 10,
    maxReward: 60
  },

  refPrefix: ['refs', 'ref'],
  closePrefix: ['close', 'closes', 'fixes', 'fix'],

  processCommit: function(commit, config, data, next) {
    if(commit.parentcount() == 2) {
      return next();
    }


    var re = /(closes|close|refs|ref|fixes|fix)\s+#(\d+)\b/gi;
    var message = commit.message();
    var fixes = [];
    var refs = [];
    var delta = 0;

    while((result = re.exec(message)) != null) {
      var prefix = result[1].toLowerCase();

      if(_.contains(this.refPrefix, prefix)) {
        refs.push(result[2]);
      } else if(_.contains(this.closePrefix, prefix)) {
        fixes.push(result[2]);
      }
    }

    fixes = _.uniq(fixes);
    refs = _.uniq(refs);

    fixes.forEach(function(id) {
      if(!_.contains(refs, id)) {
        delta += config.close;
      }
    });

    delta += config.refs * refs.length;

    if(delta > 0) {
      delta = delta <= config.maxReward ? delta : config.maxReward;
      data.log(this.id, delta);
    }

    next();
  }
};


exports.NewFiles = {
  id: "commit.file.new",

  config: {
    maxReward: 100,
    rewardPerNewFile: 20,
    //penaltyPerDeletedFile: -2,
    //maxPenalty: -10
  },

  processCommit: function(commit, config, data, next) {
    if(commit.parentcount() == 2) {
      return next();
    }


    var self = this;
    var value = 0;
    var paths = [];

    _.each(data.diffList, function(diff) {
      for(var i = 0; i < diff.numDeltas(); ++i) {
        var delta = diff.getDelta(i);

        if(gitUtils.isDeltaNormalFile(delta) && !gitUtils.isDeltaBinaryFile(delta)) {
          if(gitUtils.isDeltaNewFile(delta)) {
            //console.log("blah", delta.newFile);
            //value += config.rewardPerNewFile;
            //data.stock.newFile();
            paths.push(delta.newFile().path());
            //console.log("new file:", delta.newFile().path());
          }
        }
      }
    });

    paths = _.uniq(paths);
    value = paths.length * config.rewardPerNewFile;
    data.stock.newFiles += paths.length;

    if(value > 0 && value > config.maxReward) {
      value = config.maxReward;
    } else if(value < 0 && value < config.maxPenalty) {
      value = config.maxPenalty;
    }

    if(value != 0) {
      data.log(this.id, value);
    }

    next();
  }
};


exports.BinaryFiles = {
  id: "commit.file.binary",

  config: {
    penalty: -250,
    maxPenalty: -1000
  },

  processCommit: function(commit, config, data, next) {
    if(commit.parentcount() == 2) {
      return next();
    }


    var self = this;
    var value = 0;

    _.each(data.diffList, function(diff) {
      for(var i = 0; i < diff.numDeltas(); ++i) {
        var delta = diff.getDelta(i);
        if(gitUtils.isDeltaNewFile(delta) && gitUtils.isDeltaBinaryFile(delta)) {
          value += config.penalty;
          console.log("Binary file:", delta.newFile().path());
        }
      }
    });

    value = Math.abs(value);
    if(value > 0) {
      var max = Math.abs(config.maxPenalty);
      value = value <= max ? -value : -max;
      data.log(this.id, value);
    }

    next();
  }
};



exports.FileAdditions = {
  id: "commit.files.addition",

  config: {
    rewardPerLine: 1,
    minNewLineLength: 5,
    maxRewardPerFile: 100,
    maxRewardPerCommit: 500,
    maxNewLineLength: 79
  },

  addition: '+'.charCodeAt(0),
  removal: '-'.charCodeAt(0),
  context: ' '.charCodeAt(0),

  rewardLine: function(line, config) {
    var len =line.content().trim().length;
    return len >= config.minNewLineLength && (
      config.maxNewLineLength == 0 || len <= config.maxNewLineLength
    );
  },

  getModifiedPaths: function(diffList) {
    var paths = [];
    diffList.forEach(function(diff) {
      for(var i = 0; i < diff.numDeltas(); ++i) {
        var delta = diff.getDelta(i);
        if(!gitUtils.isDeltaNormalFile(delta) || gitUtils.isDeltaBinaryFile(delta)) {
          continue;
        }

        if(gitUtils.isDeltaDeletedFile(delta)) {
          // TODO
        } else if(gitUtils.isDeltaNewFile(delta)) {
          // TODO
        } else if(!gitUtils.isDeltaRenamedFile(delta)) {
          //console.log("diff file:", delta.newFile().path());
          paths.push(delta.newFile().path());
        }
      }
    });

    return paths;
  },

  processCommit: function(commit, config, data, next) {
    if(commit.parentcount() == 2) {
      return next();
    }


    var value = 0;
    var self = this;

    var paths = this.getModifiedPaths(data.diffList);
    var reward = 0;

    if(paths.length == 0) {
      next();
      return;
    }

    Promise.all(_.map(data.diffList, function(diff) {
      // Get the list of patches for each diff
      return diff.patches();
    })).then(function(patchesList) {
      var promises = [];
      // For each patch, determine if the patch applies to a modified text
      // file and, if it does, get the patch's hunks
      patchesList.forEach(function(patches) {
        patches.forEach(function(patch) {
          var diffFile = gitUtils.getDiffFile(patch);
          if(diffFile && paths.indexOf(diffFile.path()) >= 0) {
            // patch is a modified text file
            promises.push(patch.hunks());
          }
        });
      });

      return Promise.all(promises);
    }).then(function(hunksList) {
      // For each hunk, get the list of lines
      var promises = [];
      hunksList.forEach(function(hunks) {
        hunks.forEach(function(hunk) {
          promises.push(hunk.lines());
        });
      });

      return Promise.all(promises);
    }).then(function(linesList) {
      return _.flatten(linesList, true);
    }).then(function(lines) {
      // Finally, each line in the lines list applies to a modified text file.
      // Iterate over the diff, rewarding new lines that match the config
      // standards.
      lines.forEach(function(line) {
        if(line.origin() == self.addition && self.rewardLine(line, config)) {
          reward += config.rewardPerLine;
          data.stock.additions += 1;
          //console.log('+', line.content());
        } else if(line.origin() == self.removal && self.rewardLine(line, config)) {
          data.stock.removals += 1;
        }
      });
    }).then(function() {
      if(reward > 0) {
        if(reward > config.maxRewardPerCommit) {
          reward = config.maxRewardPerCommit;
        }

        data.log(self.id, reward);
      }

      next();
    });
  }
}

exports.Merge = {
  id: 'commit.merge',

  config: {
    reward: 10
  },

  processCommit: function(commit, config, data, next) {
    if(commit.parentcount() == 2) {
      data.log(this.id, config.reward);
      data.stock.merges += 1;
    }

    next();
  }
};
