
var _ = require('underscore');

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
  id: 'commit.message.issues',

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
