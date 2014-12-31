
var base_commit = {
    id: 'commit',
    name: "Commit reward",
    description: "Base reward for a single commit",

    config: {
        value: 10
    },

    processCommit: function(commit, config) {
        if(commit.author) {
            commit.(this, config.value);
        }
    }
};

var mainline_commit = {
    id: 'commit.mainline',
    name: "Commit merged into mainline branch",
    description: ""
};

