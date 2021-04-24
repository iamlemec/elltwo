/// acccepted upload file types

img_types = ['image/png']

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
    $('#logo').toggleClass('opened');
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

// SELECT

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

para_readonly = function(pid, raw) {
    var para = $('<div>', {class: 'para', pid: pid, raw: raw});
    var ptxt = $('<div>', {class: 'p_text'});
    var pviw = $('<div>', {class: 'p_input_view'});
    var pinp = $('<textarea>', {class: 'p_input', val: raw});
    pinp.prop('readonly', true);
    para.append(ptxt);
    para.append(pviw);
    para.append(pinp);
    return para;
};

renderPreview = function(hist) {
    var preview = $('#preview');
    var content = $('#content');

    var pid0 = active_para ? active_para.attr('pid') : null;
    var ppos = active_para ? active_para.position().top : null;
    var cpos = content.scrollTop();

    preview.empty();

    var new_active = null;
    $.each(hist.paras, (i, p) => {
        var [pid, raw] = p;
        var para = para_readonly(pid, raw);
        if (pid == pid0) {
            new_active = para;
        }
        preview.append(para);
        rawToRender(para, true); // postpone formatting
    });

    envClasses(preview);

    $.each(hist.diff, (i, pid) => {
        $(`#preview > .para[pid="${pid}"`).addClass('hl_change');
    });

    preview.show();
    content.hide();

    // make active and ensure same relative position
    makeActive(new_active, false);
    if (ppos !== null) {
        cpos = preview.scrollTop() + active_para.position().top - ppos;
    }
    preview.scrollTop(cpos);
};

create_hist_map = function(data) {
    // fixed params // different for mobile
    var hpadding = mobile ? 20 : 50;
    var radius = mobile ? 6 : 4;

    // these should be dynamic
    var width = window.innerWidth;
    var height = mobile ? 150 : 100;

    // clean house
    var hist = d3.select('#hist');
    hist.selectAll('*').remove();

    // create svg element
    var svg = hist.append('svg')
        .attr('id', 'svgg')
        .attr('width', width)
        .attr('height', height)
        .on('click', generalClick)
        .call(responsivefy);

    // scaleEx controls how zoomed we go
    var zoom = d3.zoom()
        .scaleExtent([0.5, 5000])
        .translateExtent([[-100, -100], [width + 90, height + 100]])
        .on('zoom', zoomed);

    var x = d3.scaleTime()
        .range([hpadding, width - hpadding]);

    var xAxis = d3.axisBottom(x)
        .ticks(10)
        .tickSize(5)
        .tickPadding(-20);

    var gX = svg.append('g')
        .attr('class', 'axis--x')
        .attr('transform', `translate(0,${0.7*height})`)
        .call(xAxis);

    var gDot = svg.append('g')
        .attr('fill', 'none')
        .attr('stroke-linecap', 'round');

    svg.call(zoom);

    function zoomed() {
        // store transform
        var zTrans = d3.event.transform.rescaleX(x);
        xAxis.scale(zTrans);

        // rescale axis
        gX.call(xAxis);

        // move circles
        gDot.selectAll('circle')
            .attr('cx', d => zTrans(d.date));
    }

    function handleMouseOver(d, i) {  // Add interactivity
        // Use D3 to select element, change color and size
        d3.select(this)
          .attr('r', radius + 2)

        // Specify where to put label of text
        var tooltip = d3.select('#bg').append('div')
            .attr('id',  `hp_${i}`)  // Create an id for text so we can select it later for removing on mouseout
            .attr('class', 'hist_pop')
            .text(d.date.toLocaleString());

        var ttw = tooltip.node().getBoundingClientRect().width;
        var tth = tooltip.node().getBoundingClientRect().height;

        var left = d3.event.pageX - ttw/2;
        var right = d3.event.pageY - tth - 10

        tooltip.style('left', `${left}px`)
               .style('top', `${right}px`);
    }

    function handleMouseOut(d, i) {
        // Use D3 to select element, change color back to normal
        d3.select(this)
          .attr('r', radius)

        // Select text by id and then remove
        d3.select(`#hp_${i}`).remove();  // Remove text location
    }

    function handleClick(d, i) {
        console.log('history clicked:', d.commit);

        d3.selectAll('circle.active')
          .classed('active', false);
        d3.select(this)
          .classed('active', true);
        d3.event.stopPropagation();

        d3.select('#revert_hist').classed('selected', true);

        client.sendCommand('get_history', {'aid': aid, 'date': d.commit}, renderPreview);
    }

    function generalClick(d, i) {
        console.log('general click');

        d3.selectAll('circle.active')
          .classed('active', false);

        d3.select('#revert_hist').classed('selected', false);

        hide_hist_preview();
    }

    function updateCommits(data) {
        // round to hour/day/week
        var xmax = new Date(Date.now());
        xmax.setHours(xmax.getHours()+1);

        // get date min
        var xmin0 = d3.min(data.map(d => d.date));

        // round date range
        var xrange = (xmax - xmin0)/(1000*60*60); // hours
        if (xrange <= 1) {
            xdel = 1;
        } else if (xrange <= 24) {
            xdel = 24;
        } else {
            xdel = xrange;
        }

        // set rounded min
        var xmin = new Date(xmax);
        xmin.setHours(xmin.getHours()-xdel-1);

        // rescale axis
        x.domain([xmin, xmax]);
        gX.call(xAxis);

        // remove old circles
        gDot.selectAll('circle').remove();

        // add new circles
        var zTrans = xAxis.scale();
        gDot.selectAll('cirlce')
            .data(data).enter()
            .append('circle')
            .classed('commit', true)
            .attr('cx', d => zTrans(d.date))
            .attr('cy', 0.3*height)
            .attr('r', radius)
            .attr('opacity', 0.5)
            .on('mouseover', handleMouseOver)
            .on('mouseout', handleMouseOut)
            .on('click', handleClick);
    }

    return updateCommits;
};

launch_hist_map = function() {
    client.sendCommand('get_commits', {'aid': aid}, function(dates) {
        update_hist_map(
            dates.map(d => ({
                'commit': d,
                'date': local_date(d)
            }))
        );
        $('#hist').show();
    });
}

hide_hist_preview = function() {
    var preview = $('#preview');
    var content = $('#content');

    $('#revert_hist').removeClass('selected');
    $('.hist_pop').remove();

    var cpos = preview.scrollTop();
    var ppos = active_para ? active_para.position().top : null;

    content.show();
    preview.hide();

    if (active_para) {
        var pid = active_para.attr('pid');
        var para = content.children(`[pid=${pid}]`);
        var new_active = (para.length > 0) ? para : null;

        // make active and align scroll
        makeActive(new_active, false);
        if (ppos !== null) {
            cpos = content.scrollTop() + active_para.position().top - ppos;
        }
    }

    content.scrollTop(cpos);
    preview.empty();
    createTOC(content);
}

toggle_hist_map = function() {
    $('#hist').toggle();
    if (hist_vis) {
        hide_hist_preview();
        $('#prog_bar').show();
    } else {
        launch_hist_map();
        $('#prog_bar').hide();
    }
    hist_vis = !hist_vis;
    writeable = !readonly && !hist_vis;
}

revert_history = function() {
    var act = d3.selectAll('circle.active');
    if (act.empty()) {
        return;
    }
    var data = act.datum();
    var args = {aid: aid, date: data.commit};
    client.sendCommand('revert_history', args, on_success(launch_hist_map));
};

$(document).ready(function() {
    update_hist_map = create_hist_map();
    $('#show_hist').click(toggle_hist_map);
    $('#revert_hist').click(revert_history);
});

function responsivefy(svg) {
    width = window.innerWidth
    height = svg.attr('height'); //mobile ? 150 : 100;
    aspect = width / height;

      // add viewBox and preserveAspectRatio properties,
      svg.attr("viewBox", "0 0 " + width + " " + height)
          .attr("preserveAspectRatio", "xMinYMid")
          .call(resize);

      d3.select(window).on("resize", resize);

      // get width of container and resize svg to fit it
      function resize() {
          var targetWidth = window.innerWidth;
          svg.attr("width", targetWidth);
          svg.attr("height", Math.round(targetWidth / aspect));
      }
    }


// progress bar

$(document).ready(function() {
    $('#content').scroll(function(){
        progress()
    });
});

progress = function() {
    el = $('#content');
    let s = el.scrollTop();
    let sh = el[0].scrollHeight;
    let h = el.outerHeight();
    let p = 100 * s / (sh - h);
    $('#prog_bar').css('width',p + '%')
};

//mobile hover eqiv

if (mobile) {
    $(document).ready(function() {
        $(document).on('click', '.pop_anchor', function(e){
            e.preventDefault();
            $('#pop').remove();
            var ref = $(this);
            ref.data('show_pop', true);
            var html = getTro(ref, renderPop);
            return false;
        });
    });

    $(document).click(function(e) {
        if ($(e.target).closest('#pop').length == 0) {
            $('#pop').remove();
        } else {
            window.location = $('#pop').attr('href');
            $('#pop').remove();
        }
    });
}

// drop to upload

uploadImg = function(file, para) {
    let form_data = new FormData();
    form_data.append('file', file);
    $.ajax({
        type: 'POST',
        url: '/uploadImg',
        data: form_data,
        contentType: false,
        cache: false,
        processData: false,
        success: function(data) {
            update_img(para, data.src, data.id);
        },
    });
};

update_img = function(para, src, id) {
    raw = `! [id=${id}|caption=none] (${src})`;
    para.attr('raw', raw);
    rawToRender(para, false);
    rawToTextarea(para);
    sendUpdatePara(para, force=true);
};

$(document).ready(function() {
    $(document).on('dragover', '.dropzone', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('dragover');
    });

    $(document).on('dragleave', '.dropzone', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('dragover');
    });

    $(document).on('drop', '.dropzone', function(e) {
        let files = e.originalEvent.dataTransfer.files;
        if (files.length == 1) {
            f = files[0];
            if (img_types.includes(f.type)) {
                para = $(this).closest('.para');
                uploadImg(files[0], para);
            } else {
                $(this).text('Unsupported file type');
            }
        } else if (files.length > 1) {
            $(this).text('Please upload a single image file');
        }
        $(this).removeClass('dragover');
        e.preventDefault();
        e.stopPropagation();
    });
});
