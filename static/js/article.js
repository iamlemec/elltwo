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
        toggleSidebar();
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
        var x = $(this).parents(".custom-select-wrapper").find("select")
        x.val($(this).data("value"));
        x.trigger('change');
        $(this).parents(".custom-options").find(".custom-option").removeClass("selection");
        $(this).addClass("selection");
        $(this).parents(".custom-select").removeClass("opened");
        $(this).parents(".custom-select").find(".custom-select-trigger").text($(this).text());
    });
});

// history

var hist_vis = false;

local_date = function(d) {
    var d1 = new Date(d);
    d1.setTime(d1.getTime()-(d1.getTimezoneOffset()*60*1000));
    return d1;
};

para_readonly = function(x) {
    var para = $('<div>', {class: 'para', raw: x});
    var ptxt = $('<div>', {class: 'p_text'});
    var pviw = $('<div>', {class: 'p_input_view'});
    var pinp = $('<textarea>', {class: 'p_input', val: x});
    pinp.prop('readonly', true);
    para.append(ptxt);
    para.append(pviw);
    para.append(pinp);
    return para;
};

renderPreview = function(paras) {
    var preview = $('#preview');
    preview.empty();
    $(paras).each((i, x) => {
        var para = para_readonly(x);
        preview.append(para);
        rawToRender(para, true); // postpone formatting
    });
    envClasses(preview);
    preview.show();
    $('#content').hide();
}

create_hist_map = function(data) {
    var hpadding = 50;
    var radius = 4;

    var hist = d3.select('#hist');
    hist.selectAll("*").remove();
    hist.append('svg')
        .attr('id', 'svgg')
        .attr('width', hist.node().getBoundingClientRect().width)
        .attr('height', hist.node().getBoundingClientRect().height);

    var svg = d3.select("#svgg")
        .on('click', generalClick);

    var width = +svg.attr("width");
    var height = +svg.attr("height");

    // scaleEx controls how zoomed we go
    var zoom = d3.zoom()
        .scaleExtent([1, 5000])
        .translateExtent([[-100, -100], [width + 90, height + 100]])
        .on("zoom", zoomed);

    // round to hour/day/week
    var xmax = new Date(Date.now());
    var xmin0 = d3.min(data.map(d => d.date));

    var xrange = (xmax - xmin0)/(1000*60*60); // hours
    if (xrange <= 1) {
        xdel = 1;
    } else if (xrange <= 24) {
        xdel = 24;
    } else {
        xdel = xrange;
    }

    var xmin = new Date(xmax);
    xmin.setHours(xmin.getHours()-xdel);

    var x = d3.scaleTime()
        .domain([xmin, xmax])
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
        .classed('commit', true)
        .attr('cx', d => x(d.date))
        .attr('cy',height*.3)
        .attr('r', radius)
        .attr('opacity', '.5')
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut)
        .on("click", handleClick);

    svg.call(zoom);

    function zoomed() {
        var t = d3.event.transform, xt = t.rescaleX(x);
        view.attr("transform", t);
        //var xScale = xAxis.scale(d3.event.transform.rescaleX(x));
        //gX.call(xScale);
        gX.call(xAxis.scale(xt));
        gDot.selectAll("circle").attr("cx", function(d) { return xt(d.date); });
    }

    function handleMouseOver(d, i) {  // Add interactivity
        // Use D3 to select element, change color and size
        d3.select(this)
          .attr('r', radius + 2)

        // Specify where to put label of text
        var tooltip = d3.select('#bg').append("div").attr('id',  "hp_" + i)  // Create an id for text so we can select it later for removing on mouseout
            .attr('class', "hist_pop")
            .text(function() {return d.date; });

        var ttw = tooltip.node().getBoundingClientRect().width;
        var tth = tooltip.node().getBoundingClientRect().height;

        tooltip.style("left", (d3.event.pageX - ttw/2) + "px")
               .style("top", (d3.event.pageY - tth - 10) + "px")
    }

    function handleMouseOut(d, i) {
        // Use D3 to select element, change color back to normal
        d3.select(this)
          .attr('r', radius)

        // Select text by id and then remove
        d3.select("#hp_" + i).remove();  // Remove text location
    }

    function handleClick(d, i) {
        console.log('history clicked:', d.commit);

        d3.selectAll('circle.active')
          .classed('active', false);
        d3.select(this)
          .classed('active', true);
        d3.event.stopPropagation();

        client.sendCommand('get_history', {'aid': aid, 'date': d.commit}, renderPreview);
    }

    function generalClick(d, i) {
        console.log('general click');

        d3.selectAll('circle.active')
          .classed('active', false);

        hide_hist_preview();
    }
};

launch_hist_map = function() {
    client.sendCommand('get_commits', {'aid': aid}, function(dates) {
        create_hist_map(
            dates.map(d => ({
                'commit': d,
                'date': local_date(d)
            }))
        );
    });
}

hide_hist_preview = function() {
    var preview = $('#preview');
    $('#content').show();
    preview.hide();
    preview.empty();
}

toggle_hist_map = function() {
    $('#hist').toggle();
    if (hist_vis) {
        hide_hist_preview();
        $('#hist').empty();
    } else {
        launch_hist_map();
    }
    hist_vis = !hist_vis;
    writeable = !readonly && !hist_vis;
}

$(document).ready(function() {
    $('#show_hist').click(toggle_hist_map);
});

// Exporting

getMarkdown = function() {
    return $('.para').map(function() {
        var para = $(this);
        return para.attr('raw');
    }).toArray().join('\n\n');
};
