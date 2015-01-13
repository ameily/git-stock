
var child_process = require('child_process');
var _ = require('underscore');


var GitInterface = function(attrs) {
    this.path = attrs.path;

    this.getCommitList = function(before, after, cb) {
        var cmd = 'git log --format="%H" ' + before;
        if(after) {
            cmd += '...' + after;
        }

        child_process.exec(cmd, { cwd: this.path }, function(error, stdout, stderr) {
            var commits = _.filter(stdout.split('\n'), function(hash) { return hash.length > 0; });
            commits.reverse();
            cb(commits);
        });
    };

    this.getCommit = function(hash, cb) {
        var cmd = 'git show ' + hash + ' -q --format="%H%n%P%n%an%n%aE%n%ct%n%B"';
        child_process.exec(cmd, { cwd: this.path }, function(error, stdout, stderr) {
            var bodyLines = [];
            var attrs = {};
            _.each(stdout.split('\n'), function(line, i) {
                if(i == 0) {
                    // hash
                    attrs.hash = line;
                } else if(i == 1) {
                    // parent(s)
                    attrs.parentHashes = line.length > 0 ? line.split(' ') : [];
                    attrs.isMerge = self.parentHashes.length > 1;
                } else if(i == 2) {
                    // author (name)
                    attrs.author = { name: line, email: "" };
                } else if(i == 3) {
                    // author (email)
                    attrs.author.email = line;
                } else if(i == 4) {
                    // timestamp
                    attrs.timestamp = moment.unix(parseInt(line));
                } else {
                    // body
                    bodyLines.push(line);
                }
            });

            attrs.body = bodyLines.join('\n');

            var commit = new Commit(attrs);
            cb(commit);
        });
    };

    this.getBranchList = function(cb) {
        var cmd = 'git for-each-ref --format="%(objectname) %(refname)" refs/heads/*';
        child_process.exec(cmd, { cwd: this.path }, function(error, stdout, stderr) {
            var branches = [];
            _.each(stdout.split('\n'), function(line) {
                if(line.length == 0) {
                    return;
                }

                var parts = line.split(' ');
                var hash = parts[0];
                var branch = parts[1].split('/')[2];

                console.log('Commit: ' + hash);

                branches.push({
                    commit: hash,
                    branch: branch
                });
            });
            cb(branches);
        });
    };

    this.getDiff = function(from, to, cb) {
        
    };
};


module.exports = GitInterface;