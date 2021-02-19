/// SIDEBAR


// default options
default_theme = theme;
sidebar_show = false;

// current options
current_theme = 'default';
current_font = 'default';

themeLink = function(name) {
    return $('<link>', {
        id: 'theme',
        type: 'text/css',
        rel: 'stylesheet',
        href: `/static/themes/${name}.css`,
    });
};

toggleSidebar = function() {
    $('#sidebar').animate({width: 'toggle'}, 100);
    $('#logo').toggleClass("opened");
    sidebar_show = !sidebar_show;
};

$(document).ready(function() {
$('#logo').click(function() {
        toggleSidebar()
});

$('#theme_select').change(function() {
    var tselect = $(this);
    var tchoice = tselect.children('option:selected').text();
    if (tchoice != current_theme) {
        current_theme = tchoice;
        var tset = (tchoice == 'default') ? default_theme : tchoice;
        $('#theme').remove();
        var link = themeLink(tset);
        $('head').append(link);
    }
});

$('#font_select').change(function() {
    var fselect = $(this);
    var fchoice = fselect.children('option:selected').text();
    if (fchoice != current_font) {
        current_font = fchoice;
        var fset = (fchoice == 'default') ? '' : fchoice;
        $('#content').css('font-family', fset);
    }
});
});

$(document).click(function(e) {
    if (sidebar_show) {
        if ($(e.target).closest('#sidebar').length == 0 
          && $(e.target).closest('#logo').length == 0) {
           toggleSidebar();
        }
    }
});

//SELECT

$(document).ready(function() {
$(".custom-select").each(function() {
  var classes = $(this).attr("class"),
      id      = $(this).attr("id"),
      name    = $(this).attr("name");
  var template =  '<div class="' + classes + '">';
      template += '<span class="custom-select-trigger">' + $(this).attr("placeholder") + '</span>';
      template += '<div class="custom-options">';
      $(this).find("option").each(function() {
        template += '<span class="custom-option ' + $(this).attr("class") + '" data-value="' + $(this).attr("value") + '">' + $(this).html() + '</span>';
      });
  template += '</div></div>';
  
  $(this).wrap('<div class="custom-select-wrapper"></div>');
  $(this).hide();
  $(this).after(template);
});
$(".custom-option:first-of-type").hover(function() {
  $(this).parents(".custom-options").addClass("option-hover");
}, function() {
  $(this).parents(".custom-options").removeClass("option-hover");
});
$(".custom-select-trigger").on("click", function() {
  $('html').one('click',function() {
    $(".custom-select").removeClass("opened");
  });
  $(this).parents(".custom-select").toggleClass("opened");
  event.stopPropagation();
});
$(".custom-option").on("click", function() {
  x = $(this).parents(".custom-select-wrapper").find("select")
  x.val($(this).data("value"));
  x.trigger('change')
  $(this).parents(".custom-options").find(".custom-option").removeClass("selection");
  $(this).addClass("selection");
  $(this).parents(".custom-select").removeClass("opened");
  $(this).parents(".custom-select").find(".custom-select-trigger").text($(this).text());
});
});

//history

hist_vis = false

$(document).ready(function() {
$('#show_hist').click(function() {
    $('#hist').toggle();
    if (hist_vis){
      $('#hist').empty()
    } else {
    create_hist_map()
  };
  hist_vis = !hist_vis;
});
});


function create_hist_map(){


//fake data
var data = [new Date(2019,3,10), 
new Date(2020, 10, 1),
new Date(2020, 10, 2), 
new Date(2019, 0, 1), 
Date.now()];

let hl2 = getComputedStyle(document.documentElement)
    .getPropertyValue('--hl2-col');
let hl = getComputedStyle(document.documentElement)
    .getPropertyValue('--font-col-int');

let hpadding = 50;
let radius = 4;
let hist = d3.select('#hist');
hist.selectAll("*").remove()
hist.append('svg')
  .attr('id', 'svgg')
  .attr('width', hist.node().getBoundingClientRect().width)
  .attr('height', hist.node().getBoundingClientRect().height);


var svg = d3.select("#svgg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");

// scaleEx controls how zoomed we go
var zoom = d3.zoom()
    .scaleExtent([1, 1000])
    .translateExtent([[-100, -100], [width + 90, height + 100]])
    .on("zoom", zoomed);

var x = d3.scaleTime()
    .domain([d3.min(data), d3.max(data)])
    .range([hpadding, width - hpadding]);

var view = svg.append("rect")
    .attr("class", "view")
    .attr("x", 0.5)
    .attr("y", 0.5)
    .attr("width", width - 1)
    .attr("height", height - 1)
    .attr("opacity", 0);

var xAxis = d3.axisBottom(x)
    .ticks(10)
    .tickSize(5)
    .tickPadding(-20);



var gX = svg.append("g")
    .attr("class", "axis axis--x")
    .attr("transform", `translate(0,${height*.7})`)
    .call(xAxis);

var gDot = svg.append("g")
      .attr("fill", "none")
      .attr("stroke-linecap", "round");


gDot.selectAll('circle').data(data)
  .enter()
  .append('circle')
  .attr('cx',function(d) {return x(d)})
  .attr('cy',height*.3)
  .attr('r', radius)
  .attr('opacity', '.5')
  .attr('fill', hl2)
  .on("mouseover", handleMouseOver)
  .on("mouseout", handleMouseOut);


svg.call(zoom);

function zoomed() {
  var t = d3.event.transform, xt = t.rescaleX(x);
  view.attr("transform", t);
  //var xScale = xAxis.scale(d3.event.transform.rescaleX(x));
  //gX.call(xScale);
  gX.call(xAxis.scale(xt));
  gDot.selectAll("circle").attr("cx", function(d) { return xt(d); });
}

function handleMouseOver(d, i) {  // Add interactivity

            // Use D3 to select element, change color and size
            d3.select(this)
              .attr('r', radius + 2)
              .attr('fill', hl)

            // Specify where to put label of text
            var tooltip = d3.select('#bg').append("div").attr('id',  "hp_" + i)  // Create an id for text so we can select it later for removing on mouseout
                .attr('class', "hist_pop")
                .text(function() {return d; });

                var ttw = tooltip.node().getBoundingClientRect().width;
                var tth = tooltip.node().getBoundingClientRect().height;
                
            tooltip.style("left", (d3.event.pageX - ttw/2) + "px")   
                .style("top", (d3.event.pageY - tth - 10) + "px") 
                
          }

function handleMouseOut(d, i) {
            // Use D3 to select element, change color back to normal
            d3.select(this)
              .attr('r', radius)
              .attr('fill', hl2)

            // Select text by id and then remove
            d3.select("#hp_" + i).remove();  // Remove text location
          }
  
};



/// Exporting

getMarkdown = function() {
    return $('.para').map(function() {
        var para = $(this);
        return para.attr('raw');
    }).toArray().join('\n\n');
};