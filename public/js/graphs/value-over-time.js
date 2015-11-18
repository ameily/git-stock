
function ValueLifetime(options) {
  this.selector = options.selector;
  this.width = options.width;
  this.margin = options.margin || {
    top: 20,
    left: 80,
    right: 20,
    bottom: 30
  };
  this.$target = $(this.selector);

  this.height = (options.height || 300) - this.margin.top - this.margin.bottom;
  this.width = (options.width || this.$target.width()) - this.margin.left - this.margin.right;

  this.parseDate = d3.time.format("%Y%m%d").parse;

  if(options.data) {
    this.update(options.data);
  }
}


ValueLifetime.prototype.update = function(data) {
  var self = this;

  var svg = d3.select(this.selector)
    .append("svg")
      .attr("width", this.width + this.margin.left + this.margin.right)
      .attr("height", this.height + this.margin.top + this.margin.bottom)
      .append("g")
        .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

  // x axis scale
  var x = d3.time.scale()
    .range([0, this.width]);

  // y value axis scale
  var valueY = d3.scale.linear()
    .range([this.height, 0]);

  // x axis
  var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

  // y value axis
  var valueAxis = d3.svg.axis()
    .scale(valueY)
    .orient("left");

  // value line
  var valueLine = d3.svg.line()
    .x(function(d) { return x(d.date); })
    .y(function(d) { return valueY(d.value); });

  // create Date objects from their string value
  var maxValue = 0;
  data.forEach(function(d) {
    d.date = self.parseDate(d.date);
    maxValue = d.value < maxValue ? maxValue : d.value;
  });

  // set the Y axis tick format
  //- if(maxValue > 30000) {
  //-   valueAxis.tickFormat(function(d) {
  //-     return (d / 1000).toFixed(1).toString() + "K";
  //-   });
  //- }
  valueAxis.tickFormat(function(d) {
    return numeral(d).format('$0,0[.]0a');
  });

  // axis domains
  x.domain(d3.extent(data, function(d) { return d.date; }));
  valueY.domain([0, d3.max(data, function(d) { return d.value; })]);

  // value line
  svg.append("path")
    .datum(data)
    .attr('d', valueLine);

  // x axis
  svg.append("g")
    .attr('class', "x axis")
    .attr('transform', 'translate(0, ' + this.height + ')')
    .call(xAxis);

  // y value axis
  svg.append('g')
    .attr('class', 'y axis')
    .call(valueAxis);
};
