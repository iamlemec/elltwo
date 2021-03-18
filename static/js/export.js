var in_title = title

createTex = function(){
output = []

    $('.para').each( function(){
        raw = $(this).attr('raw');
        markout = markthree(raw, {renderer: new markthree.texRenderer})
    
        if(markout.env){
            tex = texEnv(markout)
        } else{
            tex = markout.src
        }
                output.push(tex);
        });

    dict = {
        'paras': output,
        'in_title': in_title,
        'title': title,
    }

return dict;
};

current_tex_env = null;

//create tex envs
texEnv = function(m){
    env = m.env
    spec = env.env
    if(env.type == 'env_end'){
        return tex_spec.end(m.src, current_tex_env)
    }
    if(spec in tex_spec){
        return tex_spec[spec](m.src, env)
    } else {
        return tex_spec.error(m.src, env)
    }
}


texSection = function(src, env){
    args = env.args
    times = Math.min(2, args.level - 1); //how many subs in subsubsection
    sub = (times > 0) ? 'sub'.repeat(times) : "";
    label = (args.id) ? `\\label{${args.id}}` : '';
    num = (args.number) ? '' : '*';
    out = `\\${sub}section${num}{${src}}${label}`
    return out
}

texEquation = function(src, env){
    args = env.args
    label = (args.id) ? `\\label{${args.id}}` : '';
    num = (args.number) ? '' : '*';
        out = `\\begin{equation${num}}${src}${label}\\end{equation${num}}`
    return out
}

texTheorem = function(src, env){
    args = env.args
    num = (args.number) ? '' : '*';
    name = (args.name) ? `[${args.name}]` : '';
    label = (args.id) ? `\\label{${args.id}}` : '';
    current_tex_env = `theorem${num}`
    out = `\\begin{${current_tex_env}}${name}${label} \n ${src}`
    return out
}

texTitle = function(src, env){
    in_title = src;
    return ""
}

texEndEnv = function(src, current_tex_env){
    if(current_tex_env){
        out = `${src} \n \\end{${current_tex_env}}`;
        current_tex_env = null;
        return out
    } else {
        return `\\hl{ERROR} no enviorment to end`
    }
}

texError = function(src, env){
    return `\\hl{ERROR} enviorment '${env.env}' not defined`
}

tex_spec = {
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
}

export_tex = function(){
    
    dict = createTex()

    data = JSON.stringify(dict)
    export_download('/et', 'data', data)
}

export_download = function(url, key, data){
    // Build a form
    var form = $('<form></form>').attr('action', url).attr('method', 'post');
    // Add the one key/value
    form.append($("<input></input>").attr('type', 'hidden').attr('name', key).attr('value', data));
    //send request
    form.appendTo('body').submit().remove();
};

// box

var exportbox = false


$(document).ready(function() {
    toggleBox(exportbox, '#export', '#export_options')
    $('#export_tex').click(export_tex);
    $('#export_md').click(export_markdown);
});

