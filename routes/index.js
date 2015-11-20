var express = require('express');
var router = express.Router();
var Economy = require('../core/econ');

/* GET home page. */
router.get('/:id', function(req, res, next) {
  var driver = Economy.getMarket(req.params.id);
  if(driver == null) {
    res.status(404).end();
  } else {
    res.render('lifetime', { id: req.params.id });
  }
});

module.exports = router;
