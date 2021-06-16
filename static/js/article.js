/* main article entry point */

export {
    loadArticle, insertPara, updatePara, updateParas, deletePara, updateRefHTML,
    toggleHistMap, ccNext, ccMake, ccRefs
}

import { setCookie, cooks, getPara } from './utils.js'
import {
    config, state, cache, updateConfig, updateState, updateCache
} from './state.js'
import { connect, addHandler, sendCommand, schedTimeout } from './client.js'
import { initUser } from './user.js'
import {
    stateRender, initRender, eventRender, innerPara, rawToRender, rawToTextarea,
    envClasses, createRefs, createTOC, troFromKey, popText, syntaxHL, cacheBib, deleteCite,
    braceMatch
} from './render.js'
import {
    initEditor, resize, makeActive, lockParas, unlockParas, sendMakeEditable,
    sendUpdatePara
} from './editor.js'
import { connectDrops } from './drop.js'
import { initExport } from './export.js'

// history
let updateHistMap;

/// initialization

let default_config = {
    theme: 'classic', // theme to use
    font: 'default', // font to use
    timeout: 180, // para lock timeout
    max_size: 1024, // max image size
    readonly: true, // is session readonly
    title: null, // default article title
    aid: null, // article identifier
};

let default_cache = {
    ref: [], // internal references
    bib: {}, // bibliography entries
    img: {}, // local image cache
    ext_ref: {}, // external ref info
};

let default_state = {
    sidebar_show: false, // is sidebar shown
    hist_vis: false, // is history mode on
    editable: false, // are we focused on the active para
    writeable: false, // can we actually modify contents
    active_para: null, // current active para
    last_active: null, // to keep track of where cursor was
    cc: false, // is there a command completion window open
    cb: [], // clipboard for cell copy
};

function stateArticle() {
    stateRender();

    updateState(default_state);
    setWriteable(!config.readonly);
}

function initArticle() {
    initRender();
    initUser();
    initSidebar();
    initHistory();
    initExport();
    initEditor();
}

function loadArticle(args) {
    // load in server side config/cache
    updateConfig(default_config, args.config ?? {});
    updateCache(default_cache, args.cache ?? {});

    window.cache = cache


    // initialize full state
    stateArticle();

    // connect and join room
    connectServer();

    // core init
    initArticle();

    // set external reference for import_markdown arts
    if (args.update_refs ?? false) {
        syncRefs();
    };

    // send blurb back to server
    if (!config.readonly) {
        setBlurb();
    }

    // jump to pid if specified
    let pid = args.pid ?? null;
    if (pid !== null) {
        let para = getPara(pid);
        makeActive(para);
    }

    // connect events
    eventArticle();
}

function setWriteable(wr) {
    state.writeable = wr;
    $('#bg').toggleClass('writeable', wr);
}

function connectServer() {
    let url = `http://${document.domain}:${location.port}`;
    connect(url, () => {
        sendCommand('join_room', {'room': config.aid, 'get_locked': true}, (response) => {
            lockParas(response);
        });
    });

    addHandler('updatePara', function(data) {
        updatePara(...data);
    });

    addHandler('updateBulk', function(data) {
        updateParas(data);
    });

    addHandler('insertPara', function(data) {
        insertPara(...data);
    });

    addHandler('pasteCB', function(data) {
        pasteCB(...data);
    });

    addHandler('deletePara', function(data) {
        deletePara(...data);
    });

    addHandler('applyDiff', function(data) {
        applyDiff(data);
    });

    addHandler('lock', function(pids) {
        lockParas(pids);
    });

    addHandler('unlock', function(pids) {
        unlockParas(pids);
    });

    addHandler('renderBib', function(refs) {
        cacheBib(refs);
    });

    addHandler('deleteCite', function(key) {
        deleteCite(key);
    });
}

function syncRefs() {
    console.log('init global refs');
    $('.para:not(.folder)').each(function() {
        let para = $(this);
        updateRefHTML(para);
    });
    sendCommand('update_g_ref', {'aid': config.aid, 'g_ref': false}, function(response) {
        console.log(`g_ref set to '${response}'`);
    });
}

function eventArticle() {
    // core render events
    eventRender();

    // statusbar
    $(document).on('click', '#logo', toggleSidebar);
    $(document).on('click', '#show_hist', toggleHistMap);
    $(document).on('click', '#revert_hist', revertHistory);

    // sidebar
    $(document).on('change', '#theme_select', function() {
        let tselect = $(this);
        let tchoice = tselect.children('option:selected').text();
        if (tchoice != config.theme) {
            setTheme(tchoice);
        }
    });

    $(document).on('change', '#font_select', function() {
        let fselect = $(this);
        let fchoice = fselect.children('option:selected').text();
        if (fchoice != config.font) {
            setFont(fchoice);
        }
    });

    /*
    $(document).click(function(e) {
        if (state.sidebar_show) {
            if ($(e.target).closest('#sidebar').length == 0
              && $(e.target).closest('#logo').length == 0) {
               toggleSidebar();
            }
        }
    });
    */

    // progress bar
    $('#content').scroll(function() {
        let elem = $('#content');
        let spos = elem.scrollTop();
        let shgt = elem[0].scrollHeight;
        let hout = elem.outerHeight();
        let spct = 100 * spos / (shgt - hout);
        $('#prog_bar').css('width', `${spct}%`);
    });

    // mobile hover eqiv
    if (config.mobile) {
        $(document).on('click', '.pop_anchor', function(e) {
            e.preventDefault();
            $('#pop').remove();
            let ref = $(this);
            ref.data('show_pop', true);
            let html = getTro(ref, renderPop);
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

    // drop to upload
    connectDrops(function(box, data) {
        let para = box.closest('.para');
        let key = data.key;
        let raw = `! [id=${key}|caption=none]`;
        para.attr('raw', raw);
        rawToRender(para, false);
        rawToTextarea(para);
        sendUpdatePara(para, true);
    });

    $(document).on('input', '.p_input', function(e) {
        let para = $(this).parent('.para');
        let text = para.children('.p_input');
        let view = para.children('.p_input_view');
        let raw = text.val();
        let cur = e.target.selectionStart;
        schedTimeout();
        ccRefs(view, raw, cur);
        syntaxHL(para);
    });

    $(document).on('keyup', '.p_input', function(e) {
        let arrs = [37, 38, 39, 40, 48, 57, 219, 221];
        if (arrs.includes(e.keyCode)) {
            var para = $(this).parent('.para');
            braceMatch(this, para);
        }
    });
}

/// server command editing

function updatePara(pid, raw) {
    let para = getPara(pid);
    para.attr('raw', raw);
    rawToRender(para);
}

function updateParas(para_dict) {
    for (pid in para_dict) {
        updatePara(pid, para_dict[pid]);
    }
}

function deletePara(pid) {
    let para = getPara(pid);
    let old_id;
    if (old_id = para.attr('id')) {
        let i = cache.ref.indexOf(old_id);
        if (i !== -1) {
            cache.ref.splice(i, 1);
        }
        let ref = {};
        ref.aid = config.aid;
        ref.key = old_id;
        sendCommand('delete_ref', ref, function(success) {
            console.log('success: deleted ref');
        });
    }

    para.remove();
    envClasses();
    createRefs(); // we may be able to scope this more
};

function insertParaRaw(pid, new_pid, raw='', before=true) {
    console.log('insertPara:', pid, new_pid, raw, before);
    let para = getPara(pid);
    let new_para = $('<div>', {class: 'para', pid: new_pid, raw: raw});
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
    new_para.html(innerPara);
    return new_para;
}

function insertPara(pid, new_pid, raw='', before=true) {
    let new_para = insertParaRaw(pid, new_pid, raw, before);
    rawToRender(new_para);
    rawToTextarea(new_para);
    makeActive(new_para);
    sendMakeEditable();
}

function pasteCB(pid, paste) {
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
}

function applyDiff(edits) {
    console.log('applyDiff', edits);

    $.each(edits['para_del'], (i, pid) => {
        deletePara(pid);
    });

    $.each(edits['para_upd'], (pid, raw) => {
        updatePara(pid, raw);
    });

    let adds = edits['para_add'];
    $.each(edits['position'], (i, pos) => {
        let [pid, pre] = pos;
        if (pid in adds) {
            let raw = adds[pid];
            insertPara(pre, pid, raw=raw, before=false);
        } else {
            let para = getPara(pid);
            let base = getPara(pre);
            base.after(para);
        }
    });
}

/// external references and blurbs

function createExtRef(id) {
    let tro = troFromKey(id);
    let ref = {};
    ref.aid = config.aid;
    ref.key = id;
    ref.cite_type = tro.cite_type;
    ref.cite_env = tro.cite_env;
    ref.text = popText(tro);
    ref.ref_text = tro.ref_text;
    return ref;
}

// push reference blurb changes to server
function updateRefHTML(para) {
    // get para id, old_id is for when the update is an id change
    let new_id = para.attr('id');
    let old_id = para.attr('old_id');

    // the pid of it's containing env
    let env_pid = para.attr('env_pid');
    let env_beg = para.hasClass('env_beg');

    // for this specific para
    if (new_id) {
        cache.ref.push(new_id);
        let ref = createExtRef(new_id);
        sendCommand('update_ref', ref, function(success) {
            console.log('success: updated ref');
        });
    }

    // for containing env - this should already exist
    if (env_pid && !env_beg) {
        let epar = getPara(env_pid);
        let env_id = epar.attr('id');
        if (env_id) {
            let ref = createExtRef(env_id);
            sendCommand('update_ref', ref, function(success) {
                console.log('success: updated ref');
            });
        }
    }

    // check if this was obscuring another same-id para? otherwise delete
    if (old_id) {
        let old_para = $(`#${old_id}`);
        if (old_para.length > 0) {
            let ref = createExtRef(old_id);
            sendCommand('update_ref', ref, function(success) {
                console.log('success: updated ref');
            });
        } else {
            let i = cache.ref.indexOf(old_id);
            if (i !== -1) {
                cache.ref.splice(i, 1);
            }
            let ref = {};
            ref.aid = config.aid;
            ref.key = old_id;
            sendCommand('delete_ref', ref, function(success) {
                console.log('success: deleted ref');
            });
        }
    }
}

function getBlurb(len=200) {
    let blurb = '';
    let size = 0;
    $('.para').not('.folder').each(function() {
        let para = $(this);
        let ptxt = para.children('.p_text').clone();
        let core = ptxt.find('.katex-mathml, .eqnum, img, svg').remove().end()
                       .removeClass('p_text');

        let html = core[0].outerHTML;
        blurb += html + ' ';

        let text = core.text();
        size += text.length;

        if (size > len) {
            blurb += '...';
            return false;
        }
    });
    return blurb;
}

function setBlurb() {
    let blurb = getBlurb();
    sendCommand('set_blurb', {'aid': config.aid, 'blurb': blurb}, function(success) {
        console.log('blurb set');
    });
}

/// sidebar

function themeLink(name) {
    return $('<link>', {
        id: 'theme',
        type: 'text/css',
        rel: 'stylesheet',
        href: `/static/themes/${name}.css`,
    });
}

function toggleSidebar() {
    $('#sidebar').animate({width: 'toggle'}, 100);
    $('#logo').toggleClass('opened');
    $('#content').toggleClass('sb_content');
    state.sidebar_show = !state.sidebar_show;
}

function setTheme(theme) {
    config.theme = theme;
    let tset = (theme == 'default') ? 'classic' : theme;
    setCookie('theme', theme);
    $('#theme').remove();
    let link = themeLink(tset);
    $('head').append(link);
}

function setFont(font) {
    config.font = font;
    let fset = (font == 'default') ? '' : font;
    setCookie('font', font);
    $('#content').css('font-family', fset);
}

function initSidebar() {
    let theme_select = $('#theme_select');
    let font_select = $('#font_select');

    makeSelect(theme_select);
    makeSelect(font_select);

    setSelect(theme_select, config.theme);
    setSelect(font_select, config.font);

    setTheme(config.theme);
    setFont(config.font);
}

function showOption(sel1, opt) {
    sel1.find('.custom-option').removeClass('selection');
    opt.addClass('selection');

    let txt = opt.text();
    sel1.removeClass('opened');
    sel1.find('.custom-select-trigger').text(txt);
}

function setSelect(sel, txt) {
    let wrap = sel.parents('.custom-select-wrapper');
    let sel1 = wrap.find('.custom-select');

    let trig = sel1.find('.custom-select-trigger');
    if (trig.text() == txt) {
        return;
    }

    let opt = sel1.find('.custom-option')
                  .filter((i, x) => x.innerText == txt)
                  .first();
    if (opt.length == 0) {
        return;
    }

    let val = opt.data('value');
    sel.val(val);

    showOption(sel1, opt);
}

function makeSelect(sel) {
    let cls   = sel.attr('class'),
        id    = sel.attr('id'),
        name  = sel.attr('name'),
        place = sel.attr('placeholder');

    let template = [
        '<div>',
        `<div class="custom-select ${cls}">`,
        `<span class="custom-select-trigger">${place}</span>`,
        '<div class="custom-options">'
    ];

    sel.find('option').each(function() {
        let opt = $(this);
        let value = opt.attr('value'),
            html  = opt.html();
        template.push(
            `<span class="custom-option" data-value="${value}">${html}</span>`
        );
    });

    template.push('</div>');
    template = template.join('\n');
    let temp = $(template);

    sel.wrap('<div class="custom-select-wrapper"></div>');
    sel.hide();
    sel.after(temp);

    let sel1 = temp.find('.custom-select');

    temp.find('.custom-option:first-of-type').hover(function() {
        $(this).parents('.custom-options').addClass('option-hover');
    }, function() {
        $(this).parents('.custom-options').removeClass('option-hover');
    });

    temp.find('.custom-select-trigger').on('click', function() {
        $('html').one('click', function() {
            sel1.removeClass('opened');
        });
        sel1.toggleClass('opened');
        event.stopPropagation();
    });

    temp.find('.custom-option').on('click', function() {
        let opt = $(this);
        let val = opt.data('value');

        sel.val(val);
        sel.trigger('change');

        showOption(sel1, opt);
    });
}

/// history

function localDate(d) {
    let d1 = new Date(d);
    d1.setTime(d1.getTime()-(d1.getTimezoneOffset()*60*1000));
    return d1;
}

function paraReadonly(pid, raw) {
    let para = $('<div>', {class: 'para', pid: pid, raw: raw});
    let ptxt = $('<div>', {class: 'p_text'});
    let pviw = $('<div>', {class: 'p_input_view'});
    let pinp = $('<textarea>', {class: 'p_input', val: raw});
    pinp.prop('readonly', true);
    para.append(ptxt);
    para.append(pviw);
    para.append(pinp);
    return para;
}

function renderPreview(hist) {
    let preview = $('#preview');
    let content = $('#content');

    let pid0 = state.active_para ? state.active_para.attr('pid') : null;
    let ppos = state.active_para ? state.active_para.position().top : null;
    let cpos = content.scrollTop();

    preview.empty();

    let new_active = null;
    $.each(hist.paras, (i, p) => {
        let [pid, raw] = p;
        let para = paraReadonly(pid, raw);
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
        cpos = preview.scrollTop() + state.active_para.position().top - ppos;
    }
    preview.scrollTop(cpos);
}

function initHistory(data) {
    // fixed params // different for mobile
    let hpadding = config.mobile ? 20 : 50;
    let radius = config.mobile ? 6 : 4;

    // these should be dynamic
    let width = window.innerWidth;
    let height = config.mobile ? 150 : 100;

    // clean house
    let hist = d3.select('#hist');
    hist.selectAll('*').remove();

    // create svg element
    let svg = hist.append('svg')
        .attr('id', 'svgg')
        .attr('width', width)
        .attr('height', height)
        .on('click', generalClick)
        .call(responsivefy);

    // scaleEx controls how zoomed we go
    let zoom = d3.zoom()
        .scaleExtent([0.5, 5000])
        .translateExtent([[-100, -100], [width + 90, height + 100]])
        .on('zoom', zoomed);

    let x = d3.scaleTime()
        .range([hpadding, width - hpadding]);

    let xAxis = d3.axisBottom(x)
        .ticks(10)
        .tickSize(5)
        .tickPadding(-20);

    let gX = svg.append('g')
        .attr('class', 'axis--x')
        .attr('transform', `translate(0,${0.7*height})`)
        .call(xAxis);

    let gDot = svg.append('g')
        .attr('fill', 'none')
        .attr('stroke-linecap', 'round');

    svg.call(zoom);

    function zoomed() {
        // store transform
        let zTrans = d3.event.transform.rescaleX(x);
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
        let tooltip = d3.select('#bg').append('div')
            .attr('id',  `hp_${i}`)  // Create an id for text so we can select it later for removing on mouseout
            .attr('class', 'hist_pop')
            .text(d.date.toLocaleString());

        let ttw = tooltip.node().getBoundingClientRect().width;
        let tth = tooltip.node().getBoundingClientRect().height;

        let left = d3.event.pageX - ttw/2;
        let right = d3.event.pageY - tth - 10

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

        sendCommand('get_history', {'aid': config.aid, 'date': d.commit}, renderPreview);
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
        let xmax = new Date(Date.now());
        xmax.setHours(xmax.getHours()+1);

        // get date min
        let xmin0 = d3.min(data.map(d => d.date));

        // round date range
        let xrange = (xmax - xmin0)/(1000*60*60); // hours
        let xdel;
        if (xrange <= 1) {
            xdel = 1;
        } else if (xrange <= 24) {
            xdel = 24;
        } else {
            xdel = xrange;
        }

        // set rounded min
        let xmin = new Date(xmax);
        xmin.setHours(xmin.getHours()-xdel-1);

        // rescale axis
        x.domain([xmin, xmax]);
        gX.call(xAxis);

        // remove old circles
        gDot.selectAll('circle').remove();

        // add new circles
        let zTrans = xAxis.scale();
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
}

function launchHistMap() {
    sendCommand('get_commits', {'aid': config.aid}, function(dates) {
        updateHistMap(
            dates.map(d => ({
                'commit': d,
                'date': localDate(d)
            }))
        );
        $('#hist').show();
    });
}

function hideHistPreview() {
    let preview = $('#preview');
    let content = $('#content');

    $('#revert_hist').removeClass('selected');
    $('.hist_pop').remove();

    let cpos = preview.scrollTop();
    let ppos = state.active_para ? state.active_para.position().top : null;

    content.show();
    preview.hide();

    if (state.active_para) {
        let pid = state.active_para.attr('pid');
        let para = content.children(`[pid=${pid}]`);
        let new_active = (para.length > 0) ? para : null;

        // make active and align scroll
        makeActive(new_active, false);
        if (ppos !== null) {
            cpos = content.scrollTop() + state.active_para.position().top - ppos;
        }
    }

    content.scrollTop(cpos);
    preview.empty();
    createTOC(content);
}

function toggleHistMap() {
    $('#hist').toggle();
    if (state.hist_vis) {
        hideHistPreview();
        $('#prog_bar').show();
    } else {
        launchHistMap();
        $('#prog_bar').hide();
    }
    state.hist_vis = !state.hist_vis;
    setWriteable(!config.readonly && !state.hist_vis);
}

function revertHistory() {
    let act = d3.selectAll('circle.active');
    if (act.empty()) {
        return;
    }
    let data = act.datum();
    let args = {aid: config.aid, date: data.commit};
    sendCommand('revert_history', args, on_success(launchHistMap));
}

function responsivefy(svg) {
    let width = window.innerWidth;
    let height = svg.attr('height'); // config.mobile ? 150 : 100;
    let aspect = width / height;

    // add viewBox and preserveAspectRatio properties,
    svg.attr("viewBox", "0 0 " + width + " " + height)
       .attr("preserveAspectRatio", "xMinYMid")
       .call(resize);

    d3.select(window).on("resize", resize);

    // get width of container and resize svg to fit it
    function resize() {
        let targetWidth = window.innerWidth;
        svg.attr("width", targetWidth);
        svg.attr("height", Math.round(targetWidth / aspect));
    }
}

/// reference completion

function ccNext(dir) {
    let ccpop = $('#cc_pop')[0];
    if (dir == 'up') {
        let f = ccpop.firstElementChild;
        ccpop.appendChild(f); //apend first to end
    } else if (dir == 'down') {
        let l = ccpop.lastElementChild;
        ccpop.prepend(l); //append last child before first
    }
}

function ccMake() {
    let cctxt = $('.cc_row').first().text();
    let input = state.active_para.children('.p_input');
    let raw = input.val();
    let open_ref = /@(\[|@)?([\w-\|\=^]+)?(\:)?([\w-\|\=^]+)?(?!.*\])([\s\n]|$)/;
    let open_i_link = /\[\[([\w-\|\=^]+)?(?!.*\])([\s\n]|$)/;
    let cap, l;
    if (cap = open_ref.exec(raw)) {
        l = cap.index;
        let space = cap[5] || ""
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
        l = cap.index;
        let space = cap[2] || ""
        raw = raw.replace(open_i_link, function() {
            const out = `[[${cctxt}]]${space}`;
            l = l + out.length - space.length
            return out;
        });
    }
    input.val(raw);
    resize(input[0]);
    syntaxHL(state.active_para);
    state.cc = false;
    $('#cc_pop').remove();
    input[0].setSelectionRange(l, l);
}

/// command completion

function ccSearch(list, search, placement) {
    list = list.filter(el => el.includes(search));
    if (list.length > 0) {
        state.cc = true;
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
}

// show command completion popup for references (@[]) and article links ([[]])
function ccRefs(view, raw, cur) {
    state.cc = false;
    $('#cc_pop').remove();
    let open_ref = /@(\[|@)?([\w-\|\=^]+)?(\:)?([\w-\|\=^]+)?(?!.*\])(?:[\s\n]|$)/;
    let open_i_link = /\[\[([\w-\|\=^]+)?(?!.*\])(?:[\s\n]|$)/;
    let cap;
    if (cap = open_ref.exec(raw)) {
        // if cursor is near the match
        let b = cap.index;
        let e = b + cap[0].length;
        if (cur >= b && cur <= e) {
            raw = raw.slice(0, e) + '<span id="cc_pos"></span>' + raw.slice(e);
            view.html(raw);
            let off = $('#cc_pos').offset();
            let p = {'left': off.left, 'top': off.top + $('#cc_pos').height()};
            if (cap[1]=='@') { //bib search
                let search = cap[2] || '';
                ccSearch(Object.keys(cache.bib), search, p);
            } else if (cap[3] && !cap[2]) { // searching for ext page
                let ex_keys = Object.keys(cache.ext_ref);
                if (ex_keys.length == 0) { // if we have not made request
                    sendCommand('get_arts', '', function(arts) {
                        cache.ext_ref = arts;
                        ccSearch(Object.keys(arts), '', p);
                    });
                } else {
                    let search = cap[4] || '';
                    ccSearch(ex_keys, search, p);
                }
            } else if (cap[2] && cap[3]) {
                sendCommand('get_refs', {'title': cap[2]}, function(data) {
                    if (data.refs.length > 0) {
                        cache.ext_ref[data.title] = data.refs;
                    }
                    ccSearch(data.refs, '', p);
                });
            } else {
                let search = cap[4] || cap[2] || '';
                ccSearch(cache.ref, search, p);
            }
        }
    } else if (cap = open_i_link.exec(raw)) {
        let b = cap.index;
        let e = b + cap[0].length;
        if (cur >= b && cur <= e) {
            raw = raw.slice(0, e) + '<span id="cc_pos"></span>' + raw.slice(e);
            view.html(raw);
            let off = $('#cc_pos').offset();
            let p = {'left': off.left, 'top': off.top + $('#cc_pos').height()};
            let ex_keys = Object.keys(cache.ext_ref);
            if (ex_keys.length == 0) { // if we have not made request
                sendCommand('get_arts', '', function(arts) {
                    cache.ext_ref = arts;
                    search = '';
                    ccSearch(Object.keys(arts), search, p);
                });
            } else {
                search = cap[1] || '';
                ccSearch(ex_keys, search, p);
            }
        }
    }
}
