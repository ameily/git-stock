
var multiline_subject = {
    id: 'commit.subject.multiline',
    name: "Multiple line subjects",
    description: "Checks if the commit subject spans multiple lines.",
    config: {
        penalty: -0.2
    },

    processCommit: function(commit) {
        var self = this;

        _.each(commit.body.split('\n'), function(line) {
            if(line.length > this.config.width) {
                commit.deduct(self, self.config.penalty);
            }
        });
    }
};

var message_line_width = {
    id: 'commit.body.line_width',
    name: "Commit body max line width",
    description: "Checks if the any of the commit body lines exceed a maximum width.",

    config: {
        maxWidth: 80,
        penalty: -0.05
    },

    processCommit: function(commit) {
        var self = this;

        _.each(commit.body.split('\n'), function(line) {
            if(line.length > this.config.maxWidth) {
                commit.deduct(self, self.config.penalty);
            }
        });
    }
};

var message_trailing_whitesspace = {
    id: 'commit.body.trailing_space',
    name: "Commit body contains trailing whitespace",
    description: "Checks if the commit body contains trailing whitespace.",

    config: {
        penalty: -0.1
    },

    processCommit: function(commit) {
        if(commit.body[commit.body.length-1] in ['\t', ' ', '\r', '\n']) {
            commit.deduct(self, self.config.penalty);
        }
    }
};


module.export = [
    multiline_subject, message_line_width, message_trailing_whitesspace
];

