/* exporting functionality */

export { initExport, createMarkdown, createLatex, exportMarkdown, exportLatex }

import { mapObject, eachObject, attrArray, initToggleBox } from './utils.js'
import { config, state, cache } from './state.js'
import { markthree } from './marked3.js'
import { s_env_spec } from './render.js'
import { htmlTemplate, latexTemplate } from './template.js'
import { parseSVG } from './svg.js'
import * as zip from '@zip.js/zip.js'

// image extensions
let imgext = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/svg+xml': 'svg',
    'image/gif': 'gif',
}

// persistent tracking
let title;
let images;
let cites;

// get text

function getParaArray() {
    return attrArray($('.para:not(.folder)'), 'raw');
}

// markdown export

async function mdEnv(raw, env) {
    if (env.env == 'title') {
        title = raw;
    } else if (env.env == 'imagelocal') {
        let args = env.args;
        let image = args.image || args.img;
        if (image != null) {
            let img = cache.img.get(image);
            if (img == null) {
                return raw;
            } else  if (img.mime == 'image/svg+gum') {
                return `!gum\n${img.data.trim()}`;
            } else {
                let blob = img.data;
                let ext = imgext[blob.type];
                let fname = `${image}.${ext}`;
                let data = await blob.arrayBuffer();
                images.push([fname, blob.type, data]);

                let sargs = Object.entries(args)
                    .filter(([k,v]) => k != 'image' && k != 'img')
                    .map(([k,v]) => `${k}=${v}`).join('|');
                return `! [${sargs}] (${fname})`;
            }
        }
    }
    return raw;
}

async function createMarkdown(paras) {
    paras = paras ?? getParaArray();

    title = config.title;
    images = [];

    let mds = [];
    for (let raw of paras) {
        let markout = markthree(raw, 'html'); // this is inefficient
        let md;
        if (markout.env != null) {
            md = await mdEnv(raw, markout.env);
        } else {
            md = raw;
        }
        md = md.replace(/\n\s*\n/g, '\n');
        mds.push(md);
    }
    let text = mds.join('\n\n');
    let name = urlify(title ?? '');

    return {
        name: name,
        data: text,
        imgs: images,
    };
}

// latex export

async function createLatex(paras) {
    paras = paras ?? getParaArray();

    title = config.title;
    images = [];
    cites = [];

    let texs = [];
    for (let raw of paras) {
        let markout = markthree(raw, 'latex');
        let tex = markout.env ? await texEnv(markout) : markout.src;
        tex = replaceCites(tex);
        tex = replaceQuotes(tex);
        texs.push(tex);
    }

    let rawBibTex = null;
    if (cites.length > 0) {
        let usedCites = await cache.cite.many(cites);
        rawBibTex = Object.values(usedCites).map(bib => bib.raw).join('\n');
    }

    let itypes = [...new Set(images.map(([n, t, d]) => t))];

    let name = urlify(title ?? '');
    let now = new Date();
    let macros = texMacros(state.macros ?? {});
    let text = latexTemplate({
        title: title ?? 'Untitled',
        date: now.toDateString(),
        macros: macros,
        envs: sEnv(s_env_spec),
        bib: rawBibTex,
        img: itypes,
        body: texs.join('\n\n'),
    });

    return {
        name: name,
        data: text,
        imgs: images,
    }
}

async function createZip(blobs) {
    let bwrite = new zip.BlobWriter('application/zip');
    let zwrite = new zip.ZipWriter(bwrite);

    for (let [k, v] of blobs) {
        let r = new zip.BlobReader(v);
        await zwrite.add(k, r);
    }

    await zwrite.close();
    let zblob = await bwrite.getData();

    return zblob;
}

async function createMdZip() {
    let {name, data, imgs} = await createMarkdown();
    imgs.push([`${name}.md`, 'text/markdown', data]);
    let blobs = imgs.map(([n, t, d]) => [n, new Blob([d], {type: t})]);
    let zblob = await createZip(blobs);
    return {
        name: name,
        data: zblob,
    };
}

async function createTexZip() {
    let {name, data, imgs} = await createLatex();
    imgs.push([`${name}.tex`, 'application/x-latex', data]);
    let blobs = imgs.map(([n, t, d]) => [n, new Blob([d], {type: t})]);
    let zblob = await createZip(blobs);
    return {
        name: name,
        data: zblob,
    };
}

function replaceCites(text) {
    let ref = /\\(c)?ref\{([\w-:]+)\}/g;
    text = text.replaceAll(ref, function(m, p1, p2) {
        if (cache.cite.has(p2)) {
            cites.push(p2);
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
    return text.replace(/"([^"\n]+)"/g, "``$1''");
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
    return `\\${sub}section${num}{${src}}${label}`;
}

function texEquation(src, env) {
    let args = env.args;
    let label = (args.id) ? `\\label{${args.id}}` : '';
    let num = (args.number) ? '' : '*';
    let eqenv = args.multiline ? 'align' : 'equation';
    return `\\begin{${eqenv}${num}}\n${src}\n${label}\\end{${eqenv}${num}}`;
}

function texImage(src, env) {
    let args = env.args;
    let caption = args.caption ?? '';
    return `\\begin{figure}[h]\n\\begin{center}\n${src}\n\\caption{${caption}}\n\\end{center}\n\\end{figure}`;
}

async function texImageLocal(src, env) {
    let args = env.args;
    let image = args.image || args.img;
    if (image == null) return;

    let width = args.width || args.w;
    let opts = width ? `[width=${width/100}\\textwidth]` : '';
    let cap = (args.caption == 'none') ? null : args.caption;
    let caption = (cap != null) ? `\\caption{${cap}}\n` : '';

    let img = await cache.img.get(image);
    let itex;
    if (img != null) {
        let { mime, data } = img;
        let ext = imgext[mime];
        let fname = `${image}.${ext}`;
        data = (typeof data == 'Blob') ? await data.arrayBuffer() : data;
        images.push([fname, mime, data]);
        itex = `\\includegraphics${opts}{${fname}}`;
    } else {
        itex = `[Image \\texttt{${image}} not found]`;
    }

    return `\\begin{figure}[h]\n\\begin{center}\n${itex}\n\\end{center}\n${caption}\\end{figure}`;
}

function texSvg(src, env) {
    let args = env.args;
    let inum = images.length;
    let name = args.id ?? `image_${inum}`;
    let size = args.pixels ? parseInt(args.pixels) : null;

    let fname = `${name}.svg`;
    let svg = parseSVG(args.mime, args.svg, size);
    if (svg.success) {
        images.push([fname, 'image/svg+xml', svg.svg]);
    }

    let width = args.width || args.w;
    let opts = width ? `[width=${width/100}\\textwidth]` : '';
    let cap = (args.caption == 'none') ? null : args.caption;
    let caption = (cap != null) ? `\\caption{${cap}}\n` : '';

    return `\\begin{figure}[h]\n\\begin{center}\n\\includesvg${opts}{${name}}\n\\end{center}\n${caption}\\end{figure}`;
}

function texCode(src, env) {
    return `\\begin{blockcode}\n${src}\n\\end{blockcode}`;
}

function texTable(src, env) {
    let args = env.args;
    let cap = (args.caption == 'none') ? null : args.caption;
    let caption = (cap != null) ? `\\caption{${cap}}\n` : '';
    return `\\begin{table}\n${caption}${src}\n\\end{table}`;
}

function texTheorem(src, env) {
    let args = env.args;
    let num = (args.number) ? '' : '*';
    let name = (args.name) ? `[${args.name}]` : '';
    let label = (args.id) ? `\\label{${args.id}}` : '';
    let close = env.single ? `\n\\end{${env.env}}` : ""
    current_tex_env = `${env.env}${num}`;
    return `\\begin{${current_tex_env}}${name}${label} \n ${src}${close}`;
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
    code: texCode,
    table: texTable,
    error: texError,
    title: texTitle,
    end: texEndEnv,
};

function texMacros(macros_dict) {
    let macout = '';
    for (const [key, value] of Object.entries(macros_dict)) {
        let args = value.match(/(?<!\\)\#([0-9]+)/g) ?? [];
        let nargs = Math.max(0, ...args.map(x => parseInt(x.slice(1))));

        let argstr = '';
        for (const x of Array(nargs).keys()) {
            argstr += `#${x+1}`;
        }

        macout += `\\def${key}${argstr}{${value}}\n`;
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
    createMarkdown().then(ret => {
        let blob = new Blob([ret.data], {type: 'text/markdown'});
        downloadFile(`${ret.name}.md`, blob);
    });
}

function exportLatex() {
    createLatex().then(ret => {
        let blob = new Blob([ret.data], {type: 'text/tex'});
        downloadFile(`${ret.name}.tex`, blob);
    });
}

function exportMdZip() {
    createMdZip().then(ret => {
        downloadFile(`${ret.name}.zip`, ret.data);
    });
}

function exportTexZip() {
    createTexZip().then(ret => {
        downloadFile(`${ret.name}.zip`, ret.data);
    });
}

function exportHtml() {
    let {name, data} = createHtml();
    let blob = new Blob([data], {type: 'text/html'});
    downloadFile(`${name}.html`, blob);
}

// toggle box

function initExport() {
    let ebox = $('#export_options');
    initToggleBox('#export', ebox);

    $('#export_textxt').click(function() {
        ebox.hide();
        exportLatex();
    });

    $('#export_texzip').click(function() {
        ebox.hide();
        exportTexZip();
    });

    $('#export_mdtxt').click(function() {
        ebox.hide();
        exportMarkdown();
    });

    $('#export_mdzip').click(function() {
        ebox.hide();
        exportMdZip();
    });
}
