/* exporting functionality */

export { initExport, exportMarkdown, exportLatex }

import { initToggleBox } from './utils.js'
import { config, state } from './state.js'
import { markthree } from './marked3.js'
import { s_env_spec } from './render.js'
import { latexTemplate } from './template.js'

// markdown export

function createMd() {
    let paras = [];
    $('.para:not(.folder)').each(function() {
        let raw = $(this).attr('raw');
        paras.push(raw);
    });

    let dict = {
        'format': 'text/markdown',
        'filename': `${config.title}.md`,
        'text': paras.join('\n\n'),
    };
    return dict;
}

// latex export

let title;

function createTex() {
    title = config.title;
    let keys = getBibRefs();
    let paras = [];
    $('.para:not(.folder)').each(function() {
        let raw = $(this).attr('raw');
        let markout = markthree(raw, 'latex');
        let tex;
        if (markout.env) {
            tex = texEnv(markout);
        } else {
            tex = markout.src;
        }
        tex = replaceCites(keys, tex);
        paras.push(tex);
    });

    let tVars = {
        'title': title,
        'macros': texMacros(state.macros),
        'envs': sEnv(s_env_spec),
        'bib': keys.join('\n'),
        'body': paras.join('\n\n'),
    };
    let text = latexTemplate(tVars);

    let dict = {
        'mimetype': 'text/tex',
        'filename': `${config.title}.tex`,
        'text': text,
    }
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

// export methods

function downloadFile(mime, fname, text) {
    let element = document.createElement('a');
    let data = encodeURIComponent(text);
    element.setAttribute('href', `data:${mime};charset=utf-8,${data}`);
    element.setAttribute('download', fname);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function exportMarkdown() {
    let data = createMd();
    downloadFile(data['mimetype'], data['filename'], data['text']);
}

function exportLatex() {
    let data = createTex();
    downloadFile(data['mimetype'], data['filename'], data['text']);
}

// toggle box

function initExport() {
    let ebox = $('#export_options');
    initToggleBox('#export', ebox);

    $('#export_tex').click(function() {
        ebox.hide();
        exportLatex();
    });

    $('#export_md').click(function() {
        ebox.hide();
        exportMarkdown()
    });
}
