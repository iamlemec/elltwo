/* main article entry point */

export {
    loadArticle, insertParaRaw, insertPara, deleteParas, updatePara,
    updateParas, updateRefs, toggleHistMap, toggleSidebar, ccNext, ccMake,
    ccRefs, textWrap
}

import {
    mapValues, on_success, setCookie, cooks, getPara, getEnvParas, KeyCache
} from './utils.js'
import {
    config, state, cache, updateConfig, updateState, updateCache
} from './state.js'
import {
    connect, addHandler, sendCommand, schedTimeout, setTimeoutHandler
} from './client.js'
import { initUser } from './user.js'
import {
    stateRender, initRender, eventRender, innerPara, rawToRender, rawToTextarea,
    envClasses, envGlobal, createTOC, getTro, troFromKey, popText, syntaxHL,
    braceMatch, renderRefText, getRefTags, untrackRef, doRenderRef, barePara
} from './render.js'
import {
    initEditor, stateEditor, eventEditor, resize, makeActive, lockParas,
    unlockParas, sendMakeEditable, sendUpdatePara, storeChange, placeCursor,
    makeUnEditable
} from './editor.js'
import { connectDrops, promptUpload, uploadImage, makeImageBlob } from './drop.js'
import { initExport } from './export.js'
import { initHelp } from './help.js'
import { createBibInfo } from './bib.js'

// history
let updateHistMap;

/// initialization

let default_config = {
    theme: 'classic', // theme to use
    font: 'default', // font to use
    timeout: 180, // para lock timeout
    max_size: 1024, // max image size
    readonly: true, // is session readonly
    ssv_persist: false, // start in ssv mode
    edit_persist: false, // start in edit mode
    title: null, // default article title
    aid: null, // article identifier
};

let default_state = {
    sidebar_show: false, // is sidebar shown
    help_show: false, // is help overlay on
    hist_show: false, // is history mode on
    ssv_mode: false, // whether we're in side-by-side mode
    edit_mode: false, // whether we're in edit mode
    active_para: null, // current active para
    last_active: null, // to keep track of where cursor was
    rawtext: false, // are we showing the raw textarea
    writeable: false, // can we actually modify contents
    cc: false, // is there a command completion window open
    cb: [], // clipboard for cell copy
};

function stateArticle() {
    stateRender();
    stateEditor();
    updateState(default_state);
}

function cacheArticle() {
    // external references/popups
    cache.ext = new KeyCache('ext', function(key, callback) {
        let [title, refkey] = key.split(':');
        sendCommand('get_ref', {title: title, key: refkey}, function(ret) {
            let data = (ret !== undefined) ? ret : null;
            callback(data);
        });
    });

    // article link/blurb
    cache.link = new KeyCache('link', function(key, callback) {
        sendCommand('get_link', {title: key}, function(ret) {
            let data = (ret !== undefined) ? ret : null;
            callback(data);
        });
    });

    // bibliography (external citations)
    cache.cite = new KeyCache('cite', function(key, callback) {
        sendCommand('get_cite', {key: key}, function(ret) {
            let cite = (ret !== undefined) ? createBibInfo(ret) : null;
            callback(cite);
        });
    }, function(keys, callback) {
        sendCommand('get_bib', {keys: keys}, function(ret) {
            let cites = Object.fromEntries(keys.map(k =>
                [k, (k in ret) ? createBibInfo(ret[k]) : null]
            ));
            callback(cites);
        });
    });

    // image cache
    cache.img = new KeyCache('img', function(key, callback) {
        sendCommand('get_image', {key: key}, function(ret) {
            let url = (ret !== undefined) ? makeImageBlob(ret.mime, ret.data) : null;
            callback(url);
        });
    });

    // external reference completion
    cache.list = new KeyCache('list', function(key, callback) {
        if (key == '__art') {
            sendCommand('get_arts', {}, callback);
        } else if (key == '__bib') {
            sendCommand('get_bibs', {}, callback);
        } else if (key == '__img') {
            sendCommand('get_imgs', {}, callback);
        } else {
            sendCommand('get_refs', {title: key}, callback);
        }
    });
}

function initArticle() {
    initRender();
    initUser();
    initSidebar();
    initHistory();
    initExport();
    initHelp();
    initEditor();
}

function loadArticle(args) {
    // load in server side config/cache
    updateConfig(default_config, args.config ?? {});

    // initialize full state
    cacheArticle();
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

    // update button state (persistent)
    let ssv0 =  config.ssv_persist && (cooks('ssv_mode') ?? false);
    let edit0 = config.edit_persist && (cooks('edit_mode') ?? false);

    // connect events
    eventArticle();

    // set config modes via toggles
    $('#ssv_check').prop('checked', ssv0).change();
    $('#edit_check').prop('checked', edit0).change();
}

function setSsvMode(val) {
    console.log('ssv', state.ssv_mode);
    state.ssv_mode = val;
    $('#content').toggleClass('ssv', val);
    $('.para:not(.folded)').each(function() {
        let para = $(this);
        let input = para.children('.p_input');
        syntaxHL(para);
        resize(input[0]);
        placeCursor('end');
    });
}

function setEditMode(ro) {
    state.edit_mode = ro && !state.readonly;
    setWriteable();
}

function setWriteable() {
    let wr = !config.readonly && !state.hist_show && state.edit_mode;

    let wr_old = state.writeable;
    state.writeable = wr;
    $('#bg').toggleClass('writeable', wr);

    if (state.rawtext) {
        let para = state.active_para;
        let pid = state.active_para.attr('pid');
        let text = para.children('.p_input');

        if (wr && !wr_old) {
            let data = {pid: pid, aid: config.aid};
            sendCommand('lock', data, function(response) {
                if (response) {
                    text.prop('readonly', false);
                    placeCursor('end');
                    schedTimeout();
                }
            });
        } else if (!wr && wr_old) {
            text.prop('readonly', true);
            storeChange(para);
        }
    }}

function connectServer() {
    let url = `http://${document.domain}:${location.port}`;
    connect(url, () => {
        sendCommand('join_room', {'room': config.aid, 'get_locked': true}, (response) => {
            lockParas(response);
        });
    });

    setTimeoutHandler(function() {
        makeUnEditable(false);
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

    addHandler('pasteParas', function(data) {
        pasteParas(...data);
    });

    addHandler('deleteParas', function(data) {
        deleteParas(...data);
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

    addHandler('invalidateRef', function(data) {
        invalidateRef(...data);
    });
}

function syncRefs() {
    console.log('init global refs');
    $('.para:not(.folder)').each(function() {
        let para = $(this);
        updateRefs(para);
    });
    sendCommand('update_g_ref', {'aid': config.aid, 'g_ref': false}, function(response) {
        console.log(`g_ref set to '${response}'`);
    });
}

function eventArticle() {
    // core render events
    eventRender();
    eventEditor();

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

    // progress bar
    $('#content').scroll(function() {
        let elem = $('#content');
        let spos = elem.scrollTop();
        let shgt = elem[0].scrollHeight;
        let hout = elem.outerHeight();
        let spct = 100 * spos / (shgt - hout);
        $('#prog_bar').css('width', `${spct}%`);
    });

    // drop to upload
    connectDrops(function(box, data) {
        let para = box.closest('.para');
        let key = data.key;
        let raw = `! [id=${key}|caption=none]`;
        para.attr('raw', raw);
        para.addClass('changed');
        rawToTextarea(para);
        rawToRender(para, false);
        sendUpdatePara(para, raw);
    });

    // upload replacement image
    $(document).on('click', '.img_update', function() {
        let para = $(this).closest('.para');
        let key = para.attr('id');
        promptUpload(function(files) {
            let file = files[0];
            console.log(key, file);
            let ret = uploadImage(file, key, function(data) {
                rawToRender(para, false);
            });
        });
    });

    // syntax highlighting and brace matching
    $(document).on('input', '.p_input', function(e) {
        let para = $(this).parent('.para');
        let text = para.children('.p_input');
        let view = para.children('.p_input_view');
        let raw = text.val();
        let cur = e.target.selectionStart;
        schedTimeout();
        ccRefs(view, raw, cur);
        syntaxHL(para);
        if (state.ssv_mode) {
            rawToRender(para, false, false, raw);
        }
    });

    $(document).on('keyup', '.p_input', function(e) {
        let arrs = [37, 38, 39, 40, 48, 57, 219, 221];
        if (arrs.includes(e.keyCode)) {
            var para = $(this).parent('.para');
            braceMatch(this, para);
        }
    });

    $(document).on('change', '#ssv_check', function() {
        let check = $(this);
        let val = check.is(':checked');
        let text = val ? 'Split View' : 'Classic View';
        $('#ssv_text').text(text);
        setSsvMode(val);
        setCookie('ssv_mode', val);
    });

    $(document).on('change', '#edit_check', function() {
        let check = $(this);
        let val = check.prop('checked');
        let text = val ? 'Editing' : 'Readonly';
        $('#edit_text').text(text);
        setEditMode(val);
        setCookie('edit_mode', val);
    });
}

/// server command editing

function updatePara(pid, raw) {
    let para = getPara(pid);
    para.attr('raw', raw);
    rawToTextarea(para);
    rawToRender(para);
}

function updateParas(para_dict) {
    for (pid in para_dict) {
        updatePara(pid, para_dict[pid]);
    }
}

function deleteParas(pids) {
    let do_env = false;

    for (const pid of pids) {
        let para = getPara(pid);
        do_env ||= para.hasClass('env_beg') || para.hasClass('env_end') || para.hasClass('env_one');

        let fold = $(`.folded[fold_pid=${pid}]`);
        fold.remove();

        let old_id = para.attr('id');
        if (old_id) {
            let ref = {aid: config.aid, key: old_id};
            sendCommand('delete_ref', ref, function(success) {
                console.log('success: deleted ref');
            });
        }

        let old_ref = getRefTags(para);
        old_ref.forEach((key) => {
            cache.track.dec(key);
        });

        para.remove();
    }

    if (do_env) {
        envClasses();
    }
};

function insertParaRaw(pid, new_pid, raw='', after=true) {
    let para = getPara(pid);
    let env_pid = para.attr('env_pid');
    let new_para = barePara(new_pid, raw);
    let do_env = false;

    if (after) {
        if (env_pid !== undefined && !para.hasClass('env_end')) {
            new_para.attr('env_pid', env_pid);
            do_env = true;
        }
        para.after(new_para);
    } else {
        if (env_pid !== undefined && !para.hasClass('env_beg')) {
            new_para.attr('env_pid', env_pid);
            do_env = true;
        }
        let prev = para.prev();
        if (prev.hasClass('folder')) {
            prev.before(new_para);
        } else {
            para.before(new_para);
        }
    }

    new_para.html(innerPara);
    rawToTextarea(new_para);

    if (do_env) {
        let env_paras = getEnvParas(env_pid);
        envClasses(env_paras);
    }

    return new_para;
}

function insertPara(pid, new_pid, raw='', after=true) {
    let new_para = insertParaRaw(pid, new_pid, raw, after);
    rawToRender(new_para);
    return new_para;
}

function pasteParas(pid, paste) {
    let para_act = null;
    paste.forEach(d => {
        const [new_pid, text] = d;
        para_act = insertParaRaw(pid, new_pid, text, true);
        rawToRender(para_act, true); // defer
        pid = new_pid;
    })
    envClasses();
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
            insertPara(pre, pid, raw, true);
        } else {
            let para = getPara(pid);
            let base = getPara(pre);
            base.after(para);
        }
    });
}

/// cache management

function invalidateRef(type, refkey) {
    console.log('invalidateRef', type, refkey);

    if (type == 'ext') {
        cache.ext.del(refkey);
    } else if (type == 'link') {
        cache.link.del(refkey);
    } else if (type == 'cite') {
        cache.cite.del(refkey);
    } else if (type == 'img') {
        cache.img.del(img);
    } else if (type == 'list') {
        cache.list.del(refkey);
    }

    if (type == 'ext' || type == 'link' || type == 'cite') {
        let rk1 = refkey.replace(':', '\\:');
        let refs = $(`.reference[reftype=${type}][refkey=${rk1}]`);
        refs.each(function() {
            let r = $(this);
            doRenderRef(r);
        });
    }
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

function sendUpdateRef(pid) {
    let ref = createExtRef(pid);
    sendCommand('update_ref', ref, function(success) {
        console.log(`updated ref ${pid}`);
    });
}

function sendDeleteRef(pid) {
    let ref = {aid: config.aid, key: pid};
    sendCommand('delete_ref', ref, function(success) {
        console.log(`deleted ref ${pid}`);
    });
}

// push reference/blurb changes to server
function updateRefs(para) {
    // get para id, old_id is for when the update is an id change
    let new_id = para.attr('id');
    let old_id = para.attr('old_id');

    // the pid of it's containing env
    let env_pid = para.attr('env_pid');
    let env_beg = para.hasClass('env_beg');

    // for this specific para
    if (new_id) {
        sendUpdateRef(new_id);
    }

    // for containing env - this should already exist
    if (env_pid && !env_beg) {
        let env_par = getPara(env_pid);
        let env_id = env_par.attr('id');
        if (env_id) {
            sendUpdateRef(env_id);
        }
    }

    // check if this was obscuring another same-id para? otherwise delete
    if (old_id) {
        para.removeAttr('old_id');
        let old_par = $(`#${old_id}`);
        if (old_par.length > 0) {
            sendUpdateRef(old_id);
        } else {
            sendDeleteRef(old_id);
        }
    }
}

function getBlurb(len=200, max=5) {
    let blurb = '';
    let size = 0;
    let npar = 0;
    $('.para').not('.folder').each(function() {
        let para = $(this);
        let ptxt = para.children('.p_text').clone();
        let core = ptxt.find('.katex-mathml, .eqnum, .img_update, .dropzone, img, svg').remove().end()
                       .removeClass('p_text');

        let text = core.text();
        if (text.trim().length == 0) {
            return true;
        }

        let html = core[0].outerHTML;
        blurb += html + ' ';
        size += text.length;
        npar += 1;

        if (size > len || npar > max) {
            blurb += '...';
            return false;
        }
    });
    return blurb;
}

function setBlurb() {
    let blurb = getBlurb();
    sendCommand('set_blurb', {'aid': config.aid, 'blurb': blurb});
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

    let paras = preview.children('.para:not(.folder)');
    envClasses(paras);
    envGlobal(preview);

    $.each(hist.diff, (i, pid) => {
        $(`#preview > .para[pid="${pid}"`).addClass('hl_change');
    });

    preview.show();
    content.hide();

    // make active and ensure same relative position
    if (new_active !== null) {
        makeActive(new_active, false);
        if (ppos !== null) {
            cpos = preview.scrollTop() + state.active_para.position().top - ppos;
        }
        preview.scrollTop(cpos);
    }
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
        // get date range
        let dates = data.map(d => d.date);
        let xmin0 = d3.min(dates);
        let xmax0 = d3.max(dates);
        let xlim0 = (xmax0-xmin0)/1000; // seconds

        // get padded range
        let xmin = new Date(xmin0);
        let xmax = new Date(xmax0);
        xmin.setSeconds(xmin.getSeconds()-0.1*xlim0);
        xmax.setSeconds(xmax.getSeconds()+0.1*xlim0);

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
        content.scrollTop(cpos);
    }

    preview.empty();
    createTOC();
}

function toggleHistMap() {
    $('#hist').toggle();
    if (state.hist_show) {
        hideHistPreview();
        $('#prog_bar').show();
        $('#ssv_text').show();
        $('#ssv_label').show();
        $('#edit_text').show();
        $('#edit_label').show();
    } else {
        launchHistMap();
        $('#prog_bar').hide();
        $('#ssv_text').hide();
        $('#ssv_label').hide();
        $('#edit_text').hide();
        $('#edit_label').hide();
    }
    state.hist_show = !state.hist_show;
    setWriteable();
}

function revertHistory() {
    let act = d3.selectAll('circle.active');
    if (act.empty()) {
        return;
    }
    let data = act.datum();
    let args = {aid: config.aid, date: data.commit};
    sendCommand('revert_history', args, on_success(() => {
        hideHistPreview();
        launchHistMap();
        $('#content').focus();
    }));
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

/// hotkesys

function textWrap(para,cur,d) {
    let input = para.children('.p_input');
    let raw = input.val();
    let b = raw.slice(0, cur[0])
    let m = raw.slice(cur[0], cur[1])
    let e = raw.slice(cur[1], raw.length)
    raw = b + d[0] + m + d[1] + e;
    input.val(raw);
    resize(input[0]);
    syntaxHL(state.active_para);
    let c = (cur[0]==cur[1]) ? cur[0]+d[0].length : cur[1]+d[0].length + d[1].length
    input[0].setSelectionRange(c,c);
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
    let para = state.active_para;
    let input = para.children('.p_input');
    let raw = input.val();
    let open_ref = /@(\[|@)?([\w-\|\=^]+)?(\:)?([\w-\|\=^]+)?(?!.*\])([\s\n]|$)/;
    let open_i_link = /\[\[([\w-\|\=^]+)?(?!.*\])([\s\n]|$)/;
    let open_img = /^\!(\[)?([\w-\|\=^]+)?(?!.*\])([\s\n]|$)/;

    let cap, l;
    let iter = false //true iterates the process (for ext art refs)
    if (cap = open_ref.exec(raw)) {
        l = cap.index;
        let space = cap[5] || '';
        if (cap[3] && !cap[2]) { // start ext page
           raw = raw.replace(open_ref, function() {
                const out = `@[${cctxt}:${space}`;
                l += out.length - space.length;
                iter=true;
                return out;
            });
        } else if (cap[2] && cap[3]) { // ref on ext page
            raw = raw.replace(open_ref, function() {
                const out = `@[${cap[2]}:${cctxt}]${space}`;
                l += out.length - space.length;
                return out;
            });
        } else if (cap[1] == '@') { // external citation
            raw = raw.replace(open_ref, function() {
                const out = `@@[${cctxt}]${space}`;
                l += out.length - space.length;
                return out;
            });
        } else { // internal reference
            raw = raw.replace(open_ref, function() {
                const out = `@[${cctxt}]${space}`;
                l += out.length - space.length;
                return out;
            });
        }
    } else if (cap = open_i_link.exec(raw)) {
        l = cap.index;
        let space = cap[2] || '';
        raw = raw.replace(open_i_link, function() {
            const out = `[[${cctxt}]]${space}`;
            l += out.length - space.length;
            return out;
        });
    } else if (cap = open_img.exec(raw)) {
        l = cap.index;
        let space = cap[2] || '';
        raw = raw.replace(open_img, function() {
            const out = `![${cctxt}]${space}`;
            l += out.length - space.length;
            return out;
        });
    }
    input.val(raw);
    resize(input[0]);
    syntaxHL(state.active_para);
    state.cc = false;
    $('#cc_pop').remove();
    input[0].setSelectionRange(l, l);
    if(iter){
        let view = para.children('.p_input_view');
        ccRefs(view, raw, l);
    }
}

/// command completion

function getInternalRefs() {
    return $('.para:not(.folder):is(.env_beg,.env_one)[id]').map((i, x) => x.id).toArray();
}

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
    let open_img = /^\!(\[)?([\w-\|\=^]+)?(?!.*\])(?:[\s\n]|$)/;
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
            if (cap[1] == '@') { // bib search
                let search = cap[2] || '';
                cache.list.get('__bib', function(ret) {
                    ccSearch(ret, search, p);
                });
            } else if (cap[3] && !cap[2]) { // searching for ext page
                let search = cap[4] || '';
                cache.list.get('__art', function(ret) {
                    ccSearch(ret, search, p);
                });
            } else if (cap[2] && cap[3]) {
                let title = cap[2];
                cache.list.get(title, function(ret) {
                    ccSearch(ret, '', p);
                });
            } else {
                let search = cap[4] || cap[2] || '';
                let in_refs = getInternalRefs();
                ccSearch(in_refs, search, p);
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
            let search = cap[4] || '';
            let ex_keys = cache.list.get('__art', function(ret) {
                ccSearch(ret, search, p);
            });
        }
    } else if (cap = open_img.exec(raw)) {
        let b = cap.index;
        let e = b + cap[0].length;
        if (cur >= b && cur <= e) {
            raw = raw.slice(0, e) + '<span id="cc_pos"></span>' + raw.slice(e);
            view.html(raw);
            let off = $('#cc_pos').offset();
            let p = {'left': off.left, 'top': off.top + $('#cc_pos').height()};
            let search = cap[2] || '';
            let ex_keys = cache.list.get('__img', function(ret) {
                ccSearch(ret, search, p);
            });
        }
    }
}
