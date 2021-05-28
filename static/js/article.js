/* advanced article features */

/// initialization

$(document).ready(function() {
    // connect and join room
    connectServer();

    // full render pass
    initRender();

    // update blurbs and refs
    syncServer();

    // create full UI
    initSidebar();
    initHistory();

    // jump to pid if specified
    if (pid !== null) {
        let para = getPara(pid);
        makeActive(para);
    }
});

connectServer = function() {
    var url = `http://${document.domain}:${location.port}`;
    client.connect(url, () => {
        client.sendCommand('join_room', {'room': aid, 'get_locked': true}, (response) => {
            lockParas(response);
        });
    });
};

syncServer = function() {
    // set external reference for import_markdown arts
    if (g_ref) {
        console.log('init global refs');
        $('.para:not(.folder)').each(function() {
            let para = $(this);
            updateRefHTML(para);
        });
        client.sendCommand('update_g_ref', {'aid': aid, 'g_ref': false}, function(response) {
            console.log(`g_ref set to '${response}'`);
        });
    };

    // send blurb back to server
    if (!readonly) {
        setBlurb();
    }
};

/// server command editing

updatePara = function(pid, raw) {
    var para = getPara(pid);
    para.attr('raw', raw);
    rawToRender(para);
};

updateParas = function(para_dict) {
    for (pid in para_dict) {
        var para = getPara(pid);
        para.attr('raw', para_dict[pid]);
        rawToRender(para);
    }
};

deletePara = function(pid) {
    var para = getPara(pid);
    if(old_id = para.attr('id')){
        let i = ref_list.indexOf(old_id);
        if (i !== -1) {
            ref_list.splice(i, 1)
        }
        let ref = {};
        ref.aid = aid;
        ref.key = old_id;
        client.sendCommand('delete_ref', ref, function(success) {
            console.log('success: deleted ref');
        });
    }

    para.remove();
    envClasses();
    createRefs(); // we may be able to scope this more
};

insertParaRaw = function(pid, new_pid, raw='', before=true) {
    console.log('insertPara:', pid, new_pid, raw, before);
    var para = getPara(pid);
    var new_para = $('<div>', {class: 'para', pid: new_pid, raw: raw});
    if (before) {
        let prev = para.prev();
        if (prev.hasClass('folder')) {
            prev.before(new_para);
        } else {
            para.before(new_para);
        }
    } else {
        para.after(new_para);
    }
    new_para.html(inner_para);
    return new_para;
};

insertPara = function(pid, new_pid, raw='', before=true) {
    let new_para = insertParaRaw(pid, new_pid, raw, before);
    rawToRender(new_para);
    rawToTextarea(new_para);
    makeActive(new_para);
    sendMakeEditable();
};

pasteCB = function(pid, paste) {
    let para_act = null;
    paste.forEach(d => {
        const [new_pid, text] = d;
        para_act = insertParaRaw(pid, new_pid, text, false);
        rawToRender(para_act, true); // defer
        rawToTextarea(para_act);
        pid = new_pid;
    })
    envClasses();
    createRefs();
    $('.para').removeClass('copy_sel');
    makeActive(para_act);
};

applyDiff = function(edits) {
    console.log('applyDiff', edits);

    $.each(edits['para_del'], (i, pid) => {
        deletePara(pid);
    });

    $.each(edits['para_upd'], (pid, raw) => {
        updatePara(pid, raw);
    });

    var adds = edits['para_add'];
    $.each(edits['position'], (i, pos) => {
        var [pid, pre] = pos;
        if (pid in adds) {
            var raw = adds[pid];
            insertPara(pre, pid, raw=raw, before=false);
        } else {
            var para = getPara(pid);
            var base = getPara(pre);
            base.after(para);
        }
    });
}

/// external references and blurbs

createExtRef = function(id) {
    let tro = troFromKey(id);
    let ref = {};
    ref.aid = aid;
    ref.key = id;
    ref.cite_type = tro.cite_type;
    ref.cite_env = tro.cite_env;
    ref.text = popText(tro);
    ref.ref_text = tro.ref_text;
    return ref;
};

// push reference blurb changes to server
updateRefHTML = function(para) {
    // get para id, old_id is for when the update is an id change
    let new_id = para.attr('id');
    let old_id = para.attr('old_id');

    // the pid of it's containing env
    let env_pid = para.attr('env_pid');
    let env_beg = para.hasClass('env_beg');

    // for this specific para
    if (new_id) {
        ref_list.push(new_id);
        let ref = createExtRef(new_id);
        client.sendCommand('update_ref', ref, function(success) {
            console.log('success: updated ref');
        });
    }

    // for containing env - this should already exist
    if (env_pid && !env_beg) {
        let epar = getPara(env_pid);
        let env_id = epar.attr('id');
        if (env_id) {
            let ref = createExtRef(env_id);
            client.sendCommand('update_ref', ref, function(success) {
                console.log('success: updated ref');
            });
        }
    }

    // check if this was obscuring another same-id para? otherwise delete
    if (old_id) {
        let old_para = $(`#${old_id}`);
        if (old_para.length > 0) {
            let ref = createExtRef(old_id);
            client.sendCommand('update_ref', ref, function(success) {
                console.log('success: updated ref');
            });
        } else {
            let i = ref_list.indexOf(old_id);
            if (i !== -1) {
                ref_list.splice(i, 1);
            }
            let ref = {};
            ref.aid = aid;
            ref.key = old_id;
            client.sendCommand('delete_ref', ref, function(success) {
                console.log('success: deleted ref');
            });
        }
    }
};

$.fn.ignore = function(sel) {
    return this.clone().find(sel || '>*').remove().end();
};

getBlurb = function(len=200) {
    var blurb = '';
    var size = 0;
    $('.para').not('.folder').each(function() {
        var para = $(this);
        var ptxt = para.children('.p_text');
        var core = ptxt.ignore('.katex-mathml, .eqnum, img, svg')
                       .removeClass('p_text');

        var html = core[0].outerHTML;
        blurb += html + ' ';

        var text = core.text();
        size += text.length;

        if (size > len) {
            blurb += '...';
            return false;
        }
    });
    return blurb;
};

setBlurb = function() {
    var blurb = getBlurb();
    client.sendCommand('set_blurb', {'aid': aid, 'blurb': blurb}, function(success) {
            console.log('blurb set');
        });
};

/// sidebar

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
    $('#content').toggleClass('sb_content');
    sidebar_show = !sidebar_show;
};

$(document).on('click', '#logo', toggleSidebar);

$(document).on('change', '#theme_select', function() {
    let tselect = $(this);
    let tchoice = tselect.children('option:selected').text();
    if (tchoice != current_theme) {
        current_theme = tchoice;
        let tset = (tchoice == 'default') ? default_theme : tchoice;
        document.cookie = `theme=${tchoice}; path=/; samesite=lax; secure`;
        $('#theme').remove();
        let link = themeLink(tset);
        $('head').append(link);
    }
});

$(document).on('change', '#font_select', function() {
    let fselect = $(this);
    let fchoice = fselect.children('option:selected').text();
    if (fchoice != current_font) {
        current_font = fchoice;
        let fset = (fchoice == 'default') ? '' : fchoice;
        $('#content').css('font-family', fset);
    }
});


/*
$(document).click(function(e) {
    if (sidebar_show) {
        if ($(e.target).closest('#sidebar').length == 0
          && $(e.target).closest('#logo').length == 0) {
           toggleSidebar();
        }
    }
});
*/

initSidebar = function() {
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
};

/// history

var hist_vis = false;

localDate = function(d) {
    var d1 = new Date(d);
    d1.setTime(d1.getTime()-(d1.getTimezoneOffset()*60*1000));
    return d1;
};

paraReadonly = function(pid, raw) {
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
        var para = paraReadonly(pid, raw);
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

initHistory = function(data) {
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

        hideHistPreview();
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

    // callback for updates
    updateHistMap = updateCommits;
};

launchHistMap = function() {
    client.sendCommand('get_commits', {'aid': aid}, function(dates) {
        updateHistMap(
            dates.map(d => ({
                'commit': d,
                'date': localDate(d)
            }))
        );
        $('#hist').show();
    });
}

hideHistPreview = function() {
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

toggleHistMap = function() {
    $('#hist').toggle();
    if (hist_vis) {
        hideHistPreview();
        $('#prog_bar').show();
    } else {
        launchHistMap();
        $('#prog_bar').hide();
    }
    hist_vis = !hist_vis;
    writeable = !readonly && !hist_vis;
}

revertHistory = function() {
    var act = d3.selectAll('circle.active');
    if (act.empty()) {
        return;
    }
    var data = act.datum();
    var args = {aid: aid, date: data.commit};
    client.sendCommand('revert_history', args, on_success(launchHistMap));
};

$(document).on('click', '#show_hist', toggleHistMap);
$(document).on('click', '#revert_hist', revertHistory);

function responsivefy(svg) {
    width = window.innerWidth;
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

/// progress bar

$(document).ready(function() {
    $('#content').scroll(function() {
        console.log('scrollin');
        let elem = $('#content');
        let spos = elem.scrollTop();
        let shgt = elem[0].scrollHeight;
        let hout = elem.outerHeight();
        let spct = 100 * spos / (shgt - hout);
        $('#prog_bar').css('width', `${spct}%`);
    });
});

/// mobile hover eqiv

if (mobile) {
    $(document).on('click', '.pop_anchor', function(e) {
        e.preventDefault();
        $('#pop').remove();
        var ref = $(this);
        ref.data('show_pop', true);
        var html = getTro(ref, renderPop);
        return false;
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

/// drop to upload

connectDrops(function(box, data) {
    console.log(data);
    var para = box.closest('.para');
    var key = data.key;
    var raw = `! [id=${key}|caption=none]`;
    para.attr('raw', raw);
    rawToRender(para, false);
    rawToTextarea(para);
    sendUpdatePara(para, force=true);
});

/// reference completion

next_cc = function(dir) {
    let ccpop = $('#cc_pop')[0];
    if (dir == 'up') {
        f = ccpop.firstElementChild;
        ccpop.appendChild(f); //apend first to end
    } else if (dir == 'down') {
        l = ccpop.lastElementChild;
        ccpop.prepend(l); //append last child before first
    }
};

make_cc = function() {
    var cctxt = $('.cc_row').first().text();
    var input = active_para.children('.p_input');
    var raw = input.val();
    let open_ref = /@(\[|@)?([\w-\|\=^]+)?(\:)?([\w-\|\=^]+)?(?!.*\])([\s\n]|$)/;
    let open_i_link = /\[\[([\w-\|\=^]+)?(?!.*\])([\s\n]|$)/;
    if (cap = open_ref.exec(raw)) {
        var l = cap.index;
        var space = cap[5] || ""
        if (cap[3] && !cap[2]) { // searching for ext page
           raw = raw.replace(open_ref, function() {
                const out = `@[${cctxt}:${space}`;
                l = l + out.length - space.length
                return out
            });
        } else if (cap[2] && cap[3]) {
            raw = raw.replace(open_ref, function() {
                const out = `@[${cap[2]}:${cctxt}]${space}`;
                l = l + out.length - space.length
                return out;
            });
        } else {
            raw = raw.replace(open_ref, function() {
                const out = `@[${cctxt}]${space}`;
                l = l + out.length - space.length
                return out;

            });
        }
    } else if (cap = open_i_link.exec(raw)) {
        var l = cap.index;
        var space = cap[2] || ""
        raw = raw.replace(open_i_link, function() {
            const out = `[[${cctxt}]]${space}`;
            l = l + out.length - space.length
            return out;
        });
    }
    input.val(raw);
    resize(input[0]);
    syntaxHL(active_para);
    cc = false;
    $('#cc_pop').remove();
    input[0].setSelectionRange(l, l);
};

/// command completion

cc_search = function(list, search, placement) {
    list = list.filter(el => el.includes(search));
    if (list.length > 0) {
        cc = true;
        let pop = $('<div>', {id: 'cc_pop'});
        list.forEach(r => {
            let cc_row = $('<div>', {class: 'cc_row'});
            cc_row.text(r);
            pop.append(cc_row);
        });
        $('#bg').append(pop);

        pop.css({
            'left': placement.left + 'px', // offset 10px for padding
            'top': placement.top + 'px', // offset up by 35 px
        });
    }
};

cc_refs = function(raw, view, e) {
    cc = false;
    $('#cc_pop').remove();
    let open_ref = /@(\[|@)?([\w-\|\=^]+)?(\:)?([\w-\|\=^]+)?(?!.*\])(?:[\s\n]|$)/;
    let open_i_link = /\[\[([\w-\|\=^]+)?(?!.*\])(?:[\s\n]|$)/;
    cur = e.target.selectionStart;
    if (cap = open_ref.exec(raw)) {
        // if cursor is near the match
        let b = cap.index;
        let e = b + cap[0].length;
        if (cur >= b && cur <= e) {
            raw = raw.slice(0,e) + `<span id=cc_pos></span>` + raw.slice(e)
            view.html(raw);
            let off = $('#cc_pos').offset();
            let p = {'left': off.left, 'top': off.top + $('#cc_pos').height()};
            if(cap[1]=='@') { //bib search
                let search = cap[2] || '';
                cc_search(bib_list, search, p);
            } else if (cap[3] && !cap[2]) { // searching for ext page
                let ex_keys = Object.keys(ext_refs);
                if (ex_keys.length == 0) { // if we have not made request
                    client.sendCommand('get_arts', '', function(arts) {
                        ext_refs = arts;
                        search = '';
                        cc_search(Object.keys(arts), search, p);
                    });
                } else {
                    search = cap[4] || '';
                    cc_search(ex_keys, search, p);
                }
            } else if (cap[2] && cap[3]) {
                client.sendCommand('get_refs', {'title': cap[2]}, function(data) {
                    if (data.refs.length > 0) {
                        ext_refs[data.title] = data.refs;
                    }
                    search = '';
                    cc_search(data.refs, search, p);
                });
            } else {
                let search = cap[4] || cap[2] || '';
                cc_search(ref_list, search, p);
            }
        }
    } else if (cap = open_i_link.exec(raw)) {
        let b = cap.index;
        let e = b + cap[0].length;
        if (cur >= b && cur <= e) {
            raw = raw.slice(0,e) + `<span id=cc_pos></span>` + raw.slice(e)
            view.html(raw);
            let off = $('#cc_pos').offset();
            let p = {'left': off.left, 'top': off.top + $('#cc_pos').height()};
            let ex_keys = Object.keys(ext_refs);
            if (ex_keys.length == 0) { // if we have not made request
                client.sendCommand('get_arts', '', function(arts) {
                    ext_refs = arts;
                    search = '';
                    cc_search(Object.keys(arts), search, p);
                });
            } else {
                search = cap[1] || '';
                cc_search(ex_keys, search, p);
            }
        }
    }
};
