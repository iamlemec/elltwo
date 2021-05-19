/// init commands ///

// flags and global vars
var ext_macros = {};
var macros = ext_macros;
var cc = false; // is there a cc window open?
var ext_refs = {};
var folded = []; // current folded pids

// inner HTML for para structure. Included here for updating paras
inner_para = `
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

getPara = function(pid) {
    return $(`#content [pid=${pid}]`);
};

makePara = function(para, defer=true) {
    para.html(inner_para);
    rawToRender(para, defer); // postpone formatting
    rawToTextarea(para);
}

$(document).ready(function() {
    var url = `http://${document.domain}:${location.port}`;
    client.connect(url, () => {
        client.sendCommand('join_room', {'room': aid, 'get_locked': true}, (response) => {
            lockParas(response);
        });
    });

    // join room specific to article and get locked paras

    $('.para').each(function() {
        let para = $(this);
        makePara(para);
    });

    envClasses();
    createRefs();

    // set folded paras from cookie
    folded = cooks('folded') || folded;
    folded.forEach(pid => {
        let para = getPara(pid);
        fold(para, init=true);
    })
    renderFold();

    // set external reference for import_markdown arts
    if (g_ref) {
        $('.para').each(function() {
            let para = $(this);
            updateRefHTML(para);
        });
        client.sendCommand('update_g_ref', {'aid': aid, 'g_ref': false}, function(response) {
            console.log(`g_ref set to '${response}'`);
        });
    };

    if (!readonly) {
        setBlurb();
    }
});

/////////////////// EDITING /////////

// get raw text from data-raw attribute, parse, render
rawToRender = function(para, defer, raw=null) {
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
    renderKatex(para);

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
        };
    }
};

rawToTextarea = function(para) {
    var textArea = para.children('.p_input');
    var raw = para.attr('raw');
    textArea.val(raw);
};

updateFromTextarea = function(para) {
    var raw = para.children('.p_input').val();
    var pid = para.attr('pid');
    client.sendCommand('update_para', {'pid': pid, 'text': raw});
};

/// Severer Command Editing

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
    para.remove();
    envClasses();
    createRefs(); // we may be able to scope this more
};

insertParaRaw = function(pid, new_pid, before=true, raw='') {
    console.log('insertPara:', pid, new_pid, before, raw);
    var para = getPara(pid);
    var new_para = $('<div>', {class: 'para', pid: new_pid, raw: raw});
    if (before) {
        let prev = para.prev()
        if (prev.hasClass('folder')){
            prev.before(new_para);
        } else {
        para.before(new_para);
        }
    } else {
        para.after(new_para);
    }
    new_para.html(inner_para);
    return new_para
};

insertPara = function(pid, new_pid, before=true, raw='') {
    let new_para = insertParaRaw(pid, new_pid, before, raw);
    rawToRender(new_para);
    rawToTextarea(new_para);
    makeActive(new_para);
    sendMakeEditable();
};

pasteCB = function(pid, paste) {
        var n = null;
    paste.forEach(d => { //d is [new_pid, paste_id, text] (text if forign)
        const txt = getPara(d[1]).attr('raw') || d[2];
        let new_para = insertParaRaw(pid, d[0], false, txt);
        rawToRender(new_para, true); //defer
        rawToTextarea(new_para);
        n = n || new_para;
        pid = d[0];
    })
    envClasses();
    createRefs();
    $('.para').removeClass('copy_sel');
    makeActive(n);
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
            insertPara(pre, pid, before=false, raw=raw);
        } else {
            var para = getPara(pid);
            var base = getPara(pre);
            base.after(para);
        }
    });
}

///////////////// ENVS /////////


//creates classes for environs
envClasses = function(outer) {
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
    var env_id = null;
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
            env_id = null;
            env_args = null;
            env_paras = [];
        }

        if (!env_name && para.hasClass('env_beg')) { // cannot open an env if one is already open
            env_name = para.attr('env');
            env_id = para.attr('pid'); //changed to use PID so all envs have this.
            env_args = para.data('args');
            if (env_id != undefined) {
                para.attr('env_sel', `[env_id="${env_id}"]`);
            }
        }

        if (env_name) {
            env_paras.push(para[0]);
        }

        if (para.hasClass('env_end')) { // closing tag = current open tag
            var env_all = $(env_paras);
            var txt_all = env_all.children('.p_text');
            env_all.addClass('env');
            env_all.attr('env_id', env_id);
            txt_all.addClass(`env__${env_name}`);
            if(folded.includes(env_id)){
                env_all.addClass('folded');
            };
            envFormat(txt_all, env_name, env_args);

            env_name = null;
            env_id = null;
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
};


envFormat = function(ptxt, env, args) {
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

makeCounter = function(env, inc=1) {
    return $('<span>', {class: 'num', counter: env, inc: inc});
}

simpleEnv = function(ptxt, env, head='', tail='', number=true, args={}) {
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
    fold_t = $('<span>', {class: `comment fold_text`});
    pre_fold.append(['. ', fold_t]);
    first.prepend(pre);

    let last = ptxt.last();
    let pos = $('<span>', {class: `env_add ${env}_footer`, html: tail});
    pos.prepend(' ');
    last.append(pos);

    let fold = $('<div>', {class: `para folder`, html: pre_fold});
    para = first.parent()
    let env_id = para.attr('env_id')
    fold.attr('fold_id', env_id)
        .attr('fold_level', 0)
    // if(!folded.includes(env_id)){
    //     fold.addClass('folded')
    // }
    para.before(fold);
};

// we probably want to pass targ as an argument
errorEnv = function(ptxt, args) {
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
};

titleEnv = function(ptxt, args) {
    return ptxt;
};

headingEnv = function(ptxt, args) {
    ptxt.addClass(`env__heading_h${args.level}`);
    ptxt.attr('head_level', args.level);
    pre_fold = ptxt.clone();
    let num = $('<span>', {class: 'env_add'});
    let pre_num = num.clone()
    if (args.number) {
        l = 1;
        while (args.level - l) {
            num.append(makeCounter(`heading${l}`, 0));
            num.append('.');
            l += 1;
        }
        pre_num = num.clone()
        num.append(makeCounter(`heading${l}`, 0));
        pre_num.append(makeCounter(`heading${l}`, 1));
    }
    ptxt.prepend([num, ' ']);
    pre_fold.prepend([pre_num, ' ']);
    fold_t = $('<span>', {class: `comment fold_text`});
    pre_fold.append([' ', fold_t]);


    let fold = $('<div>', {class: `para folder`, html: pre_fold});
    para = ptxt.parent()
    let env_id = para.attr('pid')
    para.attr('env_id', env_id)
        .attr('head_level', args.level);
    fold.attr('fold_id', env_id)
        .attr('head_level', args.level)
        .attr('fold_level', 0);
    // if(!folded.includes(env_id)){
    //     fold.addClass('folded')
    // }
    para.before(fold);
};

equationEnv = function(ptxt, args) {
    if (args.number) {
        var num = makeCounter('equation');
        var div = $('<div>', {class: 'env_add eqnum'});
        div.append(['(', num, ')']);
        ptxt.append(div);
    }
};

figEnv = function(ptxt, args) {
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
};

imgCache = {};

imgEnv = function(ptxt, args) {
    figEnv(ptxt, args);

    var fig = ptxt.find('.fig_cont');
    var img = $('<img>', {class: 'env_add'});
    fig.append(img);

    var key = ptxt.parent().attr('id');
    if (key in imgCache) {
        var url = imgCache[key];
        img.attr('src', url);
    } else {
        client.sendCommand('get_image', {'key': key}, (ret) => {
            if (ret.found) {
                const blob = new Blob([ret.data], {type: ret.mime});
                var url = URL.createObjectURL(blob);
                imgCache[key] = url;
                img.attr('src', url);
            }
        });
    }
};

// simple envs for user creation and simpler setup
// number is if number is defult (can be overidden with *)
s_env_spec = {
    'theorem': {head: 'Theorem', tail: '--', number: true},
    'lemma': {head: 'Lemma', tail: '--', number: true},
    'axiom': {head: 'Axiom', tail: '--', number: true},
    'definition': {head: 'Definition', tail: '--', number: false},
    'example': {head: 'Example', tail: `<span class='qed'>&#8718;</span>`, number: true},
    'proof': {head: 'Proof', tail: `<span class='qed'>&#8718;</span>`, number: false},
};

env_spec = {
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

parse_preamble = function(raw){
    int_macros = {}; //internal macros
    macro_list = raw.split(/[\n,]+/)//split on \n or comma
    .filter(macraw => macraw.includes(':')) //is it a macro?
    .map(macraw => macraw.split(':'))//split on :
    .forEach(el => int_macros[el[0]] = el[1]);//save internal macros
    macros = Object.assign({}, int_macros, ext_macros);//merge internal and ext macros,overwrites internal
};


renderKatex = function(para) {
    para.find('span.latex').each(function() {
        var tex = $(this);
        var src = tex.text();
        tex.empty();
        try {
            katex.render(src, tex[0], {macros: macros,
            throwOnError: false,
            });
        } catch (e) {
            console.log(para.text());
            console.log(src);
            console.log(e);
        }
    });
    para.find('div.latex').each(function() {
        var tex = $(this);
        var src = tex.text();
        $(this).empty();
        try {
            katex.render(src, tex[0], {displayMode: true,
                macros: macros,
                throwOnError: false,
            });
        } catch (e) {
            console.log(para.text());
            console.log(src);
            console.log(e);
        }
    });

};

/// Numbering and TOC

createNumbers = function(outer) {
    var nums = {};
    outer.find('.num').each(function() {
        var counter = $(this).attr('counter');
        var inc = parseInt($(this).attr('inc'));
        nums[counter] = nums[counter] || 0;
        nums[counter] += inc;
        $(this).text(nums[counter]);
    });
};

createTOC = function(outer) {
    toc = $('#toc');
    toc.find('.toc_entry').remove();
    outer.find('.env__heading').not('.folder .env__heading').each(function() {
        let level = $(this).attr('head_level');
        let text = $(this).text();
        let id = $(this).parent('.para').attr('id');
        let sec = id
            ? $('<a>', {class: `toc_entry head_level${level}`, href: '#'+id, text: text})
            : $('<span>', {class: `toc_entry head_level${level}`, text: text});
        toc.append(sec);
    });
};



/// REFERENCING and CITATIONS

// renderedCites = new Set(); // state var, citations previously rendered

createRefs = function(para) {
    var refs;
    if (para == undefined) {
        refs = $('.reference');
    } else {
        refs = para.find('.reference');
    }

    // get citations
    var citeKeys = new Set();
    refs.each(function() {
        var ref = $(this);
        if (!ref.data('extern')) {
            var key = ref.attr('citekey');
            if (($('#'+key).length == 0) && (key != '_self_')) {
                citeKeys.add(key);
            };
        };
    });

    if (citeKeys.size > 0) {
        client.sendCommand('get_cite', {'keys': [...citeKeys]}, function(response) {
            renderBibLocal(response);
            renderCiteText(para);
        });
    } else {
        renderCiteText(para);
    }

    //renderedCites = citeKeys;
};

getTro = function(ref, callback) {
    //var ref = $(this); // the reference (actually an 'a' tag)
    var text = ref.attr('text') || '';

    var tro = {};
    var key = ref.attr('citekey');

    if (key == '_self_') {
        tro.tro = ref;
        tro.cite_type = 'self';
        callback(ref, tro, text);
    } else if (key == '_ilink_') {
        client.sendCommand('get_blurb', ref.attr('href'), function(response) {
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
        var [extern, citekey] = key.split(':');
        client.sendCommand('get_ref', {'title': extern, 'key': citekey}, function(data) {
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
};

troFromKey = function(key, tro={}) {
    tro.id = key;
    tro.tro = $('#'+key); // the referenced object
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
};

renderCiteText = function(para) {
    var refs;
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
};

// routing is split due to aysc of sever commands
renderRef = function(ref, tro, text, ext) {
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
    };
};

refCite = function(ref, tro) {
    var authors = tro.attr('authors').split(',');
    var year = tro.attr('year');
    var format = ref.attr('format') || '';
    var href = '#' + tro.attr('id');

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
    ref.attr('href', "");
};

refEquation = function(ref, tro, ext) {
    var num = tro.find('.num')[0];
    var text = $(num).text();
    var citeText = (ext) ? `(${ext}, Eq. ${text})` :`(${text})`;
    ref.text(citeText);
};

refEnv = function(ref, tro, env, ext) {
    var format = ref.attr('format') || '';
    var num = tro.find('.num')[0];
    var text = $(num).text();

    var citeText;
    if (format == 'plain') {
        citeText = text;
    } else {
        citeText = `${env} ${text}`;
    }

    if(ext){
        citeText += ` [${ext}]`
    }

    ref.text(citeText);
};

refText = function(ref, tro, text) {
    ref.text(text);
};

refError = function(ref) {
    var href = ref.attr('citekey') || '';
    ref.html(`<span class="ref_error">@[${href}]</span>`);
};

refSection = function(ref, tro, ext) {
    refEnv(ref, tro, 'Section', ext);
};

refFigure = function(ref, tro, ext) {
    refEnv(ref, tro, 'Figure', ext);
};

refSelf = function(ref) {
    var text = ref.attr('text');
    ref.text(text);
};

ref_spec = {
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

/// THIS IS REPATED FROM THE BIB.JS, we should make it more efficent

renderBibLocal = function(data){
    // $('#para_holder').empty();
    data.map(createBibEntry);
}

createBibEntry = function(cite) {
    $('#'+cite['citekey']).remove();

    var yr = cite['year'] ? ` ${cite['year']}. ` : '';
    var vol = cite['volume'] ? `, ${cite['volume']}` : '';
    var num = cite['number'] ? `, no. ${cite['number']}` : '';
    var pgs = cite['pages'] ? `, pp. ${cite['pages']}` : '';
    var title = cite['title'] ? `${cite['title']}` : '';
    var pubs = ['book', 'incollection'];
    var jns = ['article', 'techreport', 'unpublished'];

    var pub;
    var journal;
    if (pubs.includes(cite['entry_type'])) {
        pub = cite['publisher'] || '';
        journal = (cite['booktitle']) ? `In ${cite['booktitle']}`: '';
    } else if (jns.includes(cite['entry_type'])) {
        pub = '';
        journal = cite['journal'] || 'mimeo';
    }

    var author = `<b>${cite['author']}</b>. ` || '';
    var index = (vol || num || pgs) ? `${vol + num + pgs}.` : '';

    var author_list = cite['author'].split(' and ').map(auth => auth.split(',')[0]);

    $('#bib_block').append(
        `<div class="cite" id=${cite['citekey']} cite-type="cite" authors="${author_list}" year="${cite['year']}">
        <span class="citeText">
        ${author}${yr}${title}. <em>${journal}</em>${index} ${pub}
        </span>
        <span class="citekey">${cite['citekey']}</span>
        </div>`
    );
};

//// POPUP FUNCTIONALITY // turned off for mobile for now

if (!mobile) {
    $(document).on({
        mouseenter: function() {
            var ref = $(this);
            ref.data('show_pop', true);
            var html = getTro(ref, renderPop);
        },
        mouseleave: function() {
            var ref = $(this);
            ref.data('show_pop', false);
            $('#pop').remove();
            $(window).unbind('mousemove')
        },
    }, '.pop_anchor');
}

createPop = function(html='', link=false) {
    var pop = $('<div>', {id: 'pop', href: link, html: html});
    $('#bg').append(pop);

    h = pop.height();
    w = pop.width();

    if (!mobile) { // no mouse binding with mobile popups
        $(this).mousemove(function(event) {
            var mid = window.innerHeight / 2;
            var y = event.pageY - h - 35;
            if (event.pageY < mid) { // if on top half of page
                y = event.pageY + 35;
            }
            pop.css({
                'left': (event.pageX - 0.5*w - 10) + 'px', // offset 10px for padding
                'top': (y) + 'px', // offset up by 35 px
            });
        });
    }
};

// generates pop text from tro (only for internal refs)
popText = function(tro) {
    if (tro.cite_type == 'self') {
        return pop_spec.self(tro.tro);
    } else if (tro.cite_type == 'env') {
        if (tro.cite_env in pop_spec) {
            var paras = $(tro.cite_sel);
            return pop_spec[tro.cite_env](paras);
        } else if (tro.cite_env in s_env_spec) { //simple env
            var paras = $(tro.cite_sel);
            return popEnv(paras)
        } else {
            return pop_spec.error('not_found');
        }
    } else if (tro.cite_type == 'cite') {
        return pop_spec.cite(tro.tro);
    } else if (tro.cite_type == 'err') {
        return pop_spec.error(tro.cite_err);
    }
};

renderPop = function(ref, tro, text, ext) {
    if (!ref.data('show_pop')) { // we've since left with mouse
        return;
    }
    var pop;
    if (ext != undefined) {
        pop = tro.tro;
    } else {
        pop = popText(tro);
    };
    link = mobile ? ref.attr('href'): false;
    createPop(pop, link);
}

popError = function(err='not_found') {
    if (err == 'not_found') {
        return "[Reference Not Found]";
    } else if (err == 'env_err') {
        return "[Referenced Environment Not Closed]";
    } else {
        return "[Error]";
    }
};

popSection = function(tro) {
    return tro.children('.p_text').text();
};

popEquation = function(tro) {
    return tro.children('.p_text').html();
};

popCite = function(tro) {
    return tro.find('.citeText').html();
};

popSelf = function(tro) {
    return tro.find('.ft_content').html();
};

popEnv = function(tro) {
    var html = '';
    tro.each(function() {
        var ptxt = $(this).children('.p_text');
        html += ptxt.html();
    });

    return html;
};

pop_spec = {
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


/// External References

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

updateRefHTML = function(para) {
    let new_id = para.attr('id') || para.attr('env_id');
    let old_id = para.attr('old_id');

    if (new_id) {
        ref_list.push(new_id)
        let ref = createExtRef(new_id);
        client.sendCommand('update_ref', ref, function(success) {
            console.log('success: updated ref');
        });
    }

    if (old_id) {
        if($('#'+old_id).length > 0){
            let ref = createExtRef(old_id);
            client.sendCommand('update_ref', ref, function(success) {
                console.log('success: updated ref');
            });
        } else {
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

/// SyntaxHighlighting

syntaxHL = function(para,e=null) {
    var text = para.children('.p_input');
    var view = para.children('.p_input_view');
    var raw = text.val();
    if(e){
        cc_refs(raw,view,e);
    }
    var parsed = sytaxParseBlock(raw);
    view.html(parsed);
};

$(document).on('input', '.p_input', function(e){
    para=$(this).parent('.para');
    // paraTimeOut();
    client.schedCanary();
    syntaxHL(para,e);
});

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
    let open_ref = /@(\[)?([\w-\|\=^]+)?(\:)?([\w-\|\=^]+)?(?!.*\])(?:[\s\n]|$)/;
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

            if (cap[3] && !cap[2]) { // searching for ext page
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

esc = function(raw){
    out = raw.replace(/\[/g, '&#91;')
             .replace(/\]/g, '&#93;')//brakets
             .replace(/\$/g, '&#36;')//math
             .replace(/\@/g, '&#36;')//@
             .replace(/\*/g, '&#42;')//*
             .replace(/\!/g, '&#33;')//!
             .replace(/%/g, '&#37;')//%

    return out
}

inlines = {
    comment: /%(?!%)([^\n]+?)(\n|$)/g,
    code: /(`+)([\s\S]*?[^`])\1(?!`)/g,
    ftnt: /\^\[((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*)\]/,
    math: /\$((?:\\\$|[\s\S])+?)\$/g,
    ref: /@(\[[\w-\|\=\:]+\])/g,
    ilink: /\[\[([^\]]+)\]\]/g,
    em: /\*((?:\*\*|[\s\S])+?)\*(?!\*)/g,
    strong: /\*\*([\s\S]+?)\*\*(?!\*)/g,
}


sytaxParseInline = function(raw) {
    var html = raw;
    html = html.replace(/\</g, '&LT')// html escape
               .replace(/\>/g, '&GT')// html escape
               .replace(/\\\%/g, '\\&#37;')//comment escape
               .replace(/\\\$/g, '\\&#36;')//tex escape
               .replace('_!L_', `<span class='brace'>`)
               .replace('_!R_', `</span>`);

    html = html.replace(inlines.comment, function(a,b,c) {
        return s('%', 'comment_head') + s(esc(b), 'comment') + c;
    });
    html = html.replace(inlines.code, function(a,b,c) {
        return s(b, 'comment_head') + s(esc(c), 'code') + s(b, 'comment_head');
    });
    html = html.replace(inlines.ftnt, function(a,b) {
        b = b.replace('|', s('|', 'hl'));
        return s('^[', 'delimit') +  b + s(']', 'delimit');
    });
    html = html.replace(inlines.math, function(a,b) {
        return s('$', 'delimit') + s(b, 'math') + s('$', 'delimit');
    });
    html = html.replace(inlines.ref, function(a,b){
        return s('@', 'delimit') + s(fArgs(b, set=false), 'ref');
    });
    html = html.replace(inlines.ilink, function(a,b) {
        return s('[[', 'delimit') + s(b, 'ref') + s(']]', 'delimit');
    });
    html = html.replace(inlines.strong, function(a,b) {
        return s('&#42;&#42;', 'comment_head') + b + s('&#42;&#42;', 'comment_head');
    });
    html = html.replace(inlines.em, function(a,b) {
        return s('*', 'delimit') + b + s('*', 'delimit');
    });

    return html;
}

s = function(text, cls) {
    return `<span class=syn_${cls}>${text}</span>`;
}

//uses lookbehinds, might not work on old ass browsers
//set = true is for non ref when seting ids
fArgs = function(argsraw, set=true){

    var argmatch = /([\[\|\n\r])((?:[^\]\|\n\r]|(?<=\\)\||(?<=\\)\])*)/g
    var illegal = /[^a-zA-Z\d\_\-]/
    if(!set){
        illegal = /[^a-zA-Z\d\_\-\:]/
    }

    let args = argsraw.replace(argmatch, function(a,b,c) {     
        c = c.split(/(?<!\\)\=/);
        if(c.length > 1){
            let val = c.pop()
            let arg_val = s(sytaxParseInline(val), 'delimit')
            let arg_key = ""
            c.forEach(key => {
                if(illegal.test(key)){
                    arg_key += s(key, 'err') + '='
                } else if (key == 'id' && illegal.test(val)){
                    arg_key += s(key, 'err') + '='
                    arg_val = s(val, 'err')
                } else {
                    arg_key += s(key, 'math') + '='
                }
            })
         return b + arg_key + arg_val
        } else {
        let arg_key = (c[0]) ? s(c[0], 'math') : "";
        if(illegal.test(c[0])){
            arg_key = s(c[0], 'err')
        }
        return b + arg_key;
        }
    });
    return esc(args)
};


var blocks = {
    title: /^#\!([\n\r\s]*)(?:refargs)?([\n\r\s]*)([^\n]*)([\n\r]*)([\s\S]*)/,
    heading: /^(#{1,6})(\*?)([\n\r\s]*)(?:refargs)?([\n\r\s]*)([^\n]+?)? *#* *(?:\n+|$)/,
    text: /^[^\n]+/,
    code: /^``([\S\s]*)/,
    comment: /^(\/\/|\%+)([\S\s]*)/,
    equation: /^\$\$(\*?)([\n\r\s]*)(?:refargs)?([\n\r\s]*)((?:[^\n]+\n*)*)(?:\n+|$)/,
    figure: /^@(!|\|) *(?:\[([\w-]+)\]) *([^\n]+)\n((?:[^\n]+\n*)*)(?:\n+|$)/,
    svg: /^\!svg(\*)?([\n\r\s]*)(?:refargs)?([\n\r\s]*)((?:[^\n]+\n*)*)(?:$)/,
    image: /^!(\*)?([\n\r\s]*)(?:refargs)(\s*)(\()([\w-:#/.&%=]*)(\))?([\s\S]*)/,
    envbeg: /^\>\>(\!)?([\n\r\s]*)([\w-]+)?(\*)?([\n\r\s]*)(?:refargs)?([\n\r\s]*)((?:[^\n]+\n*)*)(?:\n+|$)/,
    envend: /^\<\<((?:[^\n]+\n?)*)/,
};

blocks._refargs = /(?:(\[(?:[^\]]|(?<=\\)\])*\]?))/;

blocks.title = markthree.replace(blocks.title)
  ('refargs', blocks._refargs)
  ();
blocks.heading = markthree.replace(blocks.heading)
  ('refargs', blocks._refargs)
  ();
blocks.svg = markthree.replace(blocks.svg)
  ('refargs', blocks._refargs)
  ();
blocks.image = markthree.replace(blocks.image)
  ('refargs', blocks._refargs)
  ();
blocks.envbeg = markthree.replace(blocks.envbeg)
  ('refargs', blocks._refargs)
  ();
blocks.equation = markthree.replace(blocks.equation)
  ('refargs', blocks._refargs)
  ();

sytaxParseBlock = function(raw) {
    if (cap = blocks.title.exec(raw)) {
        let id = (cap[2]) ? s(fArgs(cap[2]), 'ref') : "";
        let tit = (cap[4]) ? sytaxParseInline(cap[4]) : "";
        let pre = (cap[6]) ? s(sytaxParseInline(cap[6]) , 'ref'): "";
        return s('#!', 'hl') + cap[1] + id + cap[3] + tit + cap[5] + pre;
    }

    if (cap = blocks.heading.exec(raw)) {
        let star = (cap[2]) ? s(cap[2], 'hl') : "";
        let id = (cap[4]) ? s(fArgs(cap[4]), 'ref') : "";
        let text = (cap[6]) ? sytaxParseInline(cap[6]) : "";
        return s(cap[1], 'delimit') + star + cap[3] + id + cap[5] + text;
    }

    if (cap = blocks.code.exec(raw)) {
        let text = (cap[1]) || "";
        return s('``', 'hl') + s(esc(text), 'code');
    }

    if (cap = blocks.comment.exec(raw)) {
        let text = (cap[2]) || "";
        return s(cap[1], 'comment_head') + s(esc(text), 'comment');
    }

    if (cap = blocks.equation.exec(raw)) {
        let id = (cap[3]) ? s(fArgs(cap[3]), 'ref') : "";
        let star = (cap[1]) ? s(cap[1], 'hl') : "";
        let text = (cap[5]) ? sytaxParseInline(cap[5]) : "";
        return s('$$', 'delimit') + star + cap[2] + id + cap[4] + text;
    }

    if (cap = blocks.envbeg.exec(raw)) {
        let bang = (cap[1]) ? s('!', 'hl') : "";
        let env = (cap[3]) ? s(cap[3], 'ref') : "";
        let star = (cap[4]) ? s(cap[4], 'hl') : "";
        let id = (cap[6]) ? s(fArgs(cap[6]), 'ref'): "";
        let text = (cap[8]) ? sytaxParseInline(cap[8]) : "";
        return s('>>', 'delimit') + bang + cap[2] + env + star + cap[5] + id + cap[7] + text;
    }

    if (cap = blocks.svg.exec(raw)) {
        let star = (cap[1]) ? s('*', 'hl') : "";
        let id = (cap[3]) ? s(fArgs(cap[3]), 'ref'): "";
        let text = (cap[5]) ? sytaxParseInline(cap[5]) : "";
        return s('!', 'hl') + s('svg', 'delimit') + star + cap[2] + id + cap[4] + text;
    }

    if (cap = blocks.image.exec(raw)) {
        let star = (cap[1]) ? s('*', 'hl') : "";
        let id = (cap[3]) ? s(fArgs(cap[3]), 'ref'): "";
        let l = (cap[5]) ? s('(', 'delimit') : "";
        let href = (cap[6]) ? s(cap[6], 'hl') : "";
        let r = (cap[7]) ? s(')', 'delimit') : "";
        let text = (cap[8]) ? sytaxParseInline(cap[8]) : "";
        return s('!', 'hl') + star + cap[2] + id + cap[4] + l + href + r + text;
    }

    if (cap = blocks.envend.exec(raw)) {
        return s('<<', 'delimit') + sytaxParseInline(cap[1]);
    }

    return sytaxParseInline(raw);
};

$(document).on('keyup', '.p_input', function(e) {
    let arrs = [37, 38, 39, 40, 48, 57, 219, 221];
    if (arrs.includes(e.keyCode)) {
        var para = $(this).parent('.para');
        braceMatch(this, para);
    }
});

braceMatch = function(textarea, para) {
    var delimit = {'(': ')', '[': ']', '{': '}'};
    var rev_delimit = {')': '(', ']': '[', '}': '{'};

    var cpos = textarea.selectionStart;
    var text = textarea.value;

    var after = text[cpos];
    var before = text[cpos-1] || false;

    if (after in delimit) {
        var pos = getBracePos(text, after, delimit[after], cpos);
        if (pos) {
            let v = $(textarea).siblings('.p_input_view');
            braceHL(v, text, pos, para);
        }
    } else if (before in delimit) {
        var pos = getBracePos(text, before, delimit[before], cpos-1);
        if (pos) {
            let v = $(textarea).siblings('.p_input_view');
            braceHL(v, text, pos, para);
        }
    } else if (before in rev_delimit) {
        var pos = getBracePos(text, before, rev_delimit[before], cpos, true);
        var v = $(textarea).siblings('.p_input_view');
        braceHL(v, text, pos, para);
    } else if (after in rev_delimit) {
        var pos = getBracePos(text, after, rev_delimit[after], cpos+1, true);
        var v = $(textarea).siblings('.p_input_view');
        braceHL(v, text, pos, para);
    } else {
        $('.brace').contents().unwrap();
    }
};

getBracePos = function(text, brace, match, cpos, rev=false) {
    var len = text.length;
    if (rev) {
        text = text.split('').reverse().join('');
        cpos = len - cpos;
    }

    var z = 1;
    var pos = cpos;

    while (true) {
        pos += 1;
        if (pos <= len) {
            char = text[pos];
            if (char == brace) {
                z += 1;
            } else if (char == match) {
                z -= 1;
            }
            if (z==0) {
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
        return {'l': Math.max(0, len - pos - 1), 'r': len - cpos - 1}
    } else {
        return {'l': cpos, 'r': pos}
    }
};

braceHL = function(view, text, pos, para) {
    var L = `\_\!L\_`;
    var R = `\_\!R\_`;
    var new_text = [
        text.slice(0, pos['l']),
        L,
        text.slice(pos['l'], pos['r']+1),
        R,
        text.slice(pos['r']+1)
    ].join('');

    var syn = sytaxParseBlock(new_text);
    view.html(syn);

    setTimeout(function() {
        $('.brace').contents().unwrap();
        syntaxHL(para);
    }, 800);
};
