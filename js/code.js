d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};

/////////////////////////////////////////////////////////////////// Constants
var startDay = new XDate(2012, 9, 29),
    endDay = new XDate(2013, 28, 4),
    width = 500,
    height = 950;

/////////////////////////////////////////////////////////////////// Classes
function Category(code, description) {
  this.code = code;
  this.description = description;
}

function Postcode(postcode) {
  this.postcode = postcode;
  this.spending = 0;
}

Postcode.prototype.getPostcodeForAxis = function() {
  return this.postcode;
};

/////////////////////////////////////////////////////////////////// Array of postal codes
var postcodes = [];
postcodes.getPostcode = function(postcode)
{
  var result = null;
  this.some(function(element) {
    if (element.postcode === postcode) {
      result = element;
      return true;
    }
    return false;
  });
  return result;
};

for(i = 1; i < 56; i++) {
  var postcode = "280" + (i < 10 ? '0' + i : i);
  postcodes.push(new Postcode(postcode));
}

/////////////////////////////////////////////////////////////////// Array of categories
var categories = [new Category("all", "All"),
  new Category("es_auto", "Auto"),
  new Category("es_barsandrestaurants", "Bars and restaurants"),
  new Category("es_contents", "Books and press"),
  new Category("es_fashion", "Fashion"),
  new Category("es_food", "Food"),
  new Category("es_health", "Health"),
  new Category("es_home", "Home"),
  new Category("es_hotelservices", "Accomodation"),
  new Category("es_hyper", "Hypermarkets"),
  new Category("es_leisure", "Leisure"),
  new Category("es_otherservices", "Other services"),
  new Category("es_propertyservices", "Real state"),
  new Category("es_sportsandtoys", "Sport and toys"),
  new Category("es_tech", "Technology"),
  new Category("es_transportation", "Transport"),
  new Category("es_travel", "Travel"),
  new Category("es_wellnessandbeauty", "Wellness and beauty")];

/////////////////////////////////////////////////////////////////// Get postcode from geoJson
geoJsonPostcodes.features.getPostcode = function(postcode)
{
  var result = null;
  this.some(function(element) {
    if (element.properties.name === postcode) {
      result = element;
      return true;
    }
    return false;
  });
  return result;
};

/////////////////////////////////////////////////////////////////// View model
var arr = ko.utils.arrayMap(postcodes, function(item) {
  return item.postcode;
});

var viewModel = {
  availablePostcodes: ko.observableArray(ko.utils.arrayMap(postcodes, function(item) { return item.postcode; })),
  selectedPostcode: ko.observable("28001"),
  availableCategories: ko.observableArray(categories),
  selectedCategory: ko.observable(categories[0]),
  calculationMethod: ko.observable("total"),
  startDate: ko.observable(startDay),
  endDate: ko.observable(startDay.clone().addDays(6)),
  orderBySpending: ko.observable(false),
  hoverPostcodeOnMap: ko.observable(""),
  hoverPostcodeOnChart: ko.observable("")
};

var currentPostcode = viewModel.selectedPostcode(),
  currentCategory = viewModel.selectedCategory(),
  currentCalculationMethod = viewModel.calculationMethod(),
  currentOrderBySpending = viewModel.orderBySpending();

/////////////////////////////////////////////////////////////////// Accounting.js setup
accounting.settings = {
  currency: {
    symbol : "\u20AC",   // default currency symbol is '$'
    format: "%s %v", // controls output: %s = symbol, %v = value/number (can be object: see below)
    decimal : ",",  // decimal point separator
    thousand: ".",  // thousands separator
    precision : 2   // decimal places
  },
  number: {
    precision : 2,  // default precision on numbers is 0
    thousand: ".",
    decimal : ","
  }
}

/////////////////////////////////////////////////////////////////// Map
var map = L.map('map', { scrollWheelZoom: false }).setView([40.477, -3.6833], 11)
  .addLayer(new L.TileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    opacity: 0.5
  }));

var svgMap = d3.select(map.getPanes().overlayPane).append("svg"),
g = svgMap.append("g").attr("class", "leaflet-zoom-hide");

var mapTooltip = d3.select("#map").append("div").attr("class", "tooltip hidden");
    
var transform = d3.geo.transform({point: projectPoint}),
    path = d3.geo.path().projection(transform);

var color = d3.scale.quantile()
  .range(["rgb(155, 225, 251)", "rgb(65, 206, 248)", "rgb(0, 174, 235)",
          "rgb(0, 147, 226)", "rgb(0, 101, 186)", "rgb(0, 63, 141)"]);

// Map legend
var legend = L.control({position: 'topright'});
legend.onAdd = function (map) {var div = L.DomUtil.create('div', 'legend'); return div};
legend.addTo(map);

var svgLegend;
var xLegend;
var xAxisLegend;

function drawMap() { 
  color.domain([d3.min(geoJsonPostcodes.features, function(d) { return d.properties.spending; }),
                d3.max(geoJsonPostcodes.features, function(d) { return d.properties.spending; })]);
  
  var features = g.selectAll("path")
    .data(geoJsonPostcodes.features)
    .enter()
    .append("path")
      .attr("d", path)
      .attr("class", function(d) {
        if (d.properties.name === viewModel.selectedPostcode()) {
          d3.select(this).moveToFront();
          return "postcode selected";
        }
        return "postcode";
      })
      .attr("id", function(d) { return "map" + d.properties.name; })
      .style("fill", function(d) { return spendingToColor(d); })

  map.on("viewreset", reset);
  reset(); 

  function reset() {
    bounds = path.bounds(geoJsonPostcodes);

    var topLeft = bounds[0],
        bottomRight = bounds[1];

    svgMap.attr("width", bottomRight[0] - topLeft[0])
      .attr("height", bottomRight[1] - topLeft[1])
      .style("left", topLeft[0] + "px")
      .style("top", topLeft[1] + "px");

    g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");
    features.attr("d", path)
      .on("mouseover",function(d) {
        viewModel.hoverPostcodeOnChart("#bar" + d.properties.name);
        d3.select(this).moveToFront();
      })
      .on("mousemove", function(d, i) {
        var mouse = d3.mouse(this);
        var topleft = map.latLngToLayerPoint(new L.LatLng(map.getBounds()._northEast.lat, map.getBounds()._southWest.lng));

        mapTooltip.classed("hidden", false)
          .attr("style", "left:" + (mouse[0] - topleft.x + 15) + "px;top:" + (mouse[1] - topleft.y - 40) + "px")
          .html("Postcode: " + d.properties.name + "<br/>Spending: " + accounting.formatMoney(d.properties.spending))
      })
        .on("mouseout",  function(d, i) {
          viewModel.hoverPostcodeOnChart("");
          mapTooltip.classed("hidden", true)
          d3.select(".postcode.selected").moveToFront();
      })
      .on("click", function(d){
        viewModel.selectedPostcode(d.properties.name);
      });
  }

  // Adding legend to map	
  xLegend = d3.scale.linear()
    .domain(color.domain())
    .range([0, 400]);

  xAxisLegend = d3.svg.axis()
    .scale(xLegend)
    .orient("top")
    .tickSize(1)
    .tickValues(color.quantiles());

    svgLegend = d3.select(".legend.leaflet-control").append("svg")
      .attr("id", 'legend')
      .attr("width", 450)
      .attr("height", 50);

    var gLegend = svgLegend.append("g")
      .attr("class", "key")
      .attr("transform", "translate(25,16)");

  gLegend.selectAll("rect")
    .data(color.range().map(function(d, i) {
      var t ={
        x0: i ? xLegend(color.quantiles()[i - 1]) : xLegend.range()[0],
        x1: i < color.quantiles().length ? xLegend(color.quantiles()[i]) : xLegend.range()[1],
        z: d
      };
      return t;
    }))
    .enter().append("rect")
    .attr("height", 10)
    .attr("x", function(d) { return d.x0; })
    .attr("width", function(d) { return d.x1 - d.x0; })
    .style("fill", function(d) { return d.z; });

  gLegend.append("g")
    .attr("class", "x-legend")
    .call(xAxisLegend);
}

function updateMap() {  
  color.domain([d3.min(geoJsonPostcodes.features, function(d) { return d.properties.spending; }),
                d3.max(geoJsonPostcodes.features, function(d) { return d.properties.spending; })]);

  d3.select(".postcode.selected").classed("selected", false);

  xLegend.domain(color.domain());	
  xAxisLegend.tickValues(color.quantiles());
  svgLegend.select(".x-legend").transition().call(xAxisLegend);

  svgMap.selectAll("path")
    .data(geoJsonPostcodes.features)
      .attr("d", path)
      .attr("id", function(d) { return "map" + d.properties.name; })
      .attr("class", function(d) {
      return d3.select(this).attr("class") + (d.properties.name === viewModel.selectedPostcode() ?  " selected" : "");
    })
    .style("fill", function(d) { return spendingToColor(d); });

  d3.selectAll(".postcode").classed("hover", false);
  d3.select(".postcode.selected").moveToFront();
}

function spendingToColor(feature) {
  //Get data value
  var value = feature.properties.spending;
  if (value) {
    //If value exists…
    return color(value);
  }
  else {
    //If value is 0 or undefined…
    return "#ccc";
  }
}

// Use Leaflet to implement a D3 geometric transformation.
function projectPoint(x, y) {
  var point = map.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}

/////////////////////////////////////////////////////////////////// Chart
var margin = {top: 30, right: 30, bottom: 10, left: 40},
    widthChart = width - margin.left - margin.right,
    heightChart = height - margin.top - margin.bottom;

var x = d3.scale.ordinal()
  .rangeRoundBands([0, heightChart], .1);

var y = d3.scale.linear()
  .rangeRound([0, widthChart]);

var xAxis = d3.svg.axis()
  .scale(x)
  .orient("left");

var yAxis = d3.svg.axis()
  .scale(y)
  .orient("top")
  .tickFormat(d3.format(".2s"));

var chartTooltip = d3.tip()
  .attr('class', 'd3-tip')
  .offset([-10, 0])
  .html(function(d) { return accounting.formatMoney(d.spending); });

var svg = d3.select("#chart").append("svg")
  .attr("width", widthChart + margin.left + margin.right)
  .attr("height", heightChart + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
   
svg.call(chartTooltip);

function drawChart() {
  x.domain(postcodes.map(function(d) { return d.getPostcodeForAxis(); }));
  y.domain([0, d3.max(postcodes, function(d) { return d.spending; })]);

  svg.append("g")
    .attr("class", "x axis")
    .call(xAxis);

  svg.append("g")
   	.attr("class", "y axis")
   	.call(yAxis)
    .append("text")
      .attr("class", "y-legend")
      .attr("y", 11)
      .attr("x", widthChart)
      .style("text-anchor", "end")
      .text(function() {
        switch(viewModel.calculationMethod()) {
          case "total":
            return "Spending (\u20AC)";
            break;
          case "perPayment":
            return "Average spending per payment (\u20AC)";
            break;
          case "perCard":
            return "Average spending per card (\u20AC)";
            break;
          default:
            break;
        }
      });

  svg.selectAll(".bar")
    .data(postcodes)
    .enter()
    .append("rect")
      .attr("class", function(d) {
      return "bar" + (d.postcode === viewModel.selectedPostcode() ?  " selected" : "");
    })
      .attr("id", function(d) { return "bar" + d.postcode; })
      .attr("x", 1)
      .attr("y", function(d) { return x(d.getPostcodeForAxis()); })
      .attr("height", x.rangeBand())
      .attr("width", function(d) { return y(d.spending) - y(0); })
      .on("click", function(d) {
        viewModel.selectedPostcode(d.postcode);
      })
      .on('mouseover', function(d) {
        viewModel.hoverPostcodeOnMap("#map" + d.postcode);
        chartTooltip.show(d);
      })
      .on('mouseout', function(d) {
        viewModel.hoverPostcodeOnMap("");	
        d3.select(".postcode.selected").moveToFront();
        chartTooltip.hide(d);
      });
};

function updateChart() {
  d3.select(".bar.selected").classed("selected", false);

  var pcArray = postcodes.slice(0);
  if (viewModel.orderBySpending()) { 
    x.domain(pcArray.sort(function(a, b) { return d3.descending(a.spending, b.spending); }).map(function(d) { return d.getPostcodeForAxis(); }))
  }
  else {
    x.domain(pcArray.map(function(d) { return d.getPostcodeForAxis(); }));
  }
  svg.select(".x.axis").transition().call(xAxis);
   
  y.domain([0, d3.max(postcodes, function(d) { return d.spending; })]);
  svg.select(".y.axis").transition().call(yAxis);

  svg.select(".y-legend")
    .transition()
    .text(function() {
      switch(viewModel.calculationMethod()) {
        case "total":
          return "Spending (\u20AC)";
          break;
        case "perPayment":
          return "Average spending per payment (\u20AC)";
          break;
        case "perCard":
          return "Average spending per card (\u20AC)";
          break;
        default:
          break;
      }
    });

  svg.selectAll("rect")
    .data(pcArray)
    .transition()
    .attr("id", function(d) { return "bar" + d.postcode; })
      .attr("y", function(d) { return x(d.getPostcodeForAxis()); })
      .attr("width", function(d) { return y(d.spending) - y(0); })
      .attr("class", function(d) {
      return d3.select(this).attr("class") + (d.postcode === viewModel.selectedPostcode() ?  " selected" : "");
    });
}

/////////////////////////////////////////////////////////////////// Time slider

new Dragdealer('time-slider',
{
  steps: 25,
  snap: true,
  animationCallback: function(x, y) {
    var start = startDay.clone().addWeeks(Math.floor(25*x));
    var end = start.clone().addDays(6);
    viewModel.startDate(start);
    viewModel.endDate(end);
  },
  callback: function(x, y)
  {
    requestDataAndDraw(updateChart, updateMap);
  }
});

/////////////////////////////////////////////////////////////////// BBVA API request
$(document).ready(function() {
  requestDataAndDraw(drawChart, drawMap);	
});

function requestDataAndDraw(chartFunc, mapFunc) {
  var url = "https://api.bbva.com/apidatos/zones/customer_zipcodes.json?date_min="
    + viewModel.startDate().toString("yyyyMMdd") + "&date_max=" + viewModel.startDate().toString("yyyyMMdd") + "&group_by=week&time_window=1&zipcode="
    + viewModel.selectedPostcode() + "&zoom=2&category=" + viewModel.selectedCategory().code + "&by=incomes";

  $.ajax({
    url : url,
    method : 'GET',
    beforeSend : function(req) {
      req.setRequestHeader('Authorization', "MTIzYWJjNDU2ZGVmOjc2YjE4M2JhOTRlM2RhYzUyMjM2YjU2YTQ3MDRkY2IzOWMwNDMyNTM=");
    },
    complete: function() {
    },
    error: function(xhr, text, error) {
      $(".error").slideDown();
    },
    success: function(obj) {
      $(".error").slideUp();

      var zipcodes = obj.data.stats[0].zipcodes;
      for (var i = 0; i < postcodes.length; i++) {
        postcodes[i].spending = 0;
        var pc = geoJsonPostcodes.features.getPostcode(postcodes[i].postcode);
        if (pc) {
          pc.properties.spending = 0;
        }
      }

      for (var i = 0; i < zipcodes.length; i++) {
        var value = zipcodes[i].incomes;
        switch(viewModel.calculationMethod()) {
          case "perPayment":
            value = zipcodes[i].incomes/zipcodes[i].num_payments;
            break;
          case "perCard":
            value = zipcodes[i].incomes/zipcodes[i].num_cards;
            break;
          default:
            break;
        }

        var pc = postcodes.getPostcode(zipcodes[i].label);
        if (pc) {
          pc.spending = value;
        }
        var geoPc = geoJsonPostcodes.features.getPostcode(zipcodes[i].label);
        if (geoPc) {
          geoPc.properties.spending = value;
        }
      }

      mapFunc();
      chartFunc();
    }
  });
}

ko.computed(function() {
  if (viewModel.selectedPostcode() !== currentPostcode) {
    currentPostcode = viewModel.selectedPostcode();
    requestDataAndDraw(updateChart, updateMap);
  }
});

ko.computed(function() {
  if (viewModel.selectedCategory() !== currentCategory) {
    currentCategory = viewModel.selectedCategory();
    requestDataAndDraw(updateChart, updateMap);
  }    
});

ko.computed(function() {
  if (viewModel.calculationMethod() !== currentCalculationMethod) {
    currentCalculationMethod = viewModel.calculationMethod();
    requestDataAndDraw(updateChart, updateMap);
  }    
});

viewModel.startDateText = ko.computed(function() {
  return viewModel.startDate().toString("MMM d, yyyy");
});

viewModel.endDateText = ko.computed(function() {
  return viewModel.endDate().toString("MMM d, yyyy");   
});

ko.computed(function() {
  if (viewModel.orderBySpending() !== currentOrderBySpending) {
    currentOrderBySpending = viewModel.orderBySpending();
    updateChart();
  }
});

ko.computed(function() {
  d3.selectAll(".postcode").classed("hover", false);
  if (viewModel.hoverPostcodeOnMap() !== "") {
    d3.select(viewModel.hoverPostcodeOnMap()).classed("hover", true).moveToFront();
  }
});

ko.computed(function() {
  d3.selectAll(".bar").classed("hover", false);
  if (viewModel.hoverPostcodeOnChart() !== "") {
    d3.select(viewModel.hoverPostcodeOnChart()).classed("hover", true);
  }
});

ko.applyBindings(viewModel);