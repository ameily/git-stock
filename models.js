
var mongoose = require('mongoose');
var moment = require('moment');

function getDayTimestamp(ts) {
    if(ts === undefined) {
        ts = moment().unix();
    }
    return ts - (ts % 86400);
}

var valueMixin = function() {
    return this.price * this.shares;
};

var StockDaySummarySchema = new mongoose.Schema({
    stock: {
        type: mongoose.Schema.ObjectId,
        ref: 'Stock'
    },
    price: Number,
    shares: Number,
    timestamp: Number
});
StockDaySummarySchema.virtual('value').get(valueMixin);

var StockDaySummary = mongoose.model('StockDaySummary', StockDaySummarySchema);

var MarketDaySummarySchema = new mongoose.Schema({
    stock: {
        type: mongoose.Schema.ObjectId,
        ref: 'Market'
    },
    shares: Number,
    price: Number,
    timestamp: Number
});
MarketDaySummarySchema.virtual('value').get(valueMixin);

var MarketDaySummary = mongoose.model('MarketDaySummary', MarketDaySummarySchema);


var MarketGroup = mongoose.model('MarketGroup', {
    symbol: String,
    name: String
});


var MarketSchema = new mongoose.Schema({
    symbol: String,
    name: String,
    path: String,
    groups: [String],
    shares: Number,
    price: Number
});

MarketSchema.virtual('value').get(valueMixin);

MarketSchema.methods.getSummaryForToday = function(cb) {
    var market = this;
    var ts = getDayTimestamp();

    MarketDaySummary.findOneAndUpdate({ market: this._id, timestamp: ts }, {
        $setOnInsert: {
            stock: this._id,
            timestamp: ts,
            value: market.value
        }
    }, { new: true, upsert: true }, function() {
        cb(this, market);
    });
};

var Market = mongoose.model('Market', MarketSchema);


var StockSchema = new mongoose.Schema({
    email: String,
    name: String,
    market: {
        type: mongoose.Schema.ObjectId,
        ref: "Market"
    },
    shares: Number,
    price: Number
});

StockSchema.virtual('value').get(valueMixin);

StockSchema.methods.getSummaryForToday = function(cb) {
    var stock = this;
    var ts = getDayTimestamp();

    StockDaySummary.findOneAndUpdate({ stock: this._id, timestamp: ts }, {
        $setOnInsert: {
            stock: this._id,
            timestamp: ts,
            price: stock.price
        }
    }, { new: true, upsert: true }, function() {
        cb(this, stock);
    });
};
var Stock = mongoose.model('Stock', StockSchema);


var CommitSchema = new mongoose.Schema({
    hash: String,
    branches: [String],
    //authorEmail: String,
    //market: {
    //    type: mongoose.Schema.ObjectId,
    //    ref: "Market"
    //}
    market: mongoose.Schema.ObjectId
});
var Commit = mongoose.model('Commit', CommitSchema);



// Exports
////////////////////////////////////////////

module.exports = {
    StockDaySummary: StockDaySummary,
    MarketDaySummary: MarketDaySummary,
    Stock: Stock,
    Market: Market,
    Commit: Commit,
    MarketGroup: MarketGroup
};
