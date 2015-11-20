var express = require('express');
var router = express.Router();
var Economy = require('../core/econ');



/* GET home page. */
router.get('/:id/lifetime.json', function(req, res, next) {
  var driver = Economy.getMarket(req.params.id);
  driver.getLifetimeData().then(function(data) {
    res.json(data);
  });
});

router.get('/:id/latest.json', function(req, res, next) {
  var driver = Economy.getMarket(req.params.id);
  driver.getLatestDay().then(function(data) {
    res.json(data);
  });
});

module.exports = router;
