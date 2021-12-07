    /* exporting functionality */

export { initExport, exportMarkdown, exportLatex }

import { mapObject, eachObject, initToggleBox } from './utils.js'
import { config, state, cache } from './state.js'
import { markthree } from './marked3.js'
import { s_env_spec } from './render.js'
import { latexTemplate } from './template.js'
import * as zip from '../zip.js/lib/zip.js'

// image extensions
let imgext = {
    'image/png': 'png',
}

// markdown export

function createMd() {
    let name = urlify(config.title);

    let paras = [];
    $('.para:not(.folder)').each(function() {
        let raw = $(this).attr('raw');
        paras.push(raw);
    });
    let text = paras.join('\n\n');

    return {
        name: name,
        data: text,
    };
}

// latex export

let title;
let images;

function createTex() {
    let name = urlify(config.title);

    title = config.title;
    images = [];

    let bibKeys = cache.cite.keys()
    let rawBibTex = cache.cite.values().map(bib => bib.raw).join('\n');
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
        tex = replaceCites(bibKeys, tex);
        tex = replaceQuotes(tex);
        paras.push(tex);
    });

    let now = new Date();
    let tVars = {
        title: title,
        date: now.toDateString(),
        macros: texMacros(state.macros),
        envs: sEnv(s_env_spec),
        bib: rawBibTex,
        body: paras.join('\n\n'),
    };
    let text = latexTemplate(tVars);

    return {
        name: name,
        data: text,
    }
}

async function createZip() {
    let {name, data} = createTex();
    let tname = `${name}.tex`;

    let bwrite = new zip.BlobWriter('application/zip');
    let zwrite = new zip.ZipWriter(bwrite);
    let ftex = new zip.TextReader(data);
    await zwrite.add(tname, ftex);

    let imgs = cache.img.many(images);
    for (let [k, v] of Object.entries(imgs)) {
        let r = new zip.BlobReader(v.data);
        let e = imgext[v.mime];
        let n = (e != null) ? `${k}.${e}` : k;
        await zwrite.add(n, r);
    }

    await zwrite.close();
    let blob = await bwrite.getData();

    return {
        name: name,
        data: blob,
    }
}

function replaceCites(keys, text) {
    let ref = /\\(c)?ref\{([\w-:]+)\}/g;
    text = text.replaceAll(ref, function(m, p1, p2) {
        if (keys.includes(p2)) {
            return `\\citet{${p2}}`;
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

function replaceQuotes(text) {
    text = text.replace(/"([^"\n]+)"/g, "``$1''");
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
        return texTheorem(m.src, env);
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
    let eqenv = args.multiline ? 'align' : 'equation';
    let out = `\\begin{${eqenv}${num}}\n${src}\n${label}\\end{${eqenv}${num}}`;
    return out;
}

function texImage(src, env) {
    let args = env.args;
    let caption = args.caption ?? '';
    let out = `\\begin{figure}\n${src}\n\\caption{${caption}}\n\\end{figure}`;
    return out;
}

function texImageLocal(src, env) {
    let args = env.args;
    let image = (args.image || args.img) ?? '';
    let width = args.width || args.w;
    let opts = width ? `[width=${width/100}\\textwidth]` : '';
    let cap = (args.caption == 'none') ? null : args.caption;
    let caption = (cap != null) ? `\\caption{${cap}}\n` : '';
    let out = `\\begin{figure}\n\\includegraphics${opts}{${image}}\n${caption}\\end{figure}`;
    images.push(image);
    return out;
}

function texSvg(src, env) {
    let out = '[SVG export is a to-do, sorry]';
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
        return `\\hl{ERROR} no environment to end`;
    }
}

function texError(src, env) {
    return `\\hl{ERROR} environment \`${env.env}' not defined`;
}

let tex_spec = {
    theorem: texTheorem,
    heading: texSection,
    equation: texEquation,
    image: texImage,
    imagelocal: texImageLocal,
    svg: texSvg,
    error: texError,
    title: texTitle,
    end: texEndEnv,
};

function texMacros(macros_dict) {
    let macout = '';
    for (const [key, value] of Object.entries(macros_dict)) {
        const num = (value.match(/(?<!\\)\#[0-9]+/g)||[]).length;
        let argnum = '';
        for (const x of Array(num).keys()) {
            argnum += `#${x+1}`;
        }
        macout += `\\def${key}${argnum}{${value}}\n`;
    }
    return macout;
}

function sEnv(s_env_spec) {
    let envout = '';
    for (const [key, value] of Object.entries(s_env_spec)) {
        if (key != 'proof') {
            let nonum = `\\newtheorem{${key}}{${value.head}}`;
            let num = `\\newtheorem*{${key}*}{${value.head}}`;
            envout += `${num}\n${nonum}\n`;
        }
    }
    return envout;
}

// export methods

function urlify(s) {
    return s.replace(/\W/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_|_$/g, '')
            .toLowerCase();
}

function downloadFile(name, blob) {
    let element = document.createElement('a');
    let url = URL.createObjectURL(blob);
    element.setAttribute('href', url);
    element.setAttribute('download', `${name}`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function exportMarkdown() {
    let {name, data} = createMd();
    let blob = new Blob([data], {type: 'text/markdown'});
    downloadFile(`${name}.md`, blob);
}

function exportLatex() {
    let {name, data} = createTex();
    let blob = new Blob([data], {type: 'text/tex'});
    downloadFile(`${name}.tex`, blob);
}

function exportZip() {
    createZip().then(ret => {
        downloadFile(`${ret.name}.zip`, ret.data);
    });
}

// toggle box

function initExport() {
    let ebox = $('#export_options');
    initToggleBox('#export', ebox);

    $('#export_tex').click(function() {
        ebox.hide();
        exportLatex();
    });

    $('#export_zip').click(function() {
        ebox.hide();
        exportZip();
    });

    $('#export_md').click(function() {
        ebox.hide();
        exportMarkdown()
    });
}
