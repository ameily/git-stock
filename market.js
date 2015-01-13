
var Stock = require('./stock');
var EventEmitter = require('events').EventEmitter;
var GitInterface = require('./git');
var StockController = require('./stock');
var Stock = require('./models').stock;



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
                self.emit("stock", stock);
            });
            if(cb) cb();
        });
    };

    this.processCommit = function(hash) {
        var self = this;
        this.git.getCommit(hash, function(commit) {
            self.emit("commit", commit);
        });
    };

    this.processCommitRange = function(before, after) {
        var self = this;

        this.git.getCommitList(before, after, function(commit) {
            commit.stock = self.getStockByEmail(commit.author, true);
            self.emit("commit", commit);
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

export.MarketController = MarketController;