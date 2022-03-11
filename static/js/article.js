/* main article entry point */

export {
    loadArticle, insertParaRaw, insertPara, deleteParas, updatePara,
    updateParas, updateRefs, toggleHistMap, toggleSidebar, ccNext, ccMake,
    ccRefs,
}

import {
    mapValues, on_success, setCookie, cooks, getPara, getEnvParas, 
    KeyCache, merge, unEscCharCount, flash, detectBrowser,
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
    envClasses, envGlobal, createTOC, troFromKey, popText, elltwoHL,
    renderRefText, getRefTags, untrackRef, doRenderRef, barePara, makeEditor, getEditor
} from './render.js'
import {
    initEditor, stateEditor, eventEditor, makeActive, lockParas,
    unlockParas, sendMakeEditable, sendUpdatePara, storeChange, placeCursor,
    makeUnEditable, initDrag
} from './editor.js'
import { connectDrops, promptUpload, uploadImage } from './drop.js'
import { initExport } from './export.js'
import { initHelp } from './help.js'
import { createBibInfo } from './bib.js'
import { initSVGEditor, hideSVGEditor, parseSVG, openSVGFromKey } from './svg.js'
import { renderKatex} from './math.js'
import { tex_cmd } from '../libs/tex_cmd.js'

// history
let updateHistMap;

/// initialization

let default_config = {
    theme: 'classic', // theme to use
    font: 'default', // font to use
    cmd: 'on', //
    timeout: 180, // para lock timeout
    max_size: 1024, // max image size
    readonly: true, // is session readonly
    ssv_persist: false, // start in ssv mode
    edit_persist: false, // start in edit mode
    always_hover: false, // hover bar in read-only
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
    editors: new Map(), // pid → editor map
};

function stateArticle() {
    stateRender();
    stateEditor();
    updateState(default_state);
}

function cacheArticle() {
    // external references/popups
    cache.ext = new KeyCache('ext', async function(key) {
        let [title, refkey] = key.split(':');
        let ret = await sendCommand('get_ref', {title: title, key: refkey});
        return (ret !== undefined) ? ret : null;
    });

    // article link/blurb
    cache.link = new KeyCache('link', async function(key) {
        let ret = await sendCommand('get_link', {title: key});
        return (ret !== undefined) ? ret : null;
    });

    // bibliography (external citations)
    cache.cite = new KeyCache('cite', async function(key) {
        let ret = await sendCommand('get_cite', {key: key});
        return (ret !== undefined) ? createBibInfo(ret) : null;
    }, async function(keys) {
        let ret = await sendCommand('get_bib', {keys: keys});
        return Object.fromEntries(keys.map(k =>
            [k, (k in ret) ? createBibInfo(ret[k]) : null]
        ));
    });

    // image cache
    cache.img = new KeyCache('img', async function(key) {
        let ret = await sendCommand('get_image', {key: key});
        if (ret == null) {
            return null;
        } else if (ret.mime.startsWith('image/svg+gum')) {
            return {mime: ret.mime, data: ret.data};
        } else {
            let data = new Blob([ret.data], {type: ret.mime});
            return {mime: ret.mime, data: data};
        }
    });

    // external reference completion
    cache.list = new KeyCache('list', async function(key) {
        if (key == '__art') {
            return await sendCommand('get_arts', {});
        } else if (key == '__bib') {
            return await sendCommand('get_bibs', {});
        } else if (key == '__img') {
            return await sendCommand('get_imgs', {});
        } else {
            return await sendCommand('get_refs', {title: key});
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
    initDrag();
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
    setBlurb();

    // jump to pid if specified
    let pid = args.pid ?? null;
    if (pid !== null) {
        let para = getPara(pid);
        makeActive(para);
    }

    // update button state (persistent)
    let ssv0 =  config.ssv_init=='on' || (config.ssv_persist && cooks('ssv_mode'));
    let edit0 = config.edit_persist && (cooks('edit_mode') ?? config.edit_init);

    // realize hover policy
    $('#bg').toggleClass('hover', config.always_hover);

    // connect events
    eventArticle();

    // set config modes via toggles
    $('#ssv_check').prop('checked', ssv0).change();
    $('#edit_check').prop('checked', edit0).change();

    //open editor if necessary
    if(config.SVGEditor){
        openSVGFromKey(config.SVGEditor)
    }
}

function setSsvMode(val) {
    console.log('ssv', state.ssv_mode);
    state.ssv_mode = val;
    $('#content').toggleClass('ssv', val);
    $('.para:not(.folded):not(.folder)').each(function() {
        let para = $(this);
        let input = para.children('.p_input');
        placeCursor('end');
    });
}

function setEditMode(ro) {
    state.edit_mode = ro && !state.readonly;
    setWriteable();
}

async function setWriteable() {
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
            if (await sendCommand('lock', data)) {
                text.prop('readonly', false);
                placeCursor('end');
                schedTimeout();
            }
        } else if (!wr && wr_old) {
            text.prop('readonly', true);
            storeChange(para);
        }
    }
}

function connectServer() {
    let url = `//${document.domain}:${location.port}`;
    connect(url, async function() {
        let paras = await sendCommand('join_room', {'room': config.aid, 'get_locked': true});
        lockParas(paras);
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
        deleteParas(data);
    });

    addHandler('movePara', function(data) {
        movePara(...data);
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

async function syncRefs() {
    console.log('init global refs');
    $('.para:not(.folder)').each(function() {
        let para = $(this);
        updateRefs(para);
    });
    let ret = await sendCommand('update_g_ref', {'aid': config.aid, 'g_ref': false});
    console.log(`g_ref set to "${ret}"`);
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

    $(document).on('change', '#cmd_select', function() {
        let fselect = $(this);
        let fchoice = fselect.children('option:selected').text();
        if (fchoice != config.cmd) {
            setCmd(fchoice);
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
    connectDrops(async function(box, ret) {
        let para = box.closest('.para');
        let pid = para.attr('pid');
        let data = {pid: pid, aid: config.aid};
        if (await sendCommand('lock', data)) {
            let raw = `! [id=${ret.key}|caption=none]`;
            para.attr('raw', raw);
            rawToTextarea(para);
            storeChange(para, true, true);
        }
    });

    // upload replacement image
    $(document).on('click', '.img_update', async function() {
        let upd = $(this);
        let para = upd.closest('.para');
        let key = para.attr('id');
        if (upd.hasClass('update_image/svg+gum')) {
            let ret = await cache.img.get(key)
            initSVGEditor($('#bg'), ret.data, key, true);
        } else {
            promptUpload(function(files) {
                let file = files[0];
                let ret = uploadImage(file, key, function(data) {
                    cache.img.del(key);
                    rawToRender(para, false);
                });
            });
        }
        return false;
    });

    $(document).on('click', '.open_svg_editor', function() {
        let key = $(this).attr('key');
        let pid = $(this).closest('.para');
        initSVGEditor($('#bg'), '', key, true, pid);
        return false;
    });

    // syntax highlighting and brace matching
    $(document).on('input', '.p_input:not(.svgE)', function(e) {
        let cur = e.currentTarget.selectionStart;
        let para = $(this).parent('.para');
        let editor = getEditor(para);
        let raw = editor.getText();

        // ccRefs(view, raw, cur, config.cmd); TODO: CC
        if (state.ssv_mode) {
            rawToRender(para, false, false, raw);
        }

        schedTimeout();
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

async function deleteParas(pids) {
    let do_env = false;

    for (const pid of pids) {
        let para = getPara(pid);
        do_env ||= para.hasClass('env_beg') || para.hasClass('env_end') || para.hasClass('env_one');

        let fold = $(`.folded[fold_pid=${pid}]`);
        fold.remove();

        let old_id = para.attr('id');
        if (old_id) {
            let ref = {aid: config.aid, key: old_id};
            if (await sendCommand('delete_ref', ref)) {
                console.log('success: deleted ref');
            }
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

async function movePara(dragPID, targPID) {
    let drag = getPara(dragPID);
    let targ = getPara(targPID);
    drag.insertAfter(targ);
    envClasses();
    console.log('success: para moved');
}

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
    makeEditor(new_para);
    rawToTextarea(new_para);

    if (do_env) {
        let env_paras = getEnvParas(env_pid);
        envClasses(env_paras);
    }

    return new_para;
}

function insertPara(pid, new_pid, raw='fff', after=true) {
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
        cache.img.del(refkey);
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
    } else if (type == 'img') {
        let imgs = $(`.para[env=imagelocal][id=${refkey}]`);
        imgs.each(function() {
            let par = $(this);
            rawToRender(par, false, false, null);
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
    sendCommand('update_ref', ref);
}

function sendDeleteRef(pid) {
    let ref = {aid: config.aid, key: pid};
    sendCommand('delete_ref', ref);
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
    sendCommand('set_blurb', {
        'aid': config.aid,
        'blurb': getBlurb(),
    });
}

/// sidebar

function themeLink(name) {
    return $('<link>', {
        id: 'theme',
        type: 'text/css',
        rel: 'stylesheet',
        href: `/dist/themes/${name}.css`,
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

function setCmd(cmd) {
    config.cmd = cmd;
    setCookie('cmd', cmd);
}

function initSidebar() {
    let theme_select = $('#theme_select');
    let font_select = $('#font_select');
    let cmd_select = $('#cmd_select');

    makeSelect(theme_select);
    makeSelect(font_select);
    makeSelect(cmd_select);

    setSelect(theme_select, config.theme);
    setSelect(font_select, config.font);
    setSelect(cmd_select, config.cmd);


    setTheme(config.theme);
    setFont(config.font);
    setCmd(config.cmd);
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

    async function handleClick(d, i) {
        console.log('history clicked:', d.commit);

        d3.selectAll('circle.active')
          .classed('active', false);
        d3.select(this)
          .classed('active', true);
        d3.event.stopPropagation();

        d3.select('#revert_hist').classed('selected', true);

        let ret = await sendCommand('get_history', {'aid': config.aid, 'date': d.commit});
        renderPreview(ret);
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

async function launchHistMap() {
    let dates = await sendCommand('get_commits', {'aid': config.aid});
    updateHistMap(dates.map(d => ({
        'commit': d,
        'date': localDate(d)
    })));
    $('#hist').show();
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
    $('#bg').toggleClass('history');
    if (state.hist_show) {
        hideHistPreview();
    } else {
        launchHistMap();
    }
    state.hist_show = !state.hist_show;
    setWriteable();
}

async function revertHistory() {
    let act = d3.selectAll('circle.active');
    if (act.empty()) {
        return;
    }
    let data = act.datum();
    let args = {aid: config.aid, date: data.commit};
    if (await sendCommand('revert_history', args)) {
        hideHistPreview();
        launchHistMap();
        $('#content').focus();
    }
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

function ccMake(cctxt=null, addText=false, offset_chars=0) {
    if (cctxt === null) {
        cctxt = $('.cc_row').first().attr('ref');
        offset_chars=$('.cc_row').first().attr('offset_chars') || 0;
    }

    let para = state.active_para;
    let input = para.children('.p_input');
    let raw = input.val();

    let [l, u] = state.cc;
    let sel = raw.substring(l, u);

    let open_ref = /@(\[|@)?([\w-\|\=^]+)?(\:)?([\w-\|\=^]+)?(?:\])?/;
    let open_i_link = /\[\[([\w-\|\=^]+)?(?:\]\])?/;
    let open_img = /^\!(\[)?([\w-\|\=^]+)?(?!.*\])/;
    let open_cmd = /\\([\w-\|\=^]+)/;

    let cap;
    let iter = false; //true iterates the process (for ext art refs)
    let at = addText ? '|text=' : '';

    if (cap = open_ref.exec(sel)) {
        l += cap.index;
        if (cap[3] && !cap[2]) { // start ext page
           sel = sel.replace(open_ref, function() {
                const out = `@[${cctxt}:`;
                l += out.length;
                iter=true;
                return out;
            });
        } else if (cap[2] && cap[3]) { // ref on ext page
            sel = sel.replace(open_ref, function() {
                const out = `@[${cap[2]}:${cctxt}${at}]`;
                l += out.length;
                return out;
            });
        } else if (cap[1] == '@') { // external citation
            sel = sel.replace(open_ref, function() {
                const out = `@@[${cctxt}${at}]`;
                l += out.length;
                return out;
            });
        } else { // internal reference
            sel = sel.replace(open_ref, function() {
                const out = `@[${cctxt}${at}]`;
                l += out.length;
                return out;
            });
        }
    } else if (cap = open_i_link.exec(sel)) {
        l += cap.index;
        let space = cap[2] || '';
        sel = sel.replace(open_i_link, function() {
            const out = `[[${cctxt}${at}]]`;
            l += out.length;
            return out;
        });
    } else if (cap = open_img.exec(sel)) {
        l += cap.index;
        sel = sel.replace(open_img, function() {
            const out = `![${cctxt}${at}]`;
            l += out.length;
            return out;
        });
    } else if (cap = open_cmd.exec(sel)) {
        l += cap.index;
        sel = sel.replace(open_cmd, function() {
            const out = `\\${cctxt}`;
            l += out.length;
            return out;
        });
    }

    raw = raw.substring(0, state.cc[0]) + sel + raw.substring(u);
    input.val(raw).trigger('input');

    state.cc = false;
    $('#cc_pop').remove();

    if (addText && !iter) {
        l -= 1;
    }
    l -= offset_chars;
    input[0].setSelectionRange(l, l);

    if (iter) {
        let view = para.children('.p_input_view');
        ccRefs(view, raw, l);
    }

    if (state.ssv_mode) {
            rawToRender(para, false, false, raw);
    }

    return l;
}

/// command completion

function getInternalRefs() {
    return $('.para:not(.folder):is(.env_beg,.env_one)[id]').toArray().map(x => {
                    return {name:x.id, type:x.getAttribute('env')}
                });
}

function env_display_text(env, sym="") {
    let env_dict = {
        'equation': `<span class="syn_math">$$</span>`,
        'theorem': `<span class="syn_hl">>th</span>`,
        'definition': `<span class="syn_hl">>df</span>`,
        'example': `<span class="syn_hl">>>ex</span>`,
        'proof': `<span class="syn_hl">>>pf</span>`,
        'axiom': `<span class="syn_hl">>ax</span>`,
        'heading': `<span class="syn_delimit">##</span>`,
        'imagelocal': `<span class="syn_ref">!img</span>`,
        'svg': `<span class="syn_ref">!svg</span>`,
        'code': `<span class="syn_delimit">\'\'</span>`,
        'title': `<span class="syn_delimit">#</span><span class="syn_hl">!</span>`,
        'image': `<span class="syn_hl">!!</span>`,
        'bib': `<span class="syn_ref">@@</span>`,
        'cmd': `<span class="syn_ref latex">${sym}</span>`,
        'cmd_opt': `<span class="syn_delimit latex">${sym}</span>`,
    }
    return env_dict[env] || ''
}

function ccSearch(list, search, placement, selchars, env_display=false) {
    if(env_display){
    list = list.filter(el => el.name.includes(search));
    list = list.sort((a, b) => {
        a = a.disp_name || a.name;
        b = b.disp_name || b.name;
        return b.startsWith(search) - a.startsWith(search)
        });
    } else {
    list = list.filter(el => el.includes(search));
    list = list.sort((a, b) => b.startsWith(search) - a.startsWith(search));
    }
    if (list.length > 0) {
        state.cc = selchars;
        let pop = $('<div>', {id: 'cc_pop'});
        list.forEach(r => {
            let cc_row = $('<div>', {class: 'cc_row'});
            if(env_display){
                let offset_chars = r.offset_chars || 0
                let disp_name = r.disp_name || r.name;
                cc_row.text(disp_name).attr('ref', r.name).attr('offset_chars', r.offset_chars);
                let env_disp = $('<div>', {class: 'env_disp'});
                let sym = r.sym || '';
                env_disp.html(env_display_text(r.type, r.sym));
                cc_row.prepend(env_disp)
            } else {
                cc_row.text(r).attr('ref', r);
            };
            renderKatex(cc_row)
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
async function ccRefs(view, raw, cur, configCMD) {
    if (configCMD == 'off') {
        return false;
    }
    state.cc = false;
    $('#cc_pop').remove();

    let before = raw.substring(0,cur).split(/[\s\n\$]/).at(-1)
    if(before.lastIndexOf('\\') > -1){ //in case there is no space between commands
        before=before.substring(before.lastIndexOf('\\'))
    }
    let after = raw.substring(cur).split(/[\s\n\$]/).at(0)
    let sel = before+after;
    let selchars = [cur - before.length, cur+after.length]

    let open_ref = /@(\[|@)?([\w-\|\=^]+)?(\:)?([\w-\|\=^]+)?(?:\])?(?:[\s\n]|$)/;
    let open_i_link = /\[\[([\w-\|\=^]+)?(?:\]\])?(?:[\s\n]|$)/;
    let open_img = /^\!(\[)?([\w-\|\=^]+)?(?!.*\])(?:[\s\n]|$)/;
    let open_cmd = /\\([\w-\|\=^]+)(?:[\s\n]|$)/;
    let cap;
    if (cap = open_ref.exec(sel)) {
        raw = raw.slice(0, cur) + '<span id="cc_pos"></span>' + raw.slice(cur);
        view.html(raw);
        let off = $('#cc_pos').offset();
        let p = {'left': off.left, 'top': off.top + $('#cc_pos').height()};
        if (cap[1] == '@') { // bib search
            let search = cap[2] || '';
            let ret = await cache.list.get('__bib');
            ret = ret.map(x => {
                return {name: x, type: 'bib'};
            });
            ccSearch(ret, search, p, selchars, true);
        } else if (cap[3] && !cap[2]) { // searching for ext page
            let search = cap[4] || '';
            let ret = await cache.list.get('__art');
            ret = ret.map(x => {
                return {name:x, type:'title'};
            });
            ccSearch(ret, search, p, selchars, true);
        } else if (cap[2] && cap[3]) {
            let title = cap[2];
            let search = cap[4] || "";
            let ret = await cache.list.get(title);
            ret = ret.map(x => {
                return {name:x[0], type:x[1]}
            });
            ccSearch(ret, search, p, selchars, true);
        } else {
            let search = cap[4] || cap[2] || '';
            let in_refs = getInternalRefs();
            ccSearch(in_refs, search, p, selchars, true);
        }
    } else if (cap = open_i_link.exec(sel)) {
        raw = raw.slice(0, cur) + '<span id="cc_pos"></span>' + raw.slice(cur);
        view.html(raw);
        let off = $('#cc_pos').offset();
        let p = {'left': off.left, 'top': off.top + $('#cc_pos').height()};
        let search = cap[1] || '';
        let ret = await cache.list.get('__art');
        ret = ret.map(x => {
            return {name:x, type:'title'};
        });
        ccSearch(ret, search, p, selchars, true);
    } else if (cap = open_img.exec(sel)) {
        raw = raw.slice(0, cur) + '<span id="cc_pos"></span>' + raw.slice(cur);
        view.html(raw);
        let off = $('#cc_pos').offset();
        let p = {'left': off.left, 'top': off.top + $('#cc_pos').height()};
        let search = cap[2] || '';
        let ret = await cache.list.get('__img');
        ret = ret.map(x => {
            return {name:x, type:'image'};
        });
        ccSearch(ret, search, p, selchars, true);
    } else if (open_cmd.exec(sel) && configCMD === 'on') {
        let dollars = unEscCharCount(raw.slice(0, cur), '$');
        if (dollars%2==1 || raw.startsWith('$$')) {
            cap = open_cmd.exec(sel)
            raw = raw.slice(0, cur) + '<span id="cc_pos"></span>' + raw.slice(cur);
            view.html(raw);
            let off = $('#cc_pos').offset();
            let p = {'left': off.left, 'top': off.top + $('#cc_pos').height()};
            let search = cap[1] || '';
            let ret = tex_cmd.syms.map(x => {
                return {name:x, type:'cmd', sym:`\\${x}`,}
            });
            let ops = tex_cmd.ops
            ret = ret.concat(ops)
            ccSearch(ret, search, p, selchars, true);
        }
    }
}
