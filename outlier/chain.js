const mapEl = "#interactive-chain";
const histEl = "#chain-hist";
const mapJson = "PA_vtd.json";  // TopoJSON map representation
const mapObj = "PA_vtd_scrubbed";
// Serialized chain runs (hardcoded for ease of swappage)
const chainRuns = [
  "runs/pa_run_0.json",
  "runs/pa_run_1.json",
  "runs/pa_run_2.json",
  "runs/pa_run_3.json",
  "runs/pa_run_4.json"
]
// These values are hardcoded based on the runs generated for
// the first version of this interactive (`pa_run_{0..4}.json').
// This allows the scale of the histogram to be consistent
// between runs without the need to generate global mins/maxes 
// from *all* of the chain run files.
const minSeats = 7;
const maxSeats = 12;


const histBarColor = "#4198c8";  // MGGG blue
const histBarColorActive = "#d1342b";  // Districtr red
// subset of Districtr colors
const colorScheme = [  
    "#0099cd",
    "#ffca5d",
    "#00cd99",
    "#99cd00",
    "#cd0099",
    "#9900cd",
    "#8dd3c7",
    "#bebada",
    "#fb8072",
    "#80b1d3",
    "#fdb462",
    "#b3de69",
    "#fccde5",
    "#bc80bd",
    "#a6cee3",
    "#1f78b4",
    "#fb9a99",
    "#e31a1c",
    "#ff7f00",
];
// These coordinates are mostly used to set aspect ratios.
// The map and histogram are *not* fixed in size; they are
// rendered as SVGs  and scale to the viewport.
const mapWidth = 800;
const mapHeight = 600;
const mapScale = 9000;
const histBins = maxSeats - minSeats + 1;
const histBarWidth = 40;
const histBarGap = 2;
const histBodyWidth = (histBins * histBarWidth) + ((histBins - 1) * histBarGap);
const histBodyHeight = 240;
// margin pattern from Observable:
// https://observablehq.com/@d3/histogram#xAxis
const histMargin = {
    top: 0,
    bottom: 60,
    left: 20,
    right: 20
}
const histWidth = histBodyWidth + histMargin.left + histMargin.right; 
const histHeight = histWidth + histMargin.top + histMargin.bottom;
// The projection here is based on the lat/long coordinates
// of the geographic center of Pennsylvania and should be
// changed if another state is used.
const projection = d3.geoAlbers()
                 .center([0, 40.9])
                 .rotate([77.75, 0])
                 .parallels([36, 46])
                 .scale(mapScale)
                 .translate([mapWidth / 2, mapHeight / 2]);

var mapSvg;
var histSvg;
var path;
var deltas;
var demSeats;

function histHeights(data, endIdx, maxHeight) {
    /* Generates ticks and scaled counts for statistics over a chain run. */ 
    // We calculate the minimum and maximum values across the
    // entire dataset. That way, the histogram"s appearance is
    // consistent as the range of the data expands. 
    var minVal = d3.min(data);
    var maxVal = d3.max(data);
    // For the purposes of this visualization, we assume integer bins.
    var ticks = [];
    var counts = [];
    for(var idx = minVal; idx <= maxVal; idx++){
        ticks.push(idx);
        counts.push(0);
    }
    for(var idx in data.slice(0, endIdx + 1)){
        counts[data[idx] - minVal] += 1;
    }
    var normedCounts = [];
    var countSum = d3.sum(counts);
    for(var idx = 0; idx < counts.length; idx++){
        normedCounts.push({
            seats: ticks[idx],
            height: maxHeight * counts[idx] / countSum
        });
    }
    return normedCounts;
}

function randomRun(){
    return chainRuns[Math.floor(chainRuns.length * Math.random())];
}

var data = [d3.json(mapJson), d3.json(randomRun())]
Promise.all(data).then(function(values){
    var vtd = values[0];
    var run = values[1];
    deltas = run["deltas"];
    demSeats = run["dem_seats"];
    var geojson = topojson.feature(vtd, vtd.objects[mapObj]);
    mapSvg = d3.select(mapEl).append("svg")
               .attr("width", "100%")
               .attr("height", "100%")
               .attr("viewBox", "0 0 " + mapWidth + " " + mapHeight) 
               .attr("preserveAspectRatio", "xMidYMid meet");
    path = d3.geoPath().projection(projection);
    mapSvg.selectAll("path")
        .data(geojson.features)
        .enter()
        .append("path")
        .attr("id", function(d) { return "precinct" + d.id; })
        .attr("d", path);

    histSvg = d3.select(histEl).append("svg")
               .attr("viewBox", "0 0 " + histWidth + " " + histHeight)
               .attr("preserveAspectRatio", "xMidYMid meet");
    // TODO: don't hardcode this transform! (hack before presentation)
    histSvg.append("text").attr("transform", "translate(33, 340)")
                          .text("Number of Democratic seats");
    var histX = d3.scaleLinear()
                .domain([d3.min(demSeats) - 0.5, d3.max(demSeats) + 1.5])
                .range([-histBarWidth / 2, histWidth + histBarWidth / 2]);
    var histY = d3.scaleLinear([0, 1]);
    heights = histHeights(demSeats, 0, histBodyHeight);
    histSvg.append("g")
        .attr("fill", histBarColor)
        .selectAll("rect")
        .data(heights)
        .join("rect")
        .attr("x", function(d) { return histX(d.seats); })
        .attr("y", 0)
        .attr("height", 0)
        .attr("width", histBarWidth)
        .attr("id", function(d) { return "seat" + d.seats; })
        .attr("class", "hist-bar");
    var xAxis = d3.axisBottom(histX).ticks(heights.length);
    histSvg.append("g")
        .attr("transform", "translate(" + histBarWidth / 2 + ", " + 300 + ")")
        .call(xAxis);

    
    for(var districtIdx in run.initial){
        for(var precinctIdx in run.initial[districtIdx]){
            var precinctId = run.initial[districtIdx][precinctIdx];
            d3.select("#precinct" + precinctId).style("fill", colorScheme[districtIdx]);
        }
    }

    var deltaIdx = 0;
    d3.interval(function() {
        for(var districtId in deltas[deltaIdx]){
            for(var precinctIdx in deltas[deltaIdx][districtId]){
                var precinctId = deltas[deltaIdx][districtId][precinctIdx];
                d3.select("#precinct" + precinctId).style("fill", colorScheme[districtId]);
            }
        }
        heights = histHeights(demSeats, deltaIdx, 300);
        for(var bar in heights) {
            if(heights[bar].seats == demSeats[deltaIdx]){
                var color = histBarColorActive;
            } else {
                var color = histBarColor;
            }
            d3.select("#seat" + heights[bar].seats)
                .attr("y", 300 - heights[bar].height) 
                .attr("height", heights[bar].height)
                .attr("fill", color);
        }
        // TODO in morning: move this up
        deltaIdx += 1;
    }, 200);

});

