var in_title = title;

createTex = function() {
    keys = getBibRefs();
    var output = [];
    $('.para').each(function() {
        raw = $(this).attr('raw');
        markout = markthree(raw, {renderer: new markthree.texRenderer});
        if (markout.env) {
            tex = texEnv(markout);
        } else {
            tex = markout.src;
        }
        tex = replaceCites(keys, tex)
        output.push(tex);
    });


    var dict = {
        'paras': output,
        'keys': keys,
        'in_title': in_title,
        'title': title,
    };
    return dict;
};

getBibRefs = function(){
    var citeKeys = [];
    $('.cite').each(function() {
        citeKeys.push($(this).attr('id'));
    });
    return citeKeys
};

replaceCites = function(keys, text){
    let ref = /\\(c)?ref\{([\w-:]+)\}/g;
    text = text.replaceAll(ref, function(m, p1, p2){
        if (keys.includes(p2)) {
            return `\\cite{${p2}}`;
        } else {
            return m;
        };
    });
    return text;
};

var current_tex_env = null;

// create tex envs
texEnv = function(m) {
    var env = m.env;
    var spec = env.env;
    if (env.type == 'env_end') {
        cte = current_tex_env;
        current_tex_env = null;
        return tex_spec.end(m.src, cte);
    }
    if (spec in tex_spec) {
        return tex_spec[spec](m.src, env);
    } else {
        return tex_spec.error(m.src, env);
    }
};

texSection = function(src, env) {
    var args = env.args;
    var times = Math.min(2, args.level - 1); // how many subs in subsubsection
    var sub = (times > 0) ? 'sub'.repeat(times) : '';
    var label = (args.id) ? `\\label{${args.id}}` : '';
    var num = (args.number) ? '' : '*';
    var out = `\\${sub}section${num}{${src}}${label}`;
    return out;
};

texEquation = function(src, env) {
    var args = env.args;
    var label = (args.id) ? `\\label{${args.id}}` : '';
    var num = (args.number) ? '' : '*';
    var out = `\\begin{equation${num}}${src}${label}\\end{equation${num}}`;
    return out;
};

texTheorem = function(src, env) {
    var args = env.args;
    var num = (args.number) ? '' : '*';
    var name = (args.name) ? `[${args.name}]` : '';
    var label = (args.id) ? `\\label{${args.id}}` : '';
    current_tex_env = `theorem${num}`;
    var out = `\\begin{${current_tex_env}}${name}${label} \n ${src}`;
    return out;
};

texTitle = function(src, env) {
    in_title = src;
    return '';
};

texEndEnv = function(src, env) {
    if (env !== null) {
        out = `${src} \n \\end{${env}}`;
        return out;
    } else {
        return `\\hl{ERROR} no enviorment to end`;
    }
};

texError = function(src, env) {
    return `\\hl{ERROR} enviorment \`${env.env}' not defined`;
}

var tex_spec = {
    'theorem': texTheorem,
    'heading': texSection,
    'equation': texEquation,
    'error': texError,
    'title': texTitle,
    'end': texEndEnv,
};

/// export methods

export_markdown = function() {
    window.location.replace(`/em/${title}`);
};

export_tex = function() {
    var dict = createTex();
    var data = JSON.stringify(dict);
    export_download('/et', 'data', data);
    //console.log(data)
};

export_download = function(url, key, data) {
    // build a form
    var form = $('<form></form>').attr('action', url).attr('method', 'post');
    // add the one key/value
    form.append($('<input></input>').attr('type', 'hidden').attr('name', key).attr('value', data));
    // send request
    form.appendTo('body').submit().remove();
};

// box

var exportbox = false;

$(document).ready(function() {
    toggleBox(exportbox, '#export', '#export_options');
    $('#export_tex').click(export_tex);
    $('#export_md').click(export_markdown);
});
