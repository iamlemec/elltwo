/// core renderer (includes readonly)

export {
    stateRender, initRender, eventRender, loadMarkdown, innerPara, rawToRender,
    rawToTextarea, envClasses, createRefs, createTOC, getTro, troFromKey,
    popText, renderPop, syntaxHL, cacheBib, deleteCite, s_env_spec,
    getFoldLevel, renderFold, braceMatch
}

import { merge, cooks, getPara } from './utils.js'
import {
    config, cache, state, updateConfig, updateCache, updateState
} from './state.js'
import { sendCommand, schedTimeout, addDummy } from './client.js'
import { renderKatex } from './math.js'
import { markthree, replace, divInlineLexer } from './marked3.js'

// main rendering entry point (for all cases)

function stateRender() {
    config.macros = {}; // external katex macros
    state.macros = {}; // internal katex macros
    state.title = null; // document title
    cache.folded = []; // current folded pids
}

function initRender() {
    // core renderer
    renderParas();

    // environ pass + refs
    envClasses();

    // sort out folding
    initFold();
}

function eventRender() {
    // popup previews split by mobile status
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
    } else {
        $(document).on({
            mouseenter: function() {
                let ref = $(this);
                ref.data('show_pop', true);
                let html = getTro(ref, renderPop);
            },
            mouseleave: function() {
                let ref = $(this);
                ref.data('show_pop', false);
                $('#pop').remove();
                $(window).unbind('mousemove');
            },
        }, '.pop_anchor');
    }
}

/// for external readonly viewing

let default_callbacks = {
    'get_image': (data, ack) => {
        console.log('dummy get_image:', data.key);
        ack({found: false});
    },
    'get_blurb': (data, ack) => {
        console.log('dummy get_blurb:', data.title);
        ack({found: false});
    },
    'get_ref': (data, ack) => {
        console.log('dummy get_ref:', data.title, data.key);
        ack({cite_type: 'err', cite_err: 'art_not_found'});
    },
    'get_cite': (data, ack) => {
        console.log('dummy get_cite:', data.keys);
        ack([]);
    },
};

function stateMarkdown() {
    cache.img = {};
}

function initMarkdown(markdown) {
    let content = $('#content');
    markdown.split(/\n{2,}/).forEach((raw, pid) => {
        let para = $('<div>', {class: 'para', pid: pid, raw: raw, fold_level: 0});
        content.append(para);
    });
}

function connectMarkdown(callbacks) {
    for (const [cmd, cb] of Object.entries(callbacks)) {
        addDummy(cmd, cb);
    }
}

function loadMarkdown(data) {
    stateRender();
    stateMarkdown();

    let callbacks = merge(default_callbacks, data.callbacks ?? {});
    connectMarkdown(callbacks);

    initMarkdown(data.markdown ?? '');
    initRender();

    eventRender();
}

/// high level rendering

// inner HTML for para structure. Included here for updating paras
const innerPara = `
<div class="p_text"></div>
<div class="p_input_view"></div>
<textarea readonly class="p_input"></textarea>
<div class="control">
<div class="controlDots">&#9776;</div>
<div class="controlButs">
<button class="before">Before</button>
<button class="after">After</button>
<button class="delete">Delete</button>
</div>
</div>
`;

function makePara(para, defer=true) {
    para.html(innerPara);
    rawToTextarea(para);
    rawToRender(para, defer); // postpone formatting
}

function renderParas() {
    $('.para').each(function() {
        let para = $(this);
        makePara(para);
    });
}

/// low level rendering

// get raw text from data-raw attribute, parse, render
function rawToRender(para, defer=false, raw=null) {
    // existing features
    let old_id = para.attr('id');

    // render with markthree
    let mark_in = (raw === null) ? para.attr('raw') : raw;
    let mark_out = markthree(mark_in);
    let html_text = mark_out.src;
    let env_info = mark_out.env;

    // display rendered html
    para.children('.p_text').html(html_text);

    // render math
    renderKatex(para, state.macros);

    // must remove old classes, to prevent pileup / artifacts
    para.removeClass('env_end')
        .removeClass('env_beg')
        .removeClass('env_one')
        .removeAttr('env')
        .removeAttr('id')
        .removeAttr('ref_text')
        .removeData('args');

    // fill in env identifiers
    if (env_info != null) {
        if ('title' in env_info) {
            setTitle(env_info.title);
        }
        if ('preamble' in env_info) {
            parsePreamble(env_info.preamble);
        }
        if ('env' in env_info) {
            para.attr('env', env_info.env);
        }
        if ('id' in env_info.args) {
            para.attr('id', env_info.args.id);
            delete env_info.args.id;
        }
        para.data('args', env_info.args);

        if (env_info.type == 'env_beg') {
            para.addClass('env_beg');
            if (env_info.single) {
                para.addClass('env_end');
            }
        } else if (env_info.type == 'env_end') {
            para.addClass('env_end');
        } else if (env_info.type == 'env_one') {
            para.addClass('env_one');
        }
    }

    // if id changed, and old has not already been assigned
    let new_id = para.attr('id');
    if (old_id && (old_id != new_id)) {
        old_id = para.attr('old_id') || old_id;
        para.attr('old_id', old_id);
    }

    // call environment formatters and reference updates
    if (!defer) {
        envClasses();
    }
}

function rawToTextarea(para) {
    var textArea = para.children('.p_input');
    var raw = para.attr('raw');
    textArea.val(raw);
}

///////////////// ENVS /////////

function stripEnvs(paras) {
    // remove old env classes
    paras.removeClass(function(index, css) {
        return (css.match(/(^|\s)env__\S+/g) || []).join(' ');
    });

    // remove env markers
    paras.removeClass('env')
         .removeClass('env_err')
         .removeAttr('env_sel');

    // remove formatting addins
    paras.find('.env_add').remove();

    // remove folder addins
    paras.prev().filter('.folder').remove();
}

//creates classes for environs
function envClasses(outer) {
    if (outer === undefined) {
        outer = $('#content');
    }
    let paras = outer.children('.para:not(.folder)');
    stripEnvs(paras);

    // env state
    let env_name = null;
    let env_pid = null;
    let env_idx = null;
    let env_args = null;
    let env_paras = [];

    function reset_state() {
        env_name = null;
        env_pid = null;
        env_idx = null;
        env_args = null;
        env_paras = [];
    }

    function abort_env(last, data) {
        env_paras.push(last[0]);
        let env_all = $(env_paras);
        let env_beg = env_all.first();
        let new_idx = env_idx;
        stripEnvs(env_all);
        env_beg.addClass('env_err');
        envFormat(env_beg, 'error', data);
        reset_state();
        return new_idx;
    }

    // forward env pass
    for (let i = 0; i < paras.length; i++) {
        let para = $(paras[i]);

        // render: singleton env (can be inside full env)
        if (para.hasClass('env_one')) {
            let ptxt = para.children('.p_text');
            let one_id = para.attr('id');
            let one_env = para.attr('env');
            let one_args = para.data('args');
            para.addClass('env');
            para.addClass(`env__${one_env}`);
            if (one_id != undefined) {
                para.attr('env_sel', `#${one_id}`);
            }
            envFormat(ptxt, one_env, one_args);
        }

        // error: ending env while not in one
        if (!env_name && para.hasClass('env_end') && !para.hasClass('env_beg')) {
            para.addClass('env_err');
            envFormat(para, 'error', {code: 'ending'});
        }

        // error: starting env while already in one
        if (env_name && para.hasClass('env_beg')) {
            let new_env = para.attr('env');
            i = abort_env(para, {code: 'open', env: env_name, new_env: new_env});
            continue;
        }

        // error: section heading inside env
        if (env_name && (para.attr('env') == 'heading')) {
            i = abort_env(para, {code: 'heading', env: env_name})
            continue;
        }

        // state: start new env
        if (!env_name && para.hasClass('env_beg')) {
            env_name = para.attr('env');
            env_pid = para.attr('pid'); // changed to use PID so all envs have this
            env_idx = i;
            env_args = para.data('args');
            if (env_pid != undefined) {
                para.attr('env_sel', `[env_pid="${env_pid}"]`);
            }
        }

        // state: add to list of current env
        if (env_name) {
            env_paras.push(para[0]);
        }

        // render: completed non-singleton env
        if (para.hasClass('env_end')) {
            let env_all = $(env_paras);
            let txt_all = env_all.children('.p_text');
            env_all.addClass('env');
            env_all.attr('env_pid', env_pid);
            env_all.addClass(`env__${env_name}`);
            if (cache.folded.includes(env_pid)) {
                env_all.addClass('folded');
            };
            envFormat(txt_all, env_name, env_args);
            reset_state();
        }
    }

    // add error for open envs left at the end
    if (env_name !== null) {
        let env_beg = $(env_paras).first();
        env_beg.addClass('env_err');
        envFormat(env_beg, 'error', {code: 'eof', env: env_name});
    }

    // add in numbers with auto-increment
    createNumbers(outer);
    createRefs(outer);
    createTOC(outer);
    renderFold();
}

function envFormat(ptxt, env, args) {
    if (env in env_spec) {
        env_spec[env](ptxt, args);
    } else if (env in s_env_spec) {
        let spec = s_env_spec[env];
        return simpleEnv(ptxt, env, spec.head, spec.tail, spec.number, args);
    } else {
        var args = {code: 'undef', env: env};
        env_spec.error(ptxt, args);
    }
}

//// ENV formatting

function makeCounter(env, inc=1) {
    return $('<span>', {class: 'num', counter: env, inc: inc});
}

function simpleEnv(ptxt, env, head='', tail='', number=true, args={}) {
    let num = (args.number) && number;
    let name = args.name || '';
    let ref_text = args.ref_text || args.rt || '';
    let first = ptxt.first();
    let pre = $('<span>', {class: `env_add ${env}_header`, html: head});
    let pre_fold = pre.clone();
    if (num) {
        const span = makeCounter(env, 0);
        const span_fold = makeCounter(env, 1);
        pre.append([' ', span]);
        pre_fold.append([' ', span_fold]);
    }
    if (name) {
        const span = $('<span>', {class: `${env}_name`, html: name});
        pre.append([' ', span]);
        pre_fold.append([' ', span.clone()]);
    }
    if (ref_text) {
        ptxt.parent().attr('ref_text', ref_text);
    }
    pre.append('. ');
    let fold_t = $('<span>', {class: `comment fold_text`});
    pre_fold.append(['. ', fold_t]);
    first.prepend(pre);

    let last = ptxt.last();
    let pos = $('<span>', {class: `env_add ${env}_footer`, html: tail});
    pos.prepend(' ');
    last.append(pos);

    let fold = $('<div>', {class: `para folder`, html: pre_fold});
    let para = first.parent();
    let env_pid = para.attr('env_pid');
    fold.attr('fold_pid', env_pid)
        .attr('fold_level', 0);
    // if (!cache.folded.includes(env_pid)) {
    //     fold.addClass('folded');
    // }
    para.before(fold);
}

// we probably want to pass targ as an argument
function errorEnv(ptxt, args) {
    var mesg;
    var targ;

    if (args.code == 'undef') {
        mesg = `Error: environment "${args.env}" is not defined.`;
        targ = ptxt.first();
    } else if (args.code == 'open') {
        mesg = `Error: environment "${args.env}" not closed at new environment "${args.new_env}".`;
        targ = ptxt.first();
    } else if (args.code == 'heading') {
        mesg = `Error: environment "${args.env}" not closed at end of section.`;
        targ = ptxt.first();
    } else if (args.code == 'eof') {
        mesg = `Error: environment "${args.env}" not closed at end of document.`;
        targ = ptxt.last();
    } else if (args.code == 'ending') {
        mesg = `Error: environment ending when not in environment.`;
        targ = ptxt.first();
    }

    var pre = $('<div>', {class: 'env_add error_footer', html: mesg});
    ptxt.append(pre);
}

function titleEnv(ptxt, args) {
}

function headingEnv(ptxt, args) {
    ptxt.addClass(`env__heading_h${args.level}`);
    let pre_fold = ptxt.clone();
    let num = $('<span>', {class: 'env_add'});
    let pre_num = num.clone()
    if (args.number) {
        let l = 1;
        while (args.level - l) {
            num.append(makeCounter(`heading${l}`, 0));
            num.append('.');
            l += 1;
        }
        pre_num = num.clone();
        num.append(makeCounter(`heading${l}`, 0));
        pre_num.append(makeCounter(`heading${l}`, 1));
    }
    ptxt.prepend([num, ' ']);
    pre_fold.prepend([pre_num, ' ']);
    let fold_t = $('<span>', {class: `comment fold_text`});
    pre_fold.append([' ', fold_t]);

    let fold = $('<div>', {class: `para folder`, html: pre_fold});
    let para = ptxt.parent();
    let env_pid = para.attr('pid');
    para.attr('env_pid', env_pid)
        .attr('head_level', args.level);
    fold.attr('fold_pid', env_pid)
        .attr('head_level', args.level)
        .attr('fold_level', 0);
    // if (!cache.folded.includes(env_pid)) {
    //     fold.addClass('folded')
    // }
    para.before(fold);
}

function equationEnv(ptxt, args) {
    if (args.number) {
        var num = makeCounter('equation');
        var div = $('<div>', {class: 'env_add eqnum'});
        div.append(num);
        ptxt.append(div);
    }
}

function figEnv(ptxt, args) {
    if (args.caption != 'none') {
        var num = (args.number) ? makeCounter('figure') : '';
        var space = (num) ? ' ' : '';
        var caption = args.caption || '';
        caption = divInlineLexer.output(caption);
        var div = $('<div>', {class: 'env_add fig_cap'});
        var span = $('<span>', {class: 'strong'});
        span.append(['Figure', space, num, '. ']);
        div.append([span, caption]);
        ptxt.append(div);
        renderKatex(ptxt.children('.fig_cap'));
    }
    var w = args.width || args.w || '';
    if (w) {
        ptxt.find('.fig_cont').css('width', `${w}%`);
    }
}

function imgEnv(ptxt, args) {
    figEnv(ptxt, args);

    let fig = ptxt.find('.fig_cont');
    let img = $('<img>', {class: 'env_add'});
    fig.append(img);

    let key = ptxt.parent().attr('id');
    if (key in cache.img) {
        let url = cache.img[key];
        img.attr('src', url);
    } else {
        sendCommand('get_image', {key: key}, (ret) => {
            if (ret.found) {
                const blob = new Blob([ret.data], {type: ret.mime});
                let url = URL.createObjectURL(blob);
                cache.img[key] = url;
                img.attr('src', url);
            } else {
                let msg = `Error: image "${key}" not found`;
                let err = $('<span>', {class: 'img_err env_add', text: msg});
                img.remove();
                fig.append(err);
            }
        });
    }
}

// simple envs for user creation and simpler setup
// number is if number is defult (can be overidden with *)
let s_env_spec = {
    'theorem': {head: 'Theorem', tail: '--', number: true},
    'lemma': {head: 'Lemma', tail: '--', number: true},
    'axiom': {head: 'Axiom', tail: '--', number: true},
    'definition': {head: 'Definition', tail: '--', number: false},
    'example': {head: 'Example', tail: `<span class='qed'>&#8718;</span>`, number: true},
    'proof': {head: 'Proof', tail: `<span class='qed'>&#8718;</span>`, number: false},
};

let env_spec = {
    'heading': headingEnv,
    'equation': equationEnv,
    'title': titleEnv,
    'svg': figEnv,
    'image': figEnv,
    'table': figEnv,
    'imagelocal': imgEnv,
    'error': errorEnv,
};

//// KATEX

function parsePreamble(raw) {
    let int_macros = {}; // internal macros
    let macro_list = raw.split(/[\n,]+/) // split on \n or comma
        .filter(macraw => macraw.includes(':')) // is it a macro?
        .map(macraw => macraw.split(':')) // split on :
        .forEach(el => int_macros[el[0]] = el[1]); // save internal macros
    state.macros = Object.assign({}, int_macros, config.macros); // merge internal and ext macros, overwrites internal
}

function setTitle(title) {
    if (state.title !== null && state.title != title) {
        document.title = title;
        sendCommand('set_title', {aid: config.aid, title: title});
    }
    state.title = title;
}

/// Numbering and TOC

function createNumbers(outer) {
    let nums = {};
    outer.find('.num').each(function() {
        let num = $(this);
        let counter = num.attr('counter');
        let inc = parseInt(num.attr('inc'));
        nums[counter] = nums[counter] || 0;
        nums[counter] += inc;
        num.text(nums[counter]);
        if(counter.startsWith('heading') && inc){
            let level = parseInt(counter.slice(7));
            for (let l = level+1; l < 7; l++) {
                let lvl = 'heading'+l
                nums[lvl] = 0;
            }
        }
    });
}

function createTOC(outer) {
    let toc = $('#toc');
    toc.find('.toc_entry').remove();
    outer.find('.env__heading').not('.folder .env__heading').each(function() {
        let head = $(this).children('.p_text');
        let level = $(this).attr('head_level');
        let text = head.text();
        let id = $(this).attr('id');
        let sec = id
            ? $('<a>', {class: `toc_entry head_level${level}`, href: '#'+id, text: text})
            : $('<span>', {class: `toc_entry head_level${level}`, text: text});
        toc.append(sec);
    });
}

/// REFERENCING and CITATIONS

// renderedCites = new Set(); // state var, citations previously rendered

function createRefs(para) {
    let refs;
    if (para == undefined) {
        refs = $('.reference');
    } else {
        refs = para.find('.reference');
    }

    // get citations
    let citeKeys = new Set();
    refs.each(function() {
        let ref = $(this);
        if (!ref.data('extern')) {
            let key = ref.attr('citekey');
            if (($(`#${key}`).length == 0) && (key != '_self_')) {
                citeKeys.add(key);
            }
        }
    });

    if (citeKeys.size > 0) {
        sendCommand('get_cite', {'keys': [...citeKeys]}, function(ret) {
            renderBibLocal(ret);
            renderCiteText(para);
        });
    } else {
        renderCiteText(para);
    }

    // renderedCites = citeKeys;
}

function getTro(ref, callback) {
    let tro = {};
    let key = ref.attr('citekey');

    if (key == '_self_') {
        tro.tro = ref;
        tro.cite_type = 'self';
        callback(ref, tro, text);
    } else if (key == '_ilink_') {
        let title = ref.attr('href');
        sendCommand('get_blurb', {'title': title}, function(ret) {
            if (ret.found) {
                tro.cite_type = 'ilink';
                tro.blurb_text = ret.blurb;
                tro.ref_text = ret.title;
            } else {
                tro.cite_type = 'err';
                tro.cite_err = 'art_not_found';
                tro.ref_text = `[[${title}]]`;
            }
            callback(ref, tro, ret.title);
        });
    } else if (ref.data('extern')) {
        let [extern, citekey] = key.split(':');
        sendCommand('get_ref', {'title': extern, 'key': citekey}, function(ret) {
            tro.tro = $($.parseHTML(ret.text));
            tro.cite_type = ret.cite_type;
            tro.cite_env = ret.cite_env;
            tro.cite_err = ret.cite_err;
            tro.ref_text = ret.ref_text;
            callback(ref, tro, ret.title);
        });
    } else {
        tro = troFromKey(key, tro);
        callback(ref, tro);
    }
}

function troFromKey(key, tro={}) {
    tro.id = key;
    tro.tro = $(`#${key}`); // the referenced object
    if (tro.tro.length > 0) {
        if (tro.tro.hasClass('env_beg') || tro.tro.hasClass('env_one')) {
            if (tro.tro.hasClass('env_err')) {
                tro.cite_type = 'err';
                tro.cite_err = 'parse_error';
            } else {
                tro.cite_type = 'env';
                tro.cite_env = tro.tro.attr('env');
                tro.ref_text = tro.tro.attr('ref_text') || '';
                tro.cite_sel = tro.tro.attr('env_sel');
            }
        } else if (tro.tro.hasClass('cite')) {
            tro.cite_type = 'cite';
            tro.ref_text = tro.tro.attr('ref_text') || '';
        } else {
            tro.cite_type = 'err';
            tro.cite_err = 'unknown_type';
        }
    } else {
        tro.cite_type = 'err';
        tro.cite_err = 'ref_not_found';
    }
    return tro;
}

function renderCiteText(para) {
    let refs;
    if (para == undefined) {
        refs = $('.reference');
    } else {
        refs = para.find('.reference');
    }

    refs.each(function() {
        var r = $(this);
        getTro(r, renderRef);
    });

    /*
    // keeping refs hidden, only used for popups
    if ($('.cite').length > 0) {
        $('#bib_block').show();
    } else {
        $('#bib_block').hide();
    }
    */
}

// routing is split due to aysc of sever commands
function renderRef(ref, tro, ext) {
    if (tro.cite_type == 'self') {
        ref_spec.self(ref);
    } else if (tro.cite_type == 'env') {
        if (tro.cite_env in ref_spec) {
            ref_spec[tro.cite_env](ref, tro, ext);
        } else if (tro.cite_env in s_env_spec) { // simple env
            refEnv(ref, tro, s_env_spec[tro.cite_env].head, ext);
        } else {
            ref_spec.error(ref, 'env');
        };
    } else if (tro.cite_type == 'cite') {
        ref_spec.cite(ref, tro);
    } else if (tro.cite_type == 'ilink') {
        ref_spec.text(ref, tro);
    } else if (tro.cite_type == 'err') {
        ref_spec.error(ref, tro);
    }
}

function refCite(ref, tro) {
    let text = ref.data('text');
    let citeText;

    if (text) {
        citeText = text;
    } else {
        let format = ref.attr('format') || '';
        let authors = tro.tro.attr('authors').split(',');
        let year = tro.tro.attr('year');
        let href = '#' + tro.tro.attr('id');

        if (authors.length == 2) {
            citeText = `${authors[0]} and ${authors[1]}`;
        } else if (authors.length < 2) {
            citeText = authors[0];
        } else {
            citeText = `${authors[0]} et al.`;
        }

        if (format == 'p') {
            citeText = `(${citeText}, ${year})`;
        } else {
            citeText += ` (${year})`;
        }
    }

    ref.html(citeText);
    ref.attr('href', '');
}

function refEquation(ref, tro, ext) {
    let num = tro.tro.find('.num').first().text();
    let citebox = $('<span>', {class: 'eqn_cite', text: num});
    let text = ref.data('text');

    if (text) {
        ref.html(text);
    } else {
        ref.empty();
        ref.append(citebox);
        if (ext) {
            let txt = $('<span>', {class: 'eqn_cite_ext', text: `[${ext}]`});
            ref.append(txt);
        }
    }
}

function refEnv(ref, tro, env, ext) {
    let format = ref.attr('format') || '';
    let num = tro.tro.find('.num').first().text();
    let text = ref.data('text');

    let citeText;
    if (text) {
        citeText = text;
    } else if (tro.ref_text) {
        citeText = tro.ref_text;
    } else if (format == 'plain') {
        citeText = num;
    } else {
        citeText = `${env} ${num}`;
    }

    if (ext && !text) {
        citeText += ` [${ext}]`;
    }

    ref.html(citeText);
};

function refText(ref, tro) {
    let text = ref.data('text') || tro.ref_text || '';
    ref.html(text);
}

function refError(ref, tro) {
    let key = ref.attr('citekey');
    let href = ref.attr('href');
    let targ = (key == '_ilink_') ? `[[${href}]]`: `@[${key}]`;
    let text = ref.data('text') || tro.ref_text || targ;
    ref.html(`<span class="ref_error">${text}</span>`);
}

function refSection(ref, tro, ext) {
    refEnv(ref, tro, 'Section', ext);
}

function refFigure(ref, tro, ext) {
    refEnv(ref, tro, 'Figure', ext);
}

function refSelf(ref) {
    let text = ref.data('text');
    ref.html(text);
}

let ref_spec = {
    'cite': refCite,
    'self': refSelf,
    'error': refError,
    'equation': refEquation,
    'svg': refFigure,
    'image': refFigure,
    'imagelocal': refFigure,
    'heading': refSection,
    'text': refText,
};


function cacheBib(data) {
    data.forEach(cite => {
        cache.bib[cite.citekey] = cache.bib[cite.citekey] ? cite.raw : null;
    });
}

function deleteCite(data) {
    delete cache.bib[data]
}

function renderBibLocal(data) {
    // $('#para_holder').empty();
    // console.log(data);
    data.map(createBibEntry);
}

function createBibEntry(cite) {

    cache.bib[cite.citekey] = cite.raw;

    $('#'+cite['citekey']).remove();

    let yr = cite['year'] ? ` ${cite['year']}. ` : '';
    let vol = cite['volume'] ? `, ${cite['volume']}` : '';
    let num = cite['number'] ? `, no. ${cite['number']}` : '';
    let pgs = cite['pages'] ? `, pp. ${cite['pages']}` : '';
    let title = cite['title'] ? `${cite['title']}` : '';
    let pubs = ['book', 'incollection'];
    let jns = ['article', 'techreport', 'unpublished'];

    let pub;
    let journal;
    if (pubs.includes(cite['entry_type'])) {
        pub = cite['publisher'] || '';
        journal = (cite['booktitle']) ? `In ${cite['booktitle']}`: '';
    } else if (jns.includes(cite['entry_type'])) {
        pub = '';
        journal = cite['journal'] || 'mimeo';
    }

    let author = `<b>${cite['author']}</b>. ` || '';
    let index = (vol || num || pgs) ? `${vol + num + pgs}.` : '';

    let author_list = cite['author'].split(' and ').map(auth => auth.split(',')[0]);

    $('#bib_block').append(
        `<div class="cite" id=${cite['citekey']} cite-type="cite" authors="${author_list}" year="${cite['year']}">
        <span class="citeText">
        ${author}${yr}${title}. <em>${journal}</em>${index} ${pub}
        </span>
        <span class="citekey">${cite['citekey']}</span>
        </div>`
    );
}

//// POPUP FUNCTIONALITY // turned off for mobile for now

function createPop(ref, html='', link=false) {
    let pop = $('<div>', {id: 'pop', href: link, html: html});
    $('#bg').append(pop);

    let h = pop.height();
    let w = pop.width();

    if (!config.mobile) { // no mouse binding with mobile popups
        ref.mousemove(function(event) {
            let mid = window.innerHeight / 2;
            let x = event.pageX - 0.5*w - 10;
            let y = event.pageY - h - 35;
            if (event.pageY < mid) { // if on top half of page
                y = event.pageY + 35;
            }
            pop.css({
                'left': `${x}px`, // offset 10px for padding
                'top': `${y}px`, // offset up by 35 px
            });
        });
    }
}

// generates pop text from tro (only for internal refs)
function popText(tro, ext) {
    if (tro.cite_type == 'self') {
        return pop_spec.self(tro.tro);
    } else if (tro.cite_type == 'env') {
        if (ext !== undefined) {
            return tro.tro;
        }
        let paras = $(tro.cite_sel);
        if (tro.cite_env in pop_spec) {
            return pop_spec[tro.cite_env](paras);
        } else if (tro.cite_env in s_env_spec) { // simple env
            return popEnv(paras);
        } else {
            return pop_spec.error('ref_not_found');
        }
    } else if (tro.cite_type == 'cite') {
        return pop_spec.cite(tro.tro);
    } else if (tro.cite_type == 'ilink') {
        return tro.blurb_text;
    } else if (tro.cite_type == 'err') {
        return pop_spec.error(tro.cite_err);
    }
}

function renderPop(ref, tro, ext) {
    if (!ref.data('show_pop')) { // we've since left with mouse
        return;
    }
    let pop = popText(tro, ext);
    let link = config.mobile ? ref.attr('href') : false;
    createPop(ref, pop, link);
}

function popError(err) {
    if (err == 'ref_not_found') {
        return '[Reference Not Found]';
    } else if (err == 'art_not_found') {
        return '[Article Not Found]';
    } else if (err == 'parse_error') {
        return '[Referenced Environment Not Closed]';
    } else if (err == 'unknown_type') {
        return '[Unknown Reference Type]';
    } else {
        return '[Error]';
    }
}

function popSection(tro) {
    return tro.children('.p_text').text();
}

function popEquation(tro) {
    return tro.children('.p_text').html();
}

function popCite(tro) {
    return tro.find('.citeText').html();
}

function popSelf(tro) {
    return tro.find('.ft_content').html();
}

function popEnv(tro) {
    let html = '';
    tro.each(function() {
        let ptxt = $(this).children('.p_text');
        html += ptxt.html();
    });

    return html;
}

let pop_spec = {
    'heading': popSection,
    'cite': popCite,
    'equation': popEquation,
    'svg': popEquation,
    'image': popEquation,
    'imagelocal': popEquation,
    'footnote': popSelf,
    'self': popSelf,
    'error': popError,
};

/// syntax highlighting

function syntaxHL(para) {
    let text = para.children('.p_input');
    let view = para.children('.p_input_view');
    let raw = text.val();
    let parsed = syntaxParseBlock(raw);
    view.html(parsed);
}

function esc_md(raw) {
    return raw.replace(/\\/g, '&#92;')
              .replace(/\//g, '&#47;')
              .replace(/\[/g, '&#91;')
              .replace(/\]/g, '&#93;')
              .replace(/\*/g, '&#42;')
              .replace(/\$/g, '&#36;')
              .replace(/\@/g, '&#36;')
              .replace(/\^/g, '&#94;')
              .replace(/\`/g, '&#96;')
              .replace(/\!/g, '&#33;');
}

function esc_html(raw) {
    return raw.replace(/\</g, '&lt;')
              .replace(/\>/g, '&gt;')
              .replace('&!L&', '<span class="brace">')
              .replace('&!R&', '</span>');
}

function s(text, cls) {
    return `<span class="syn_${cls}">${text}</span>`;
}

let inline = {
    escape: /\\([\\/`*{}\[\]()#+\-.!_>\$])/g,
    url: /(https?):\/\/([^\s<]+[^<.,:;"')\]\s])/g,
    comment: /\/\/([^\n]*?)(\n|$)/g,
    code: /(`+)\s*([\s\S\$]*?[^`])\s*\1(?!`)/g,
    ftnt: /\^\[((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*)\]/g,
    math: /\$((?:\\\$|[\s\S])+?)\$/g,
    ref: /@(\[([^\]]+)\])/g,
    ilink: /\[\[([^\]]+)\]\]/g,
    em: /\*((?:\*\*|[\s\S])+?)\*(?!\*)/g,
    strong: /\*\*([\s\S]+?)\*\*(?!\*)/g,
};

function syntaxParseInline(raw) {
    let html = esc_html(raw);

    html = html.replace(inline.escape, (a, b) =>
        s('\\', 'comment_head') + s(esc_md(b), 'comment')
    );

    html = html.replace(inline.url, (a, b, c) =>
        s(b, 'hl') + ':' + s('&#47;&#47;', 'math') + s(c.replace(/\//g, s('/', 'math')), 'comment')
    );

    html = html.replace(inline.comment, (a, b, c) =>
        s('//', 'comment_head') + s(b, 'comment') + c
    );

    html = html.replace(inline.code, (a, b, c) =>
        s(b, 'comment_head') + s(c, 'code') + s(b, 'comment_head')
    );

    html = html.replace(inline.ftnt, (a, b) =>
        s('^[', 'delimit') + b.replace('|', s('|', 'hl')) + s(']', 'delimit')
    );

    html = html.replace(inline.math, (a, b) =>
        s('$', 'delimit') + s(b, 'math') + s('$', 'delimit')
    );

    html = html.replace(inline.ref, (a, b) =>
        s('@', 'delimit') + s(fArgs(b, false), 'ref')
    );

    html = html.replace(inline.ilink, (a, b) =>
        s('[[', 'delimit') + s(b, 'ref') + s(']]', 'delimit')
    );

    // escape so we don't highlight these on italics
    html = html.replace(inline.strong, (a, b) =>
        s('&#42;&#42;', 'comment_head') + b + s('&#42;&#42;', 'comment_head')
    );

    html = html.replace(inline.em, (a, b) =>
        s('*', 'delimit') + b + s('*', 'delimit')
    );

    return html;
}

// uses lookbehinds, might not work on old ass-browsers
// set = true is for non ref when seting ids
function fArgs(argsraw, set=true) {
    let argmatch = /([\[\|\n\r])((?:[^\]\|\n\r]|(?<=\\)\||(?<=\\)\])*)/g;
    let illegal = /[^a-zA-Z\d\_\-]/;
    if (!set) {
        illegal = /[^a-zA-Z\d\_\-\:]/;
    }

    // match and parse inside args
    let args = argsraw.replace(argmatch, function(a, b, c) {
        c = c.split(/(?<!\\)\=/);
        if (c.length > 1) {
            let val = c.pop();
            let arg_val = s(syntaxParseInline(val), 'delimit');
            let arg_key = '';
            c.forEach(key => {
                if (illegal.test(key)) {
                    arg_key += s(key, 'err') + '=';
                } else if (key == 'id' && illegal.test(val)) {
                    arg_key += s(key, 'err') + '=';
                    arg_val = s(val, 'err');
                } else {
                    arg_key += s(key, 'math') + '=';
                }
            });
            return b + arg_key + arg_val;
        } else {
            let arg_key = (c[0]) ? s(c[0], 'math') : '';
            if (illegal.test(c[0])) {
                arg_key = s(c[0], 'err');
            }
            return b + arg_key;
        }
    });

    // swap out leading/trailing bracket highlight
    return args.replace(/^&!L&/, '<span class="brace">')
               .replace(/&!R&$/, '</span>');
}

let block = {
    title: /^#!( *)(?:refargs)?(\s*)([^\n]*)(\s*)/,
    heading: /^(#{1,6})(\*?)( *)(?:refargs)?( *)([^\n]+?)$/,
    code: /^``((?: |\n)?)/,
    comment: /^\/\/( ?)/,
    equation: /^\$\$((?:\*&|&\*|\*|&)?)( *)(?:refargs)?(\s*)/,
    image: /^!(\*)?( *)(?:refargs)?( *)(\()?([\w-:#/.&%=]*)(\))?(\s*)$/,
    svg: /^\!svg(\*)?( *)(?:refargs)?/,
    envbeg: /^\>\>(\!)?( *)([\w-]+)(\*)?( *)(?:refargs)?/,
    envend: /^\<\<( ?)/,
};

block._refargs = /((?:&!L&)?\[(?:[^\]]|(?<=\\)\])*\]?(?:&!R&)?)/;

block.title = replace(block.title)
  ('refargs', block._refargs)
  ();
block.heading = replace(block.heading)
  ('refargs', block._refargs)
  ();
block.equation = replace(block.equation)
  ('refargs', block._refargs)
  ();
block.image = replace(block.image)
  ('refargs', block._refargs)
  ();
block.svg = replace(block.svg)
  ('refargs', block._refargs)
  ();
block.envbeg = replace(block.envbeg)
  ('refargs', block._refargs)
  ();

function syntaxParseBlock(raw) {
    let cap;

    if (cap = block.title.exec(raw)) {
        let id = cap[2] ? s(fArgs(cap[2]), 'ref') : '';
        let tit = cap[4] ? syntaxParseInline(cap[4]) : '';
        let rest = raw.slice(cap[0].length);
        let pre = syntaxParseInline(rest);
        return s('#!', 'hl') + cap[1] + id + cap[3] + tit + cap[5] + s(pre, 'ref');
    }

    if (cap = block.heading.exec(raw)) {
        let star = cap[2] ? s(cap[2], 'hl') : '';
        let id = cap[4] ? s(fArgs(cap[4]), 'ref') : '';
        let text = cap[6] ? syntaxParseInline(cap[6]) : '';
        return s(cap[1], 'delimit') + star + cap[3] + id + cap[5] + text;
    }

    if (cap = block.code.exec(raw)) {
        let space = cap[1] || '';
        let rest = raw.slice(cap[0].length);
        let text = esc_html(rest);
        return s('``', 'hl') + space + s(text, 'code');
    }

    if (cap = block.comment.exec(raw)) {
        let space = cap[1] || '';
        let rest = raw.slice(cap[0].length);
        let text = esc_html(rest);
        return s('//', 'comment_head') + space + s(text, 'comment');
    }

    if (cap = block.equation.exec(raw)) {
        let star = cap[1] ? s(cap[1], 'hl') : '';
        let id = cap[3] ? s(fArgs(cap[3]), 'ref') : '';
        let rest = raw.slice(cap[0].length);
        return s('$$', 'delimit') + star + cap[2] + id + cap[4] + esc_html(rest);
    }

    if (cap = block.image.exec(raw)) {
        let star = cap[1] ? s('*', 'hl') : '';
        let id = cap[3] ? s(fArgs(cap[3]), 'ref'): '';
        let l = cap[5] ? s('(', 'delimit') : '';
        let href = cap[6] ? s(cap[6], 'hl') : '';
        let r = cap[7] ? s(')', 'delimit') : '';
        return s('!', 'hl') + star + cap[2] + id + cap[4] + l + href + r + cap[8];
    }

    if (cap = block.svg.exec(raw)) {
        let star = cap[1] ? s('*', 'hl') : '';
        let id = cap[3] ? s(fArgs(cap[3]), 'ref'): '';
        let rest = raw.slice(cap[0].length);
        let text = syntaxParseInline(rest);
        return s('!', 'hl') + s('svg', 'delimit') + star + cap[2] + id + text;
    }

    if (cap = block.envbeg.exec(raw)) {
        let bang = cap[1] ? s('!', 'hl') : '';
        let env = cap[3] ? s(cap[3], 'ref') : '';
        let star = cap[4] ? s(cap[4], 'hl') : '';
        let id = cap[6] ? s(fArgs(cap[6]), 'ref'): '';
        let rest = raw.slice(cap[0].length);
        let text = syntaxParseInline(rest);
        return s('>>', 'delimit') + bang + cap[2] + env + star + cap[5] + id + text;
    }

    if (cap = block.envend.exec(raw)) {
        let space = cap[1] || '';
        let rest = raw.slice(cap[0].length);
        let text = syntaxParseInline(rest);
        return s('<<', 'delimit') + space + text;
    }

    return syntaxParseInline(raw);
}

function braceMatch(textarea, para) {
    let delimit = {'(': ')', '[': ']', '{': '}'};
    let rev_delimit = {')': '(', ']': '[', '}': '{'};

    let cpos = textarea.selectionStart;
    let text = textarea.value;

    let after = text[cpos];
    let before = text[cpos-1] || false;

    if (after in delimit) {
        let pos = getBracePos(text, after, delimit[after], cpos);
        if (pos) {
            let v = $(textarea).siblings('.p_input_view');
            braceHL(v, text, pos, para);
        }
    } else if (before in delimit) {
        let pos = getBracePos(text, before, delimit[before], cpos-1);
        if (pos) {
            let v = $(textarea).siblings('.p_input_view');
            braceHL(v, text, pos, para);
        }
    } else if (before in rev_delimit) {
        let pos = getBracePos(text, before, rev_delimit[before], cpos, true);
        let v = $(textarea).siblings('.p_input_view');
        braceHL(v, text, pos, para);
    } else if (after in rev_delimit) {
        let pos = getBracePos(text, after, rev_delimit[after], cpos+1, true);
        let v = $(textarea).siblings('.p_input_view');
        braceHL(v, text, pos, para);
    } else {
        $('.brace').contents().unwrap();
    }
}

function getBracePos(text, brace, match, cpos, rev=false) {
    let len = text.length;
    if (rev) {
        text = text.split('').reverse().join('');
        cpos = len - cpos;
    }

    let z = 1;
    let pos = cpos;
    let char;

    while (true) {
        pos += 1;
        if (pos <= len) {
            char = text[pos];
            if (char == brace) {
                z += 1;
            } else if (char == match) {
                z -= 1;
            }
            if (z == 0) {
                break;
            }
        } else {
            if (!rev) {
                return false;
            } else {
                break;
            }
        }
    }

    if (rev) {
        return {'l': Math.max(0, len - pos - 1), 'r': len - cpos - 1};
    } else {
        return {'l': cpos, 'r': pos};
    }
}

function braceHL(view, text, pos, para) {
    let new_text = [
        text.slice(0, pos['l']),
        `\&\!L\&`,
        text.slice(pos['l'], pos['r']+1),
        `\&\!R\&`,
        text.slice(pos['r']+1)
    ].join('');

    let syn = syntaxParseBlock(new_text);
    view.html(syn);

    setTimeout(function() {
        $('.brace').contents().unwrap();
        syntaxHL(para);
    }, 800);
}

/// folding (render only)

function getFoldLevel(para) {
    return parseInt(para.attr('fold_level'));
}

function initFold() {
    cache.folded = cooks('folded') || cache.folded;
    cache.folded.forEach(pid => {
        let para = getPara(pid);
        fold(para, init=true);
    });
    renderFold();
}

function renderFold() {
    $('.para:not(.folder)').each(function() {
        let para = $(this);
        let fl = getFoldLevel(para);
        if (fl > 0) {
            para.addClass('folded');
        } else {
            para.removeClass('folded');
        }
    });
    $('.folder').each(function() {
        let para = $(this);
        let fl = getFoldLevel(para);
        let pid = para.attr('fold_pid');
        let p = getPara(pid);
        let flp = getFoldLevel(p);
        if (fl > 0 && flp == 1) {
            para.removeClass('folded');
        } else {
            para.addClass('folded');
        }
    });
}
