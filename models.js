
var mongoose = require('mongoose');
var moment = require('moment');

function getDayTimestamp(ts) {
    if(ts === undefined) {
        ts = moment().unix();
    }
    return ts - (ts % 86400);
}

var StockDaySummary = mongoose.Model('StockDaySummary', {
    stock: {
        type: mongoose.Schema.ObjectId,
        ref: 'Stock'
    },
    price: Number,
    timestamp: Number
});

var MarketDaySummary = mongoose.Model('MarketDaySummary', {
    stock: {
        type: mongoose.Schema.ObjectId,
        ref: 'Market'
    },
    value: Number,
    timestamp: Number
});


var MarketGroup = mongoose.Model('MarketGroup', {
    symbol: String,
    name: String
});


var MarketSchema = new mongoose.Schema({
    groups: [String],
    path: String,
    name: String,
    value: Number,
    symbol: String
});

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

export.Market = mongoose.Model('Market', MarketSchema);


var StockSchema = new mongoose.Schema({
    email: String,
    market: {
        type: mongoose.Schema.ObjectId,
        ref: "Market"
    },
    price: Number
});

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
export.Stock = mongoose.Model('Stock', StockSchema);


var CommitSchema = new mongoose.Schema({
    hash: String,
    branches: [String],
    market: {
        type: mongoose.Schema.ObjectId,
        ref: "Market"
    }
});
export.Commit = mongoose.Model('Commit', CommitSchema);



