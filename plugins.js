
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
    deltaPerLine: 2,
    maxLineLength: 79,
    maxDelta: 10
  },

  processCommit: function(commit, config, data, next) {
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
    var self = this;
    var value = 0;

    _.each(data.diffList, function(diff) {
      for(var i = 0; i < diff.numDeltas(); ++i) {
        var delta = diff.getDelta(i);

        if(gitUtils.isDeltaNormalFile(delta) && !gitUtils.isDeltaBinaryFile(delta)) {
          if(gitUtils.isDeltaNewFile(delta)) {
            //console.log("blah", delta.newFile);
            value += config.rewardPerNewFile;
          }
        }
      }
    });

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

/*
exports.FileAdditions = {
  id: "commit.files.addition",

  config: {
    rewardPerLine: 1,
    maxRewardPerFile: 100,
    maxRewardPerCommit: 500
  },

  addition: '+'.charCodeAt(0),
  removal: '-'.charCodeAt(0),

  getDiffStats: function(diff, paths) {
    var self = this;

    return diff.patches().then(function(patches) {
      console.log("got patches");
      return Promise.all(_.map(patches, function(patch) { return patch.hunks(); }));
    }).then(function(hunksList) {
      // hunksList is a list of list<hunks>
      var promises = [];
      hunksList.forEach(function(hunks) {
        hunks.forEach(function(hunk) {
          console.log("hunk");
          if(paths.indexOf(gitUtils.getDiffFile(hunk).path()) >= 0) {
            console.log('found hunk');
            promises.push(hunk.lines());
          }
        });
      });
      return Promise.all(promises);
    }).then(function(linesList) {
      // linesList is a list of list<line>
      var ret = {
        additions: 0,
        removals: 0
      };

      linesList.forEach(function(lines) {
        lines.forEach(function(line) {
          console.log("line:", line);
          if(line.origin() == self.addition) {
            console.log("add:", line.content());
            ret.additions += 1;
          } else if(line.origin() == self.removal) {
            console.log("rm: ", line.content());
            ret.removals += 1;
          }
        });
      });

      return ret;
    });
  },

  processCommit: function(commit, config, data, next) {
    var value = 0;
    var self = this;

    var promises = [];

    _.each(data.diffList, function(diff) {
      var paths = [];

      for(var i = 0; i < diff.numDeltas(); ++i) {
        var delta = diff.getDelta(i);
        if(!gitUtils.isDeltaNormalFile(delta) || gitUtils.isDeltaBinaryFile(delta)) {
          continue;
        }

        if(gitUtils.isDeltaDeletedFile(delta)) {
          // TODO
        } else if(gitUtils.isDeltaNewFile(delta)) {
          // TODO
        } else {
          console.log("diff file:", delta.newFile().path());
          paths.push(delta.newFile().path());
        }
      }

      if(paths.length > 0) {
        promises.push(self.getDiffStats(diff, paths));
      }
    });

    if(promises.length > 0) {
      Promise.all(promises).then(function(stats) {
        next();
      }).catch(function(err) {
        console.log("here error");
        console.trace(err);
      });
    } else {
      next();
    }
  }

}
*/
