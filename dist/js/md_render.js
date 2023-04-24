/**
 *
 * a markdown+ syntax tree renderer
 *
 */

/*

import { escape_html, escape_latex, special } from './md_parse.js';

class DivRenderer {
    constructor(options) {
        this.options = options ?? {};
    }

    empty(text) {
        return `<div class="empty">\n${text}\n</div>\n\n`;
    }

    comment(text) {
        text = escape_html(text);
        return `<div class="comment">${text}</div>\n\n`;
    }

    in_comment(text) {
        return '';
    }

    code(code, ln) {
        let numbered = ln ? 'numbered' : '';
        code = escape_html(code)
        return `<div class="code ${numbered}" rawCode="${code}"></div>\n\n`;
    }

    blockquote(quote) {
        return `<div class="quote">\n${quote}\n</div>\n\n`;
    }

    html(html) {
        return html;
    }

    title(text) {
        return `<div class="title">${text}</div>\n\n`;
    }

    heading(text) {
        return text;
    }

    svg() {
        return `<div class="fig_cont"></div>`;
    }

    envbeg(text) {
        return text;
    }

    envend(text) {
        return text;
    }

    hr() {
        return '<hr>\n\n';
    }

    list(body, ordered) {
        let type = ordered ? 'ordered' : 'unordered';
        return `<div class="list ${type}">\n${body}</div>\n\n`;
    }

    listitem(text) {
        return `<div class="list-item">${text}</div>\n`;
    }

    paragraph(text) {
        return `<div class="p">${text}</div>\n\n`;
    }

    table(header, body, align) {
        return `<div class="table">\n<div class="table-header">\n${header}</div>\n<div class="table-body">\n${body}</div>\n</div>\n\n`;
    }

    tablerow(content) {
        let row = content.join('');
        return `<div class="table-row">${row}</div>\n`;
    }

    tablecell(content, align, header) {
        let aclass = (align != null) ? ` table-cell-${align}` : '';
        return `<div class="table-cell${aclass}">${content}</div>`;
    }

    strong(text) {
        return `<span class="strong">${text}</span>`;
    }

    hash(text) {
        let sfx = text.replaceAll(' ', '+')
        let url = window.location.origin + '/t/' + sfx;
        return `<a href=${url} class="hash">${text}</a>`;
    }

    em(text) {
        return `<span class="em">${text}</span>`;
    }

    codespan(text) {
        text = escape_html(text, true);
        return `<span class="code">${text}</span>`;
    }

    br() {
        return '<br>';
    }

    del(text) {
        return `<span class="del">${text}</span>`;
    }

    link(href, title, text) {
        title = title ? `title="${title}"` : '';
        return `<a target="_blank" href="${href}" ${title}>${text}</a>`;

    }

    escape(esc) {
        return escape_html(esc);
    }

    special(acc, letter) {
        return special(acc, letter);
    }

    text(text) {
        return escape_html(text);
    }

    math(tex) {
        return `<span class="latex">${tex}</span>`;
    }

    equation(tex, multi) {
        if (multi) {
            tex = `\\begin{aligned}\n${tex}\\end{aligned}`;
        }
        return `<div class="latex">${tex}</div>\n\n`;
    }

    ref(args, text) {
        const id = args.id || '';
        const ext = id.includes(':');
        const targ = ext ? `target="_blank"` : ""
        const type = ext ? 'ext' : 'int';
        const format = args.format || args.fmt || args.f || '';
        const pclass = (args.popup != 'false') ? 'pop_anchor': '';
        const dtext = text ? ` data-text="${escape_html(text)}"` : '';
        const [art, key] = id.split(':');
        const href = ext ? `${window.location.origin}/a/${art}\#${key}` : `\#${id}`;
        return `<a ${targ} href="${href}" class="reference ${pclass}" refkey="${id}" reftype="${type}" format="${format}" ${dtext}></a>`;
    }

    cite(args, text) {
        const id = args.id || '';
        const format = args.format || args.fmt || args.f || '';
        const pclass = (args.popup != 'false') ? 'pop_anchor': '';
        const dtext = text ? ` data-text="${escape_html(text)}"` : '';
        return `<a target="_blank" href="" class="reference ${pclass}" refkey="${id}" reftype="cite" format="${format}" ${dtext}></a>`;
    }

    ilink(args, text) {
        const id = args.id ?? '';
        const pclass = (args.popup != 'false') ? 'pop_anchor': '';
        const dtext = text ? ` data-text="${escape_html(text)}"` : '';
        return `<a target="_blank" class="reference ${pclass}" href="${id}" refkey="${id}" ${dtext} reftype="link"></a>`;
    }

    footnote(text) {
        return `<span class="footnote pop_anchor" reftype="self"><span class="num" counter="footnote" inc="1"></span><span class="ft_content">${text}</span></span>`;
    }

    sidenote(text) {
        return `<span class="sidenote pop_anchor" reftype="self"><span class=sn_skinny>*</span><span class="ft_content">${text}</span></span>`;
        //return `<div class="sidenote">${text}</div>`;
    }

    image(href, yt=false) {
        if(yt){
            return `<div class="fig_cont">
                <iframe width="560" height="315" src="${href}"
             frameborder="0" allowfullscreen></iframe></div>`;
        }
        return `<div class="fig_cont"><img src="${href}" /></div>`;
    }

    imagelocal() {
        return `<div class="fig_cont"><img /></div>`;
    }

    upload(args, gum) {
        const img = args.image || args.img || args.id;
        const key = img ? `key="${img}"`: '';
        if(gum){
            return `<div ${key} class="open_svg_editor">Click to Open gum.js Editor</div>`;
        }else{
            return `<div ${key} class="dropzone">Drop Image or Click to Upload</div>`;
        };
    }

    biblio(id, info) {
        let keys = '';
        let k;
        for (k in info) {
            let v = info[k];
            keys += ` ${k}="${v}"`;
        }
        return `<div class="biblio" id="${id}" ${keys}></div>\n`;
    }
}

class TexRenderer {
    constructor(options) {
        this.options = options ?? {};
    }

    empty(text) {
        return  `% ${text}`;
    }

    comment(text) {
        return `% ${text}`;
    }

    in_comment(text) {
        return `% ${text}`;
    }

    code(code) {
        return code;
    }

    blockquote(quote) {
        return `\\verb\`${quote}\``;
    }

    html(html) {
        return `\\verb\`${html}\``;
    }

    title(title) {
        return title;
    }

    heading(text) {
        return text;
    }

    svg(svg) {
        return '';
    }

    special(acc,letter) {
        return `\\${acc}{${letter}}`
    }

    envbeg(text) {
        return text;
    }

    envend(text) {
        return text;
    }

    hr() {
        return `\\rule{\\textwidth}{0.4pt}`;
    }

    list(body, ordered) {
        let type = ordered ? 'enumerate' : 'itemize';
        return `\\begin{${type}}\n${body}\n\\end{${type}}`;
    }

    listitem(text) {
        return `\\item ${text}\n`;
    }

    paragraph(text) {
        return `${text}`;
    }

    table(header, body, align) {
        let atext = align.map(a => (a != null) ? a[0] : 'l').join('');
        return `\\begin{tabular}{${atext}}\n${header}\n\\hline\n${body}\\end{tabular}`;
    }

    tablerow(content) {
        let row = content.join(' & ');
        return `${row} \\\\`;
    }

    tablecell(content, align, header) {
        if (header ?? false) {
            return `\\textbf{${content}}`;
        } else {
            return content;
        }
    }

    strong(text) {
        return `\\textbf{${text}}`;
    }

    em(text) {
        return `\\textit{${text}}`;
    }

    comment(comment) {
        return comment;
    }

    codespan(code) {
        return `\\cverb\`${code}\``;
    }

    br() {
        return ` \\\\\n`;
    }

    del(text) {
      return `\\sout{${text}}`;
    }

    link(href, title, text) {
        href = escape_latex(href);
        return `\\href{${href}}{${text}}`;
    }

    ilink(args, text) {
        let id = escape_latex(args.id ?? '');
        let name = text || id;
        return `\\href{${window.location.origin}/r/${id}}{${name}}`;
    }

    image(href) {
        href = escape_latex(href);
        return `\\href{${href}}{${href}}`;
    }

    imagelocal(key) {
        return '';
    }

    escape(esc) {
        return escape_latex(esc);
    }

    text(text) {
        return escape_latex(text);
    }

    math(tex) {
        return `$${tex}$`;
    }

    equation(tex, multi) {
        return tex;
    }

    ref(args) {
        let id = args['id'];
        let ext = id.includes(':');
        let format = args['format'] || args['fmt'] || args['f'] || '';
        let c = (format == 'plain') ? '': 'c';
        let text = args['text'] || args['txt'] || args['t'];
        let pclass = (args['popup'] != 'false') ? 'pop_anchor': '';
        if (ext) {
            let inner = (text) ? text : `<!!<${id}>!!>`;
            let [art, key] = id.split(':');
            return `\\href{${window.location.origin}/r/${art}\\\#${key}}{${inner}}`;
        } else if (text) {
            return `\\hyperref[${id}]{${text}}`;
        } else {
            return `\\${c}ref{${id}}`;
        }
    }

    cite(args) {
        let id = args['id'];
        let ext = id.includes(':');
        let format = args['format'] || args['fmt'] || args['f'] || '';
        let c = (format == 'plain') ? '': 'c';
        let text = args['text'] || args['txt'] || args['t'];
        let pclass = (args['popup'] != 'false') ? 'pop_anchor': '';
        if(ext) {
            let inner = (text) ? text : `<!!<${id}>!!>`;
            let [art, key] = id.split(':');
            return `\\href{${window.location.origin}/r/${art}\\\#${key}}{${inner}}`;
        } else if (text) {
            return `\\hyperref[${id}]{${text}}`;
        } else {
            return `\\${c}ref{${id}}`;
        }
    }

    footnote(text) {
        return `\\footnote{${text}}`;
    }

    sidenote(text) {
        return `\\footnote{${text}}`;
    }
}

*/
