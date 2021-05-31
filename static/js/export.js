/* exporting functionality */

export { initExport }

import { toggleBox } from './utils.js'
import { state } from './state.js'
import { s_env_spec, macros } from './render.js'

let title;

function createTex() {
    title = state.title;
    let keys = getBibRefs();
    let output = [];
    $('.para:not(.folder)').each(function() {
        let raw = $(this).attr('raw');
        let markout = markthree(raw, {renderer: new markthree.texRenderer});
        let tex;
        if (markout.env) {
            tex = texEnv(markout);
        } else {
            tex = markout.src;
        }
        tex = replaceCites(keys, tex);
        output.push(tex);
    });

    let tex_macros = texMacros(macros);
    let s_envs = sEnv(s_env_spec);

    let dict = {
        'paras': output,
        'keys': keys,
        'title': title,
        'macros': tex_macros,
        's_envs': s_envs,
    };
    return dict;
}

function getBibRefs() {
    let citeKeys = [];
    $('.cite').each(function() {
        citeKeys.push($(this).attr('id'));
    });
    return citeKeys;
}

function replaceCites(keys, text) {
    let ref = /\\(c)?ref\{([\w-:]+)\}/g;
    text = text.replaceAll(ref, function(m, p1, p2) {
        if (keys.includes(p2)) {
            return `\\cite{${p2}}`;
        } else {
            return m;
        };
    });
    let ex_ref = /\<\!\!\<([\w\-\_\:]+)\>\!\!\>/g;
    text = text.replaceAll(ex_ref, function(m, p1) {
        return $(`[citekey='${p1}']`).first().text();
    });

    return text;
}

let current_tex_env = null;

// create tex envs
function texEnv(m) {
    let env = m.env;
    let spec = env.env;
    if (env.type == 'env_end') {
        let cte = current_tex_env;
        current_tex_env = null;
        return tex_spec.end(m.src, cte);
    }
    if (spec in tex_spec) {
        return tex_spec[spec](m.src, env);
    } else if (spec in s_env_spec) {
        return texTheorem(m.src, env)
    } else {
        return tex_spec.error(m.src, env);
    }
}

function texSection(src, env) {
    let args = env.args;
    let times = Math.min(2, args.level - 1); // how many subs in subsubsection
    let sub = (times > 0) ? 'sub'.repeat(times) : '';
    let label = (args.id) ? `\\label{${args.id}}` : '';
    let num = (args.number) ? '' : '*';
    let out = `\\${sub}section${num}{${src}}${label}`;
    return out;
}

function texEquation(src, env) {
    let args = env.args;
    let label = (args.id) ? `\\label{${args.id}}` : '';
    let num = (args.number) ? '' : '*';
    let out = `\\begin{equation${num}}${src}${label}\\end{equation${num}}`;
    return out;
}

function texTheorem(src, env) {
    let args = env.args;
    let num = (args.number) ? '' : '*';
    let name = (args.name) ? `[${args.name}]` : '';
    let label = (args.id) ? `\\label{${args.id}}` : '';
    let close = env.single ? `\n\\end{${env.env}}` : ""
    current_tex_env = `${env.env}${num}`;
    let out = `\\begin{${current_tex_env}}${name}${label} \n ${src}${close}`;
    return out;
}

function texTitle(src, env) {
    title = src;
    return '';
}

function texEndEnv(src, env) {
    if (env !== null) {
        return `${src} \n \\end{${env}}`;
    } else {
        return `\\hl{ERROR} no enviorment to end`;
    }
}

function texError(src, env) {
    return `\\hl{ERROR} enviorment \`${env.env}' not defined`;
}

let tex_spec = {
    'theorem': texTheorem,
    'heading': texSection,
    'equation': texEquation,
    'error': texError,
    'title': texTitle,
    'end': texEndEnv,
};

function texMacros(macros_dict) {
    let macout = '';
    for (const [key, value] of Object.entries(macros_dict)) {
        const num = (value.match(/(?<!\\)\#[0-9]+/g)||[]).length;
        const box = num ? `[${num}]` : "";
        macout += `\\newcommand{${key}}${box}{${value}} \n`;
    }
    return macout;
}

function sEnv(s_env_spec) {
    let envout = '';
    for (const [key, value] of Object.entries(s_env_spec)) {
        if (key!='proof') {
            let nonum = `\\newtheorem{${key}}{${value.head}}`;
            let num = `\\newtheorem*{${key}*}{${value.head}}`;
            envout += `${num}\n${nonum}\n`;
        }
    }
    return envout;
}

/// export methods

function exportMarkdown() {
    window.location.replace(`/em/${title}`);
}

function exportTex() {
    let dict = createTex();
    let data = JSON.stringify(dict);
    exportDownload('/et', 'data', data);
    //console.log(data)
}

function exportDownload(url, key, data) {
    // build a form
    let form = $('<form></form>').attr('action', url).attr('method', 'post');
    // add the one key/value
    form.append($('<input></input>').attr('type', 'hidden').attr('name', key).attr('value', data));
    // send request
    form.appendTo('body').submit().remove();
}

// box

function initExport() {
    toggleBox(false, '#export', '#export_options');
    $('#export_tex').click(exportTex);
    $('#export_md').click(exportMarkdown);
}
