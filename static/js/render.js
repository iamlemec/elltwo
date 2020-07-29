/// init commands ///

// inner HTML for para structure. Included here for updating paras
inner_para = `<div class="p_text"></div>
              <textarea class="p_input"></textarea>
              <div class="control">
              <div class="controlDots">&#9776;</div>
              <div class="controlButs">
              <button class="update">Update</button>
              <button class="before">Before</button>
              <button class="after">After</button>
              <button class="delete">Delete</button>
              </div>
              </div>`;

getPara = function(pid) {
    return $(`[pid=${pid}]`);
};


$(document).ready(function() {
    var url = `http://${document.domain}:${location.port}`;
    client.connect(url);

    $('.para').each(function() {
        var para = $(this);
        para.html(inner_para);

        var raw = para.attr('raw');
        dataToText(para, raw, false, false); // postpone formatting
        rawToTextArea(para);
    });

    envClasses();
    createRefs()
    // $('.para').each(createRefs($(this)));
    $('.para').each(function(){
        renderCiteText($(this))
    });
});

/////////////////// EDITING /////////

/// editing commands for paras (triggered by incoming socket commands)
/// local changes only --> to reflect server changes without full reload

// get raw text from data-raw attribute, parse, render
dataToText = function(para, raw, format=true, ref=true) {
    var mark_out = markthree(raw);
    var html_text = mark_out['src'];
    var env_info = mark_out['env'];

    para.children('.p_text').html(html_text);

    //must remove old classes, to prevent pileup / artifacts
    para.removeClass('env_end')
        .removeClass('env_beg')
        .removeAttr('env')
        .removeAttr('id');

    if (env_info != null) {
        if (env_info.type == 'begin') {
            para.attr('env', env_info.env);
            para.addClass('env_beg');
            if (env_info.single) {
                para.addClass('env_end');
            }
            if ('id' in env_info.args) {
                para.attr('id', env_info.args.id);
                delete env_info.args.id;
            }
            para.data('args', env_info.args);
        } else if (env_info.type == 'end') {
            para.addClass('env_end');
        } else if (env_info.type == 'heading') {
            para.addClass('heading');
        }
    }

    renderKatex(para);

    if (format) {
        envClasses();
    };
    if(ref){
    createRefs(para);
    renderCiteText(para);
    };
};

rawToTextArea = function(para) {
    var textArea = para.children('.p_input');
    var raw = para.attr('raw');
    textArea.val(raw);
};

updateFromTextArea = function(para) {
    var raw = para.children('.p_input').val();
    var pid = para.attr('pid');
    client.sendCommand('update_para', {'pid': pid, 'text': raw});
};

/// Severer Command Editing

updatePara = function(pid, raw) {
    var para = getPara(pid);
    para.attr('raw', raw);
    dataToText(para, raw);
};

updateParas = function(para_dict) {
    for (pid in para_dict){
        var para = getPara(pid);
        para.attr('raw', para_dict[pid]);
        dataToText(para, para_dict[pid]);
    }
};

deletePara = function(pid) {
    var para = getPara(pid);
    para.remove();
    envClasses();
};

insertPara = function(pid, new_pid, before=true, raw='') {
    var para = getPara(pid);
    var new_para = $('<div>', {class: 'para', pid: new_pid, raw: raw});
    if (before) {
        para.before(new_para);
    } else {
        para.after(new_para);
    }
    new_para.html(inner_para);
    dataToText(new_para, raw);
    rawToTextArea(new_para);
};

/////////////////// ENVS /////////

// move this to backend when we have user genereted envs

// creates classes for environs
envClasses = function() {
    // remove old env classes
    $(".para").removeClass(function(index, css) {
        return (css.match(/(^|\s)env__\S+/g) || []).join(' ');
    });

    // remove error markers
    $('.para').removeClass('env_err');

    // remove formatting addins
    $('.env_add').remove();

    // env state
    var env_name = null;
    var env_args = null;
    var env_paras = [];

    // forward env pass
    $('.para').each(function() {
        var para = $(this);

        if (!env_name && para.hasClass('env_end') && !para.hasClass('env_beg')) {
            para.addClass('env_err');
            envFormat(para, 'error', {code: 'ending'});
        }

        if (env_name && para.hasClass('env_beg')) { // error on nested environs
            var new_env = para.attr('env');
            para.addClass('env_err');
            envFormat(para, 'error', {code: 'open', env: env_name, new_env: new_env});
        }

        if (env_name && para.hasClass('heading')) { // sections or headings break envs
            var new_env = para.attr('env');
            para.addClass('env_err');
            envFormat(para, 'error', {code: 'heading', env: env_name, new_env: new_env});

            env_name = null;
            env_args = null;
            env_paras = [];
        }

        if (!env_name && para.hasClass('env_beg')) { // cannot open an env if one is already open
            env_name = para.attr('env');
            env_args = para.data('args');
        }

        if (env_name) {
            env_paras.push(para[0]);
        }

        if (para.hasClass('env_end')) { // closing tag = current open tag
            var env_all = $(env_paras);
            env_all.addClass('env')
                   .addClass(`env__${env_name}`)
                   .attr('env', env_name);
            envFormat(env_all, env_name, env_args);

            env_name = null;
            env_args = null;
            env_paras = [];
        }
    });

    // add error for open envs left at the end
    if (env_name) {
        var env_all = $(env_paras);
        env_all.addClass('env_err');
        envFormat(env_all, 'error', {code: 'eof', env: env_name});
    }

    // format classed envs
    createNumbers();
};

envFormat = function(paras, env, args) {
    if (env in env_spec) {
        env_spec[env](paras, args);
    } else {
        var args = {code: 'undef', env: env};
        env_spec.error(paras, args);
    }
}

//// ENV formatting

makeCounter = function(env, inc=1) {
    return $('<span>', {class: 'num', counter: env, inc: inc});
}

simpleEnv = function(paras, env, head='', tail='', num=false) {
    var first = paras.filter('.env_beg').first().children('.p_text');
    var pre = $('<span>', {class: `env_add ${env}_header`, html: head});
    if (num) {
        var span = makeCounter(env);
        pre.append([' ', span]);
    }
    pre.append('. ');
    first.prepend(pre);

    var last = paras.filter('.env_end').last().children('.p_text');
    var pos = $('<span>', {class: `env_add ${env}_footer`, html: tail});
    pos.prepend(' ');
    last.append(pos);
};

// we probably want to pass targ as an argument
errorEnv = function(paras, args) {
    var mesg;
    var targ;

    if (args.code == 'undef') {
        mesg = `Error: envrionment ${args.env} is not defined.`;
        targ = paras.first();
    } else if (args.code == 'open') {
        mesg = `Error: envrionment ${args.env} not closed at new environment ${args.new_env}.`;
        targ = paras.first();
    } else if (args.code == 'heading') {
        mesg = `Error: envrionment ${args.env} not closed at end of section.`;
        targ = paras.first();
    } else if (args.code == 'eof') {
        mesg = `Error: envrionment ${args.env} not closed at end of document.`;
        targ = paras.last();
    } else if (args.code == 'ending') {
        mesg = `Error: environment ending when not in environment.`;
        targ = paras.first();
    }

    var text = targ.children('.p_text');
    var pre = $('<div>', {class: 'env_add error_footer', html: mesg});
    text.append(pre);
};

numberEnv = function(para, env, head='', tail='', args={}) {
    var num = args.number || '';
    return simpleEnv(para, env, head, tail, num);
};

theoremEnv = function(para, args) {
    return numberEnv(para, 'theorem', 'Theorem', '—', args);
};

proofEnv = function(para, args) {
    return simpleEnv(para, 'proof', 'Proof', `— <span class='qed'>&#8718;</span>`, false);
};

exampleEnv = function(para, args) {
    return numberEnv(para, 'example', 'Example', '', args);
};

env_spec = {
    'theorem': theoremEnv,
    'proof': proofEnv,
    'example': exampleEnv,
    'error': errorEnv
};

//// KATEX

renderKatex = function(para) {
    para.find(".latex").each(function() {
        var tex = $(this);
        var src = tex.text();
        tex.empty();
        try {
          katex.render(src, tex[0],
            //{macros: config["macros"]}
            );
        } catch (e) {
          console.log(para.text());
          console.log(src);
          console.log(e);
        }
    });
    para.find(".equation").each(function() {
        var tex = $(this);
        var src = tex.text();
        $(this).empty();
        try {
            katex.render(src, tex[0], {displayMode: true,
                //macros: config["macros"]
            });
        } catch (e) {
            console.log(para.text());
            console.log(src);
            console.log(e);
        }
    });

};

/// Numbering

createNumbers = function() {
    var nums = {};
    $('.num').each(function() {
        var counter = $(this).attr('counter');
        var inc = parseInt($(this).attr('inc'));
        nums[counter] = nums[counter] || 0;
        nums[counter] += inc;
        $(this).text(nums[counter]);
    });
};

/// REFERENCING and CITATIONS

renderedCites = new Set(); //state var, citations previously rendered


createRefs = function(para=false) {
    var citekeys = new Set();
    $('.reference').each(function() {
        key = $(this).attr('citekey');
        citekeys.add(key);
    });
    //will only require server interaction for novel citations 
    var unRenderedCites = [];
    for(let key of citekeys){
        if(($('#'+key).length == 0)&&(!(renderedCites.has(key)))&&(!(key=="_self_"))){
            unRenderedCites.push(key);
        };
    };
    //remove old bib entries that have been removed
    for(let key of renderedCites){
        if(!(citekeys.has(key))){
            $('.cite#'+key).remove()
        };
    };

    if(unRenderedCites.length > 0){
        client.sendCommand('get_cite', {'keys': unRenderedCites}, function(response){
            renderBibLocal(response);
            if(!para){
                $('.para').each(function(){
                    renderCiteText($(this))
                });
            } else {
             renderCiteText(para);   
            }
        });
    };
    renderedCites = citekeys;
};

renderCiteText = function(para){
    para.find('.reference').each(function() {
        span = $(this); //the reference (actually an 'a' tag)
        key = span.attr('citekey');
        text = span.attr('text') || "";
        if(key=="_self_"){
            tro = span;
            citeType = '_self_';
        } else {
           tro = $('#'+key) || ""; //the referenced object
           citeType = tro.attr('citeType') || tro.attr('env') || '';
        }
        if (citeType in ref_spec){
            if(text){
            ref_spec['text'](span,tro,text)
            }else{
            ref_spec[citeType](span,tro)
            }
        }else {
            ref_spec['error'](span);
        }
    });
    if($('.cite').length > 0){
        $('#bib_block').show()
    }else{
        $('#bib_block').hide()
    }
};


refCite = function(span,tro){

    authors = tro.attr('authors').split(",");
    year = tro.attr('year');
    format = span.attr('format') || "";
    href = '#'+tro.attr('id');

    if(authors.length == 2){
        citeText = authors[0] + " and " + authors[1];
    } else if(authors.length < 2){
        citeText = authors[0];
    } else {
        citeText = authors[0] + " et al.";
    };

    if(format=='p'){
        citeText = `(${citeText}, ${year})`;
    }else{
        citeText += ` (${year})`;
    }

    span.text(citeText);
    span.attr('href', href);
}

refEq = function(span, tro){
    num = tro.find('.num')[0];
    citeText = `(${$(num).text()})`;
    href = '#'+tro.attr('id');
    span.text(citeText);
    span.attr('href', href);

}

refEnv = function(span, tro, env){
    format = span.attr('format') || ""
    num = tro.find('.num')[0] || "";
    href = '#'+tro.attr('id');
    if(format=='fancy'){
        citeText = `${env} ${$(num).text()}`;
    } else {
    citeText = `${$(num).text()}`;
    };
    span.text(citeText);
    span.attr('href', href);
    span.removeClass('pop_anchor') // just for now

}

refText = function(span, tro, text){
    href = '#'+tro.attr('id');
    span.text(text);
    span.attr('href', href);
}

refError = function(span){
    span.text("[Reference Not Found]");
}

refSec = function(span, tro){
    return refEnv(span, tro, 'Section')
}

refTheorem = function(span, tro){
    return refEnv(span, tro, 'Theorem')
}

refSelf = function(span){
    text = span.attr('text');
    span.text(text);
}


ref_spec = {
    'cite': refCite,
    'eq': refEq,
    'sec': refSec,
    'theorem': refTheorem,
    'text': refText,
    '_self_': refSelf,
    'error': refError,
};

/// THIS IS REPATED FROM THE BIB.JS, we should make it more efficent 
renderBibLocal = function(data){
    //$('#para_holder').empty();
    data.map(createBibEntry)
    //sortCite('#para_holder')
}

createBibEntry = function(cite){

$('#'+cite['citekey']).remove();

yr = cite['year'] ? ` ${cite['year']}. ` : "";
vol = cite['volume'] ? `, ${cite['volume']}` : "";
num = cite['number'] ? `, no. ${cite['number']}` : "";
pgs = cite['pages'] ? `, pp. ${cite['pages']}` : "";
title = cite['title'] ? `${cite['title']}` : "";
pubs = ['book', 'incollection'];
jns = ['article', 'techreport', 'unpublished']

if(pubs.includes(cite['entry_type'])){
    pub = cite['publisher'] || "";
    journal = (cite['booktitle']) ? `In ${cite['booktitle']}`: "";
}else if (jns.includes(cite['entry_type'])) {
    pub = ""
    journal = cite['journal'] || 'mimeo';
}

author = `<b>${cite['author']}</b>. ` || "";
index = (vol || num || pgs) ? `${vol + num + pgs}.` : "";

var author_list = cite['author'].split(" and ").map(auth => auth.split(',')[0]);

c = `<div class=cite id=${cite['citekey']} citeType=cite authors="${author_list}" year="${cite['year']}">
<span class=citeText>
    ${author}${yr}${title}. <em>${journal}</em>${index} ${pub} 
</span>
<span class=citekey>${cite['citekey']}</span>
</div>`;

$('#bib_block').append(c);
}


//// POPUP FUNCTIONALITY

$(document).on({
    mouseenter: function(){
        html = popText($(this)) || "";
        createPop(html)
    },
    mouseleave: function(){
        $('#pop').remove();
    }
}, ".pop_anchor");

createPop = function(html=""){
    pop = $("<div>", {id: "pop"})
        $('#bg').append(pop)
        pop.html(html);
        h = pop.height();
        w = pop.width();
        $(this).mousemove(function(event){
          pop.css({
            'left': (event.pageX - .5*w - 10) + 'px', //offset 10px for padding
            'top': (event.pageY - h - 35) + 'px', //offset up by 35 px
            });  
        })
    };

popText = function(anchor){
    key = anchor.attr('citekey');
    if(key == '_self_'){
        tro = anchor;
        citeType = '_self_'
    } else {
        tro = $('#'+key) || ""; //the referenced object
        citeType = tro.attr('citeType') || tro.attr('env') || '';
    };
        if (citeType in pop_spec){
            return pop_spec[citeType](tro)
        }else {
            return pop_spec['error']();
        };
};

popError = function(){
    return "[Reference Not Found]";
}

popSec = function(tro){
    return tro.text();
}

popEq = function(tro){
    return tro.find('.equation').html();
}

popCite = function(tro){
    html = tro.find('.citeText').html();
    return html
}

popSelf = function(tro){
    return tro.attr('poptext');
}


pop_spec = {
    'sec': popSec,
    'cite': popCite,
    'eq': popEq,
    'footnote': popSelf,
    '_self_': popSelf,
    'error': popError,
};

