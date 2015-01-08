
var child_process = require('child_process');
var events = require("events");
var _ = require('underscore');

module.exports = function(attrs) {
    this.path = attrs.path;


    this.getCommitList = function(before, after, cb) {
        var cmd = 'git log --format="%H" ' + before + '...' + after;
        child_process.exec(cmd, function(error, stdout, stderr) {
            var commits = _.filter(stdout.split('\n'), function(hash) { return hash.length > 0; });
            commits.reverse();
            cb(commits);
        }, { cwd: this.path });
    };

    this.parseCommit = function(hash, cb) {
        var cmd = 'git show ' + hash + ' -q --format="%H%n%P%n%an%n%aE%n%B"';
        child_process.exec(cmd, function(error, stdout, stderr) {
            var bodyLines = [];
            var attrs = {};
            _.each(stdout.split('\n'), function(line, i) {
                if(i == 0) {
                    attrs.hash = line;
                } else if(i == 1) {
                    attrs.parentHashes = line.length > 0 ? line.split(' ') : [];
                    attrs.isMerge = self.parentHashes.length > 1;
                } else if(i == 2) {
                    attrs.author = { name: line, email: "" };
                } else if(i == 3) {
                    attrs.author.email = line;
                } else {
                    bodyLines.push(line);
                }
            });

            attrs.body = bodyLines.join('\n');

            var commit = new Commit(attrs);
            cb(commit);
        }, { cwd: this.path });
    };
};


