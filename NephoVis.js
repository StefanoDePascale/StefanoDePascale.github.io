var color = d3.scaleOrdinal(d3.schemeCategory10);
var shape = d3.scaleOrdinal(d3.symbols);
var size = d3.scaleLinear()
.range([40, 200]); // remember to set the domain (current variable) before assigning a value

// Make svg responsive with script from: https://brendansudol.com/writing/responsive-d3
function responsivefy(svg) {
// get container + svg aspect ratio
    var container = d3.select(svg.node().parentNode),
    width = parseInt(svg.style("width")),
    height = parseInt(svg.style("height")),
    aspect = width / height;

    // add viewBox and preserveAspectRatio properties,
    // and call resize so that svg resizes on inital page load
    svg.attr("viewBox", "0 0 " + width + " " + height)
    .attr("perserveAspectRatio", "xMinYMid")
    .call(resize);

    // to register multiple listeners for same event type, 
    // you need to add namespace, i.e., 'click.foo'
    // necessary if you call invoke this function for multiple svgs
    // api docs: https://github.com/mbostock/d3/wiki/Selections#on
    d3.select(window).on("resize." + container.attr("id"), resize);

    // get width of container and resize svg to fit it
    function resize() {
        var targetWidth = parseInt(container.style("width"));
        svg.attr("width", targetWidth);
        svg.attr("height", Math.round(targetWidth / aspect));
    }
}

// EXTRACT THE NAME OF THE MODEL FROM THE URL!!  (by Thomas) 
function getUrlParameter(sParam) {
var sPageURL = decodeURIComponent(window.location.search.substring(1)),
    sURLVariables = sPageURL.split('&'),
    sParameterName,
    i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
}
}

// Generate complementary colors for the circle on hover
function compColor(col) {
    res = d3.hsl(col);
    hue = res['h'];
    newHue = +hue < 180 ? +(hue + 180) : +(hue-180);
    res['h'] = newHue;
    return(res.toString());
    }

// Short function to obtain the possible values of a variable
function getValues(dataset, colname) {
    return(d3.map(dataset, function(d) {return d[colname]}).keys());
}

function cleanStor(item) {
    localStorage.setItem(item, JSON.stringify(null));
    }

function classify_colnames(dataset) {
    var colnames, variables, nominals, numerals, contexts
    
    colnames = d3.keys(dataset[0]);
    variables = colnames.filter(function(d) {
        return (!d.endsWith('.x') &&
        !d.endsWith('.y') &&
        !d.startsWith("_") &&
        getValues(dataset, d).length > 1);
    });
    nominals = variables.filter(function(d) {
        return (!getValues(dataset, d).every(function(d) {return(!isNaN(d)); }));
    }).filter(function(d) {
        return (getValues(dataset, d).length <= 10);
    });
    nominals.push("Reset");

    numerals = variables.filter(function(d) {
        return(getValues(dataset, d).every(function(d) {return(!isNaN(d)); }));
    });
    numerals.push("Reset");

    contexts = colnames.filter(function(d) {
        return(d.startsWith('_ctxt'));
    });

    return({
        "all" : colnames,
        "variables" : variables,
        "nominals" : nominals,
        "numerals" : numerals,
        "contexts" : contexts
    });
}

function varFromLS(dataset, variable, level, type) {
    var LS, name, values;
    LS = JSON.parse(localStorage.getItem(level + variable + "var-" + type));
    name = LS == null ? undefined : LS;
    values = typeof(name) == 'string' ? getValues(dataset, name) : +0;
    return({
        "variable" : name,
        "values" : values
    });
}

function listFromLS(variable) {
    var LS = JSON.parse(localStorage.getItem(variable));
    return(LS == null ? [] : LS);
}

function updateVar(dataset, variable, name, level, type) {
    if (name == 'Reset') {
        varset = {
            "variable" : null,
            "values" : +0
        }
    } else {
        var values = getValues(dataset, name);
        values = isNaN(values[0]) ? values : values.map(function(d) {
            return +d;}).sort(function(a, b){return a-b});
        varset = {
            "variable" : name,
            "values" : values
        }
    }
    localStorage.setItem(level + variable + "var-" + type, JSON.stringify(varset['variable']));
    return(varset);
}

function code(d, variable, schema, default_value){
    if (variable['variable'] == null) {
        return(default_value);
    } else {
        if (isNaN(default_value)) {
            return(schema(variable['values'].indexOf(d[variable['variable']])));
        } else {
            schema.domain(d3.extent(variable['values']));
            return(schema(+d[variable['variable']]));
        }
    }
}

function buildDropdown(where, data,
    value_function = function(d) {return(d); },
    text_function = function(d) {return(d); }){
    return(
        d3.select("#" + where)
            .selectAll("button")
            .data(data).enter()
                .append("button")
                .attr("class", "dropdown-item " + where.slice(0, 3))
                .attr("xlink:href", "#")
                .attr("value", value_function)
                .text(text_function)
            );
}

function traceCenter(p, x1, x2, y1, y2) {
    return(
    p.append("line")
        .attr("x1", x1)
        .attr("x2", x2)
        .attr("y1", y1)
        .attr("y2", y2)
        .attr("stroke", "lightgray")
        .attr("stroke-width", 1)
        );
}

function exists(t, model) {
    return (d3.format('.3r')(t[model + '.x']) != '0.00' || d3.format('.3r')(t[model + '.y']) != '0.00');
  }

// Update Legends after each dropdown is changed
function spaceLegend(values, lCWidth) {
    var based_on_length = Math.max.apply(Math, values.map(function(d) {return(d.length); }))*10;
    var last_item_length = values[values.length-1].length * 5
    var based_on_space = (lCWidth-last_item_length)/values.length;
    return(Math.min(based_on_length, based_on_space));
  }

function updateLegend(colorvar, shapevar, sizevar, padding, level, type, dataset) {
    var legendList, legendContainer;
    var lCWidth;
    var colorvalues, shapevalues, sizevalues;

    legendList = [];
    legendContainer = d3.select("#legendContainer");
    lCWidth = parseInt(legendContainer.style('width'));
    legendContainer.selectAll("svg").remove();

    colorvalues = colorvar['values'];
    shapevalues = shapevar['values'];
    sizevalues = sizevar['values'];
    
    // Update color legend
    if (typeof(colorvalues) != 'number'){
        // colorvalues.sort();

        var colorscale = d3.scaleOrdinal()
            .domain(colorvalues)
            .range(colorvalues.map(function(d) {
                return(color(colorvalues.indexOf(d)));}));
        
        legendColor = d3.legendColor()
            .shape("path", d3.symbol()
                .type(d3.symbolCircle)
                .size(50)())
            .orient("horizontal")
            .shapePadding(spaceLegend(colorvalues, lCWidth))
            .scale(colorscale)
            .title(colorvar['variable'])
            .on("cellclick", function(d) {
                colorselection = listFromLS("colorsel-" + level + '-' + type);
                if (colorselection.indexOf(d) > -1) {
                  colorselection.splice(colorselection.indexOf(d), 1);
                  } else {
                  colorselection.push(d);
                  }
                localStorage.setItem("colorsel-" + level + '-' + type, JSON.stringify(colorselection));
                if (colorselection.length > 0) {
                  selection = d3.map(dataset, function(d) {
                      if (colorselection.indexOf(d[colorvar['variable']]) > -1) {
                          var id = level == 'model' ? '_model' : '_id';
                          return(d[id]);
                        }
                    }).keys();
                  } else {
                  selection = [];
                  }
                updateSelection(selection, level, type);
              });;

        legendContainer.append("svg")
            .attr("width", lCWidth)
            .attr("height", 80)
            .attr("transform", "translate(0,0)")
            .attr("id", "legendColor")
            .append("g")
                .attr("class", "legend")
                .attr("transform", "translate(" + 0 + ", " + padding/2 + ")")
                .call(legendColor);

        legendList.push('color');
        
        } else {
            if (legendList.indexOf('color') > -1) {
                legendList.splice(indexOf('color'), 1);
            }
            legendContainer.select("#legendColor").remove();
        }

    // Update shape legend
    if (typeof(shapevalues) != 'number'){
        var shapescale = d3.scaleOrdinal()
            .domain(shapevalues)
            .range(shapevalues.map(function(d) {
                return(d3.symbol()
                    .type(shape(shapevalues.indexOf(d)))());
            }));
        
        legendShape = d3.legendSymbol()
            .scale(shapescale)
            .orient("horizontal")
            .shapePadding(spaceLegend(shapevalues, lCWidth))
            .title(shapevar['variable'])
            .on("cellclick", function(d) {
                shapeselection = listFromLS("shapesel-" + level + '-' + type);
                if (shapeselection.indexOf(d) > -1) {
                    shapeselection.splice(shapeselection.indexOf(d), 1);
                  } else {
                    shapeselection.push(d);
                  }
                localStorage.setItem("shapesel-" + level + '-' + type, JSON.stringify(shapeselection));
                if (shapeselection.length > 0) {
                  selection = d3.map(dataset, function(d) {
                      if (shapeselection.indexOf(d[shapevar['variable']]) > -1) {
                          var id = level == 'model' ? '_model' : '_id';
                          return(d[id]);
                        }
                    }).keys();
                  } else {
                  selection = [];
                  }
                updateSelection(selection, level, type);
              });

        // halign = legendList.indexOf('color') == -1 ? 0 : 150;
        
        legendContainer.append("svg")
            .attr("width", lCWidth)
            .attr("height", 80)
            .attr("transform", "translate(0,0)")
            .attr("id", "legendShape")
            .append("g")
                .attr("class", "legend")
                .attr("transform", "translate(" + 0 + ", " + padding/2 + ")")
                .call(legendShape);

        legendList.push('shape');
        
        } else {
            if (legendList.indexOf('shape') > -1) {
                legendList.splice(legendList.indexOf('shape'), 1);
            }
            legendContainer.select("#legendShape").remove();
        }

    // Update size legend
    if (typeof(sizevalues) != 'number'){
        var sizescale = d3.scaleLinear()
            .domain(d3.extent(sizevalues))
            .range([5, 8]);
        var smallNumbers = (sizescale.domain()[1]-sizescale.domain()[0])/(sizevalues.length-1) < 1;
        
        legendSize = d3.legendSize()
            .shape('circle')
            .orient("horizontal")
            .shapePadding(20)
            .labelOffset(15)
            .scale(sizescale)
            .title(sizevar['variable'])
            .cells(sizevalues.length >= 5 ? 5 : sizevalues.length)
            .labelFormat(smallNumbers ? ".04r" : ".0d");           
        // no selection through size
        
        legendContainer.append("svg")
            .attr("width", lCWidth)
            .attr("height", 80)
            .attr("transform", "translate(0,0)")
            .attr("id", "legendSize")
            .append("g")
                .attr("class", "legend")
                .attr("transform", "translate(" + 0 + ", " + padding/2 + ")")
                .call(legendSize);

        legendList.push('size');
        
        } else {
            if (legendList.indexOf('size') > -1) {
                legendList.splice(legendList.indexOf('size'), 1);
            }
            legendContainer.select("#legendSize").remove();
        }
    }

function updateSelection(selection, level, type) {
    if (selection.length > 0 && selection.indexOf("undefined") > -1) {
        selection.splice(selection.indexOf("undefined"), 1);
      }
    localStorage.setItem(level + "selection-" + type, selection.length > 0 ? JSON.stringify(selection) : JSON.stringify(null));
    // if something is selected everything else is translucent
    d3.selectAll(".dot")
        .selectAll("path.graph")
        .classed("lighter", function(d) {
            var id = level == 'model' ? "_model" : "_id";
            return (selection.length > 0 ? selection.indexOf(d[id]) === -1 : false);
        });
}
function checkBoxSections(where, data, dataset) {
    d3.select("#" + where).selectAll("div")
      .data(data)
      .enter()
      .append("div")
      .attr("class", "btn-group-toggle")
      .attr("data-toggle", "buttons")
      .each(appendCheckbox);

      function appendCheckbox(p) {
        var butgroup = d3.select(this);
    
        var buttext = (p.startsWith("socc") || p.startsWith("focc")) ? p.split("_").splice(1).join(" ") : p.split("_").join(" ");
    
        butgroup.append("p")
          .attr("class", "mb-0 mt-2")
          .style("font-weight", "bold")
          .text("Select " + buttext);
    
        butgroup.selectAll("label")
          .data(getValues(dataset, p))
          .enter()
          .append("label")
          .attr("class", "btn btn-secondary py-0 m-0")
          .attr("parent", p)
          .text(function(d) {return(d); })
          .append("input")
          .attr("type", "checkbox")
          .attr("autocomplete", "off")
          .attr("id", function(d) {return(p + ":" + d); });
      }
  }

function setTooltip() {
    return(
        d3.select("body").append('div')
          .attr("class", "tooltip")
          .attr("width", 100)
          .attr("height", 20)
          .style('position', 'absolute')
          .style("opacity", 0)
    );
}

function setPointerEvents(svg, width, height) {
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("transform", "translate(0,0)")
        .style("pointer-events", "all")
        .style("fill", "none");
}