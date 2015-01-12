
var mongoose = require('mongoose');


var MarketSchema = new mongoose.Schema({
    groups: [String],
    path: String,
    name: String,
    value: Number,
    symbol: String
});
export.Market = mongoose.Model('Market', MarketSchema);


var StockSchema = new mongoose.Schema({
    email: String,
    market: {
        type: mongoose.Schema.ObjectId,
        ref: "Market"
    },
    price: Number
});
export.Stock = mongoose.Model('Stock', StockSchema);





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
    price: Number,
    timestamp: Number
});

