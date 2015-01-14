
var EventEmitter = require('events').EventEmitter;
var GitInterface = require('./git');
var models = require('./models');
var _ = require('underscore');
var util = require('util');
var async = require('async');


var Commit = models.Commit,
    Stock = models.Stock,
    Market = models.Market;

var MarketController = function(attrs) {
    EventEmitter.call(this);

    this.market = attrs.market;
    this.stocks = attrs.stocks || [];
    this.git = new GitInterface({
        path: this.market.path
    });

    this.initialize = function(cb) {
        var self = this;

        // Get Stocks
        Stock.find({ market: this.market._id }, function(err, stocks) {
            _.each(stocks, function(stock) {
                self.stocks.push(stock);
                //self.emit("stock", stock);
            });
            if(cb) cb();
        });
    };

    this.processCommit = function(hash, branch, cb) {
        var self = this;
        this.git.getCommit(hash, function(commit) {
            Commit.findOne({ market: self.market._id, hash: hash }, function(err, found) {
                if(found) {
                    if(branch && !(branch in found.branches)) {
                        found.branches.push(branch);
                        console.log("Add Branch: %s [%s]", branch, hash);
                        found.save(cb);
                    }
                } else {
                    console.log("New Commit: %s", commit.hash);
                    var entry = new Commit({
                        hash: commit.hash,
                        branches: branch ? [branch] : [],
                        market: self.market._id
                    });
                    entry.save(cb);

                    //self.emit("commit", commit);
                }

                //cb();
            });
        });
    };

    this.processCommitRange = function(before, after, branch, cb) {
        var self = this;

        this.git.getCommitList(before, after, function(commits) {
            async.eachLimit(commits, 5, function(commit, commitCb) {
                self.processCommit(commit, branch, commitCb);
            }, cb);
        });
    };

    this.importRepo = function(done) {
        var self = this;

        this.git.getBranchList(function(branches) {
            async.eachLimit(branches, 5, function(branch, branchCb) {
                console.log("New Branch: %s [%s]", branch.name, branch.head);
                self.git.getCommitList(branch.head, function(commits) {
                    async.eachLimit(commits, 5, function(commit, commitCb) {
                        self.processCommit(commit, branch.name, commitCb);
                    }, branchCb);
                });
            }, done);
            /*
            _.each(branches, function(branch) {
                console.log("New Branch: %s [%s]", branch.name, branch.head);
                self.git.getCommitList(branch.head, function(commits) {
                    _.each(commits, function(commit) {
                        self.processCommit(commit);
                    });
                });
            });
            if(cb) cb();
            */
        });
    };

    this.getStockByEmail = function(user, create) {
        var id = user.email.toLowerCase();
        if(id in this.stocks) {
            return this.stocks[id];
        } else if(create) {
            var stock = new Stock({
                email: user.email,
                name: user.name,
                market: this._id,
                price: 0
            });

            this.emit("stock", stock);
            return stock;
        }
        return null;
    };

    this.post = function(evt) {
        /*
        {
            target: <commit>,
            stock: <stock>,
            shares: +/-,
            price: +/-
        }
        */
        var value = this.market.value;
        if(evt.shares) {

        }

        if(evt.price) {

        }

        this.emit('post', evt, this);
    };
};

util.inherits(MarketController, EventEmitter);

module.exports = MarketController;