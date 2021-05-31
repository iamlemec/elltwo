/// core renderer (includes readonly)

export {
    initRender, renderMarkdown, getPara, innerPara, renderKatex, rawToRender,
    rawToTextarea, envClasses, createRefs, createTOC, troFromKey, popText,
    syntaxHL, renderBib, s_env_spec, macros, fold
}

import { cooks } from './utils.js'
import { sendCommand, schedTimeout } from './client.js'
import { renderKatex } from './math.js'
import { imgCache } from './drop.js'
import { makeActive } from './editor.js'
import { ccRefs } from './article.js'

// flags and global vars
let ext_macros = {};
let macros = ext_macros;
let ext_refs = {};
let folded = []; // current folded pids

// inner HTML for para structure. Included here for updating paras
const innerPara = `
<div class="p_text"></div>
<div class="p_input_view"></div>
<textarea readonly class="p_input"></textarea>
<div class="control">
<div class="controlDots">&#9776;</div>
<div class="controlButs">
<button class="update">Commit</button>
<button class="before">Before</button>
<button class="after">After</button>
<button class="delete">Delete</button>
</div>
</div>
`;

function getPara(pid) {
    return $(`#content [pid=${pid}]`);
}

function makePara(para, defer=true) {
    para.html(innerPara);
    rawToRender(para, defer); // postpone formatting
    rawToTextarea(para);
}

function renderParas() {
    $('.para').each(function() {
        let para = $(this);
        makePara(para);
    });
}

// main rendering entry point (for all cases)
function initRender() {
    // core renderer
    renderParas();

    // environ pass + refs
    envClasses();
    createRefs();

    // sort out folding
    initFold();
}

// for external readonly viewing
function renderMarkdown(md) {
    let content = $('#content');
    md.split(/\n{2,}/).forEach((raw, pid) => {
        let para = $('<div>', {class: 'para', pid: pid, raw: raw, fold_level: 0});
        content.append(para);
    });
    initRender();
}

/////////////////// EDITING /////////

// get raw text from data-raw attribute, parse, render
function rawToRender(para, defer, raw=null) {
    // render with markthree
    let mark_in = (raw === null) ? para.attr('raw') : raw;
    let mark_out = markthree(mark_in);
    let html_text = mark_out['src'];
    let env_info = mark_out['env'];

    // store old id/env info
    let old_id = para.attr('id');
    let old_env = para.attr('env');
    let old_ref_text = para.attr('ref_text');

    // display rendered html
    para.children('.p_text').html(html_text);

    // render math
    renderKatex(para, macros);

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
        if ('preamble' in env_info) {
            parse_preamble(env_info.preamble);
        };
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

    // has id/env info changed?
    let new_id = para.attr('id');
    let new_env = para.attr('env');
    let new_ref_text = para.attr('ref_text');
    let changeRef = (new_env != old_env) || (new_id != old_id) || (new_ref_text != old_ref_text);

    // call environment formatters and reference updates
    if (!defer) {
        envClasses();
        if (changeRef) {
            createRefs(); // we may be able to scope this more
        } else {
            createRefs(para);
        }

        if (old_id && (old_id != new_id)) { // if id changed, and old has not already been assigned
            old_id = para.attr('old_id') || old_id;
            para.attr('old_id', old_id);
        }
    }
}

function rawToTextarea(para) {
    var textArea = para.children('.p_input');
    var raw = para.attr('raw');
    textArea.val(raw);
}

///////////////// ENVS /////////

//creates classes for environs
function envClasses(outer) {
    if (outer === undefined) {
        outer = $('#content');
    }
    var paras = outer.children('.para');

    // remove old env classes
    paras.children('.p_text').removeClass(function(index, css) {
        return (css.match(/(^|\s)env__\S+/g) || []).join(' ');
    });

    // remove env markers
    paras.removeClass('env')
         .removeClass('env_err')
         .removeAttr('env_sel');

    // remove formatting addins
    outer.find('.env_add').remove();
    outer.find('.folder').remove();

    // env state
    var env_name = null;
    var env_pid = null;
    var env_args = null;
    var env_paras = [];

    // forward env pass
    paras.each(function() {
        var para = $(this);

        if (para.hasClass('env_one')) {
            var ptxt = para.children('.p_text');
            var one_id = para.attr('id');
            var one_env = para.attr('env');
            var one_args = para.data('args');
            para.addClass('env');
            ptxt.addClass(`env__${one_env}`);
            if (one_id != undefined) {
                para.attr('env_sel', `#${one_id}`);
            }
            envFormat(ptxt, one_env, one_args);
        }

        if (!env_name && para.hasClass('env_end') && !para.hasClass('env_beg')) {
            para.addClass('env_err');
            envFormat(para, 'error', {code: 'ending'});
        }

        if (env_name && para.hasClass('env_beg')) { // error on nested environs
            var env_all = $(env_paras);
            var new_env = para.attr('env');
            env_all.addClass('env_err');
            envFormat(env_all, 'error', {code: 'open', env: env_name, new_env: new_env});
        }

        if (env_name && (para.attr('one') == 'heading')) { // sections or headings break envs
            var env_all = $(env_paras);
            env_all.addClass('env_err');
            envFormat(env_all, 'error', {code: 'heading', env: env_name});

            env_name = null;
            env_pid = null;
            env_args = null;
            env_paras = [];
        }

        if (!env_name && para.hasClass('env_beg')) { // cannot open an env if one is already open
            env_name = para.attr('env');
            env_pid = para.attr('pid'); // changed to use PID so all envs have this
            env_args = para.data('args');
            if (env_pid != undefined) {
                para.attr('env_sel', `[env_pid="${env_pid}"]`);
            }
        }

        if (env_name) {
            env_paras.push(para[0]);
        }

        if (para.hasClass('env_end')) { // closing tag = current open tag
            var env_all = $(env_paras);
            var txt_all = env_all.children('.p_text');
            env_all.addClass('env');
            env_all.attr('env_pid', env_pid);
            txt_all.addClass(`env__${env_name}`);
            if (folded.includes(env_pid)) {
                env_all.addClass('folded');
            };
            envFormat(txt_all, env_name, env_args);

            env_name = null;
            env_pid = null;
            env_args = null;
            env_paras = [];
        }
    });

    // add error for open envs left at the end
    if (env_name !== null) {
        var env_all = $(env_paras);
        env_all.addClass('env_err');
        envFormat(env_all, 'error', {code: 'eof', env: env_name});
    }

    // add in numbers with auto-increment
    createNumbers(outer);
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
    let pre_fold = pre.clone()
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
    // if (!folded.includes(env_pid)) {
    //     fold.addClass('folded');
    // }
    para.before(fold);
}

// we probably want to pass targ as an argument
function errorEnv(ptxt, args) {
    var mesg;
    var targ;

    if (args.code == 'undef') {
        mesg = `Error: envrionment ${args.env} is not defined.`;
        targ = ptxt.first();
    } else if (args.code == 'open') {
        mesg = `Error: envrionment ${args.env} not closed at new environment ${args.new_env}.`;
        targ = ptxt.first();
    } else if (args.code == 'heading') {
        mesg = `Error: envrionment ${args.env} not closed at end of section.`;
        targ = ptxt.first();
    } else if (args.code == 'eof') {
        mesg = `Error: envrionment ${args.env} not closed at end of document.`;
        targ = ptxt.last();
    } else if (args.code == 'ending') {
        mesg = `Error: environment ending when not in environment.`;
        targ = ptxt.first();
    }

    var pre = $('<div>', {class: 'env_add error_footer', html: mesg});
    ptxt.append(pre);
}

function titleEnv(ptxt, args) {
    return ptxt;
}

function headingEnv(ptxt, args) {
    ptxt.addClass(`env__heading_h${args.level}`);
    ptxt.attr('head_level', args.level);
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
    // if (!folded.includes(env_pid)) {
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
        caption = markthree.inlineLexer(caption)
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

    var fig = ptxt.find('.fig_cont');
    var img = $('<img>', {class: 'env_add'});
    fig.append(img);

    var key = ptxt.parent().attr('id');
    if (key in imgCache) {
        var url = imgCache[key];
        img.attr('src', url);
    } else {
        sendCommand('get_image', {'key': key}, (ret) => {
            if (ret.found) {
                const blob = new Blob([ret.data], {type: ret.mime});
                var url = URL.createObjectURL(blob);
                imgCache[key] = url;
                img.attr('src', url);
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

function parse_preamble(raw) {
    let int_macros = {}; // internal macros
    let macro_list = raw.split(/[\n,]+/) // split on \n or comma
        .filter(macraw => macraw.includes(':')) // is it a macro?
        .map(macraw => macraw.split(':')) // split on :
        .forEach(el => int_macros[el[0]] = el[1]); // save internal macros
    macros = Object.assign({}, int_macros, ext_macros); // merge internal and ext macros, overwrites internal
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
    });
}

function createTOC(outer) {
    let toc = $('#toc');
    toc.find('.toc_entry').remove();
    outer.find('.env__heading').not('.folder .env__heading').each(function() {
        let head = $(this);
        let level = head.attr('head_level');
        let text = head.text();
        let id = head.parent('.para').attr('id');
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
            };
        };
    });

    if (citeKeys.size > 0) {
        sendCommand('get_cite', {'keys': [...citeKeys]}, function(response) {
            renderBibLocal(response);
            renderCiteText(para);
        });
    } else {
        renderCiteText(para);
    }

    // renderedCites = citeKeys;
}

function getTro(ref, callback) {
    //var ref = $(this); // the reference (actually an 'a' tag)
    let text = ref.attr('text') || '';

    let tro = {};
    let key = ref.attr('citekey');

    if (key == '_self_') {
        tro.tro = ref;
        tro.cite_type = 'self';
        callback(ref, tro, text);
    } else if (key == '_ilink_') {
        sendCommand('get_blurb', ref.attr('href'), function(response) {
            if (response) {
                tro.tro = response;
                tro.cite_type = 'ilink';
            } else {
                tro.tro = '';
                tro.cite_type = 'err';
                tro.cite_err = 'not_found';
            }
            tro.cite_type = 'ilink';
            callback(ref, tro, text, true);
        });
    } else if (ref.data('extern')) {
        let [extern, citekey] = key.split(':');
        sendCommand('get_ref', {'title': extern, 'key': citekey}, function(data) {
            tro.tro = $($.parseHTML(data.text));
            tro.cite_type = data.cite_type;
            tro.cite_env = data.cite_env;
            text = text || data.ref_text || '';
            callback(ref, tro, text, data.title);
        });
    } else {
        tro = troFromKey(key, tro);
        text = text || tro.tro.attr('ref_text') || '';
        callback(ref, tro, text);
    }
}

function troFromKey(key, tro={}) {
    tro.id = key;
    tro.tro = $(`#${key}`); // the referenced object
    if (tro.tro != undefined) {
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
        tro.cite_err = 'not_found';
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
function renderRef(ref, tro, text, ext) {
    if (text.length > 0) {
        ref_spec.text(ref, tro.tro, text);
    } else if (tro.cite_type == 'self') {
        ref_spec.self(ref);
    } else if (tro.cite_type == 'env') {
        if (tro.cite_env in ref_spec) {
            ref_spec[tro.cite_env](ref, tro.tro, ext=ext);
        } else if (tro.cite_env in s_env_spec) { //simple env
            refEnv(ref, tro.tro, s_env_spec[tro.cite_env].head, ext);
        } else {
            ref_spec.error(ref);
        };
    } else if (tro.cite_type == 'cite') {
        ref_spec.cite(ref, tro.tro);
    } else if (tro.cite_type == 'err') {
        ref_spec.error(ref);
    }
}

function refCite(ref, tro) {
    let authors = tro.attr('authors').split(',');
    let year = tro.attr('year');
    let format = ref.attr('format') || '';
    let href = '#' + tro.attr('id');

    let citeText;
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

    ref.text(citeText);
    ref.attr('href', '');
}

function refEquation(ref, tro, ext) {
    let num = tro.find('.num')[0];
    let text = $(num).text();
    let citebox = $('<span>', {class: 'eqn_cite', text: text});
    ref.empty();
    if (ext) {
        let txt = $('<span>', {class: 'eqn_cite_ext', text: ext});
        ref.append([txt, citebox]);
    } else {
        ref.append(citebox);
    }
}

function refEnv(ref, tro, env, ext) {
    let format = ref.attr('format') || '';
    let num = tro.find('.num')[0];
    let text = $(num).text();

    let citeText;
    if (format == 'plain') {
        citeText = text;
    } else {
        citeText = `${env} ${text}`;
    }

    if (ext) {
        citeText += ` [${ext}]`
    }

    ref.text(citeText);
};

function refText(ref, tro, text) {
    ref.text(text);
}

function refError(ref) {
    let href = ref.attr('citekey') || '';
    ref.html(`<span class="ref_error">@[${href}]</span>`);
}

function refSection(ref, tro, ext) {
    refEnv(ref, tro, 'Section', ext);
}

function refFigure(ref, tro, ext) {
    refEnv(ref, tro, 'Figure', ext);
}

function refSelf(ref) {
    let text = ref.attr('text');
    ref.text(text);
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

/// THIS IS REPEATED FROM THE BIB.JS, we should make it more efficent

 //this does not redner anything, it adds the cite keys
// to the comand completion list, the name is a hold over
//and becuase it is used for other pages (/b)
function renderBib(data) {
    data.forEach(cite => {
        bib_list.push(cite.citekey);
    });
}

function deleteCite(data) {
    let i = bib_list.indexOf(data);
    if (i !== -1) {
        bib_list.splice(i, 1);
    }
}

function renderBibLocal(data) {
    // $('#para_holder').empty();
    // console.log(data);
    data.map(createBibEntry);
}

function createBibEntry(cite) {
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

if (!mobile) {
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
            $(window).unbind('mousemove')
        },
    }, '.pop_anchor');
}

function createPop(ref, html='', link=false) {
    let pop = $('<div>', {id: 'pop', href: link, html: html});
    $('#bg').append(pop);

    let h = pop.height();
    let w = pop.width();

    if (!mobile) { // no mouse binding with mobile popups
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
function popText(tro) {
    if (tro.cite_type == 'self') {
        return pop_spec.self(tro.tro);
    } else if (tro.cite_type == 'env') {
        if (tro.cite_env in pop_spec) {
            let paras = $(tro.cite_sel);
            return pop_spec[tro.cite_env](paras);
        } else if (tro.cite_env in s_env_spec) { //simple env
            let paras = $(tro.cite_sel);
            return popEnv(paras)
        } else {
            return pop_spec.error('not_found');
        }
    } else if (tro.cite_type == 'cite') {
        return pop_spec.cite(tro.tro);
    } else if (tro.cite_type == 'err') {
        return pop_spec.error(tro.cite_err);
    }
}

function renderPop(ref, tro, text, ext) {
    if (!ref.data('show_pop')) { // we've since left with mouse
        return;
    }
    let pop;
    if (ext != undefined) {
        pop = tro.tro;
    } else {
        pop = popText(tro);
    };
    let link = mobile ? ref.attr('href'): false;
    createPop(ref, pop, link);
}

function popError(err='not_found') {
    if (err == 'not_found') {
        return "[Reference Not Found]";
    } else if (err == 'env_err') {
        return "[Referenced Environment Not Closed]";
    } else {
        return "[Error]";
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

function syntaxHL(para, e=null) {
    let text = para.children('.p_input');
    let view = para.children('.p_input_view');
    let raw = text.val();
    if (e) {
        ccRefs(raw, view, e);
    }
    let parsed = syntaxParseBlock(raw);
    view.html(parsed);
}

$(document).on('input', '.p_input', function(e) {
    let para = $(this).parent('.para');
    schedTimeout();
    syntaxHL(para, e);
});

function esc_md(raw) {
    return raw.replace(/\\/g, '&#92;')
              .replace(/\//g, '&#47;')
              .replace(/\[/g, '&#91;')
              .replace(/\]/g, '&#93;')
              .replace(/\*/g, '&#42;')
              .replace(/\$/g, '&#36;')
              .replace(/\@/g, '&#36;')
              .replace(/\^/g, '&#94;')
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
    code: /(`+)([\s\S]*?[^`])\1(?!`)/g,
    ftnt: /\^\[((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*)\]/g,
    math: /\$((?:\\\$|[\s\S])+?)\$/g,
    ref: /@(\[[\w-\|\=\:]+\])/g,
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
        s('@', 'delimit') + s(fArgs(b, set=false), 'ref')
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

    let args = argsraw.replace(argmatch, function(a,b,c) {
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
    return args;
}

let block = {
    title: /^#!( *)(?:refargs)?(\s*)([^\n]*)(\s*)/,
    heading: /^(#{1,6})(\*?)( *)(?:refargs)?( *)([^\n]+?)$/,
    code: /^``((?: |\n)?)/,
    comment: /^\/\/( ?)/,
    equation: /^\$\$(\*?)( *)(?:refargs)?(\s*)/,
    image: /^!(\*)?( *)(?:refargs)?( *)(\()?([\w-:#/.&%=]*)(\))?(\s*)$/,
    svg: /^\!svg(\*)?( *)(?:refargs)?/,
    envbeg: /^\>\>(\!)?( *)([\w-]+)(\*)?( *)(?:refargs)?/,
    envend: /^\<\<( ?)/,
};

block._refargs = /(?:(\[(?:[^\]]|(?<=\\)\])*\]?))/;

block.title = markthree.replace(block.title)
  ('refargs', block._refargs)
  ();
block.heading = markthree.replace(block.heading)
  ('refargs', block._refargs)
  ();
block.equation = markthree.replace(block.equation)
  ('refargs', block._refargs)
  ();
block.image = markthree.replace(block.image)
  ('refargs', block._refargs)
  ();
block.svg = markthree.replace(block.svg)
  ('refargs', block._refargs)
  ();
block.envbeg = markthree.replace(block.envbeg)
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
        let text = syntaxParseInline(rest);
        return s('$$', 'delimit') + star + cap[2] + id + cap[4] + text;
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

$(document).on('keyup', '.p_input', function(e) {
    let arrs = [37, 38, 39, 40, 48, 57, 219, 221];
    if (arrs.includes(e.keyCode)) {
        var para = $(this).parent('.para');
        braceMatch(this, para);
    }
});

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

// folding/unfolding

function getFoldLevel(para) {
    return parseInt(para.attr('fold_level'));
}

function getFoldParas(pid) {
    let para = getPara(pid);
    let l = para.attr('head_level');
    if (para.attr('env') == 'heading') {
        let fps = [para];
        let nx = Object.entries(para.nextAll('.para'));
        for (const [k, p] of nx) {
            if ($(p).attr('head_level') <= l) {
                break;
            }
            if (!$(p).hasClass('folder')) {
                fps.push(p);
            }
        }
        // what the fuck jquery, why (returns differnt object type in the two cases)
        return [$(fps), $(fps).first()[0]];
    } else {
        let fps = $(`[env_pid=${pid}]`);
        return [$(fps), $(fps).first()];
    }
}

function initFold() {
    folded = cooks('folded') || folded;
    folded.forEach(pid => {
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

function fold(para, init=false) {
    console.log('fold', para);
    let env_pid = para.attr('env_pid');
    let fold_pid = para.attr('fold_pid');
    if (env_pid) {
        const foldParas = getFoldParas(env_pid);
        foldParas[0].each(function() {
            let para = $(this);
            const l = getFoldLevel(para);
            para.attr('fold_level', l+1);
        });
        const fold = $(`[fold_pid=${env_pid}]`).first();
        const l = getFoldLevel(fold);
        fold.attr('fold_level', l+1);
        makeActive(fold);
        if (!init) {
            folded.push(env_pid);
            const foldcookie = JSON.stringify(folded);
            document.cookie = `folded=${foldcookie}; path=/; samesite=lax; secure`;
        }
    } else if (fold_pid) {
        const index = folded.indexOf(fold_pid);
        if (index > -1) {
            folded.splice(index, 1);
        }
        const foldParas = getFoldParas(fold_pid);
        foldParas[0].each(function() {
            let para = $(this);
            const l = getFoldLevel(para);
            para.attr('fold_level', l-1);
        });
        const fold = $(`[fold_pid=${fold_pid}]`).first();
        const l = getFoldLevel(fold);
        fold.attr('fold_level', l-1);
        makeActive(foldParas[1]);
        const foldcookie = JSON.stringify(folded);
        document.cookie = `folded=${foldcookie}; path=/; max-age=604800; samesite=lax; secure`;
    }
    renderFold();
}

function unfold() {
    $('.para').attr('fold_level', 0);
    folded = [];
    const foldcookie = JSON.stringify(folded);
    document.cookie = `folded=${foldcookie}; path=/; max-age=604800; samesite=lax; secure`;
    renderFold();
}
