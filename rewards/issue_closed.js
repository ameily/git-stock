
module.export = {
    id: 'reward.commit.issue.close',
    name: "Issue references in commit messages",
    
    config: {
        score: 20,
        regex: [
            /(?:fixes|closes|resolves)\s+#(\d+)/i
        ]
    },

    processCommit: function(commit) {
        var issuesClosed = [];
        _.each(this.config.regex, function(re) {
            //TODO search
        });
    }
};



/*
commit = git show
while commit not in db:
    foreach plugin:
        plugin.processCommit(commit)
    commit = commit.parent
*/

/*
config:

commit.issue.refs.closed = [ ]
commit.issue.

{
    repos: [
        {
            name: 'Metasponse',
            ...
        }
    ],

    config: {
        'rewards.commit.issue.refs': {
            
        }
    }
}




*/