
var Stock = require('./stock');
var EventEmitter = require('events').EventEmitter;
var GitInterface = require('./git');


module.exports = function(attrs) {
    EventEmitter.call(this);

    this.path = attrs.path || "";
    this.name = attrs.name || "";
    this.parent = attrs.parent || null;
    this.stocks = attrs.stocks || { };
    this.plugins = attrs.plugins || [];
    this.git = new GitInterface(this.path);

    this.processCommit = function(commit) {
        var self = this;
        _.each(this.plugins, function(plugin) {
            plugin.processCommit(commit, self);
        });
    };

    this.processRange = function(before, after) {
        var self = this;

        this.git.parseCommitList(before, after, function(commit) {
            self.processCommit(commit);
        });
    };

    this.getStockByEmail = function(user, create) {
        var id = user.email.toLowerCase();
        if(id in this.stocks) {
            return this.stocks[id];
        } else if(create) {
            var stock = this.stocks[id] = new Stock({
                email: user.email,
                name: user.name,
                market: this;
            });

            this.emit("newStock", stock);
            return stock;
        }
        return null;
    };

    this.post = function(evt) {
        if(!evt.user) {
            return;
        }

        var self = this;
        var users = _.isArray(evt.user) ? evt.user : [evt.user];
        _.each(users, function(user) {
            var stock = self.getStockByEmail(user, true);
            stock.value += evt.value;
            self.emit("delta", { stock: stock, tick: tick });
        });

        this.emit("post", evt);
    };

    this.getGdp = function() {
        var total = 0;
        _.each(this.stocks, function(stock) {
            total += stock.value;
        });
        return total;
    };
};


