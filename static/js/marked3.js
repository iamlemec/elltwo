/**
 *
 * marked3 - a markdown+ parser
 * based on marked - https://github.com/chjj/marked
 *
 */

export { markthree, replace, divInlineParser, parseArgs }

/**
 * Block Parser
 */

let block = {
    empty: /^(\s*)$/,
    comment: /^\/\/ ?/,
    hrule: /^([-*_]){3,}\s*$/,
    heading: /^(#{1,6})(\*?) *(?:refargs)? *([^\n]+?)$/,
    lheading: /^([^\n]+)\n *(=|-){2,}\s*$/,
    blockquote: /^q*> ?\n?/,
    code: /^``(\*)? *(?:refargs)?(?:\n)?(?: |\n)?/,
    equation: /^\$\$(\*&|&\*|\*|&)? *(?:refargs)?\s*/,
    title: /^#! *(?:refargs)?\s*([^\n]*)\s*/,
    upload: /^!!(gum)? *(?:refargs)?\s*$/,
    svg: /^\!(svg|gum)(\*)? *(?:refargs)?\s*/,
    image: /^!(yt|youtube)?(\*)? *(?:refargs)? *(?:\(href\))?\s*/,
    figtab: /^\| *(?:refargs)? *\n(?:table)/,
    envbeg: /^\>\>(\!)? *([\w-]+)(\*)? *(?:refargs)?\s*/,
    envend: /^\<\<\s*/,
    list: /^((?: *(?:bull) [^\n]*(?:\n|$))+)\s*$/,
    table: /^\|([^\n]+)\| *\n *\|( *[-:]+[-| :]*)\| *\n((?: *\|[^\n]*\| *(?:\n|$))*)\s*$/,
};

block._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;
block._refid = /\[([\w-]+)\]/;
block._refargs = /\[((?:(?:[^\]\[\\]|\\.)+|\[(?:[^\]\[]+)*\])*)\]/;
block._bull = /(?:[*+-]|\d+\.)/;
block._item = /^( *)(bull) ?/;

block.image = replace(block.image)
    ('refargs', block._refargs)
    ('href', block._href)
    ();

block.upload = replace(block.upload)
    ('refargs', block._refargs)
    ();

block.heading = replace(block.heading)
    ('refargs', block._refargs)
    ();

block.equation = replace(block.equation)
    ('refargs', block._refargs)
    ();

block.code = replace(block.code)
    ('refargs', block._refargs)
    ();

block.title = replace(block.title)
    ('refargs', block._refargs)
    ();

block.svg = replace(block.svg)
    ('refargs', block._refargs)
    ();

block.envbeg = replace(block.envbeg)
    ('refargs', block._refargs)
    ();

block.list = replace(block.list)
    (/bull/g, block._bull)
    ();

block.figtab = replace(block.figtab)
    ('refargs', block._refargs)
    ('table', block.table)
    ();

block._item = replace(block._item)
    ('bull', block._bull)
    ();

// Args Parser
function parseArgs(argsraw, number=true, set=true) {
    if (!(argsraw)) {
        return {
            'number': number
        };
    }

    let fst;
    let args = {};
    let rx = /[^a-zA-Z\d\_\-]/ // invalid chars for arg labels and id's

    if (!set) {
        rx = /[^a-zA-Z\d\_\-\:]/ // allow : for references
    }

    // using lookbehinds, might not work on old browsers.
    argsraw.split(/(?<!\\)\||\n/)
           .map(x => x.split(/(?<!\\)\=/))
           .filter(x => x.length > 1)
           .forEach(x => {
               let [val, ...keys] = x.reverse();
               keys.forEach(key => {
                   if (!rx.test(key)) {
                       args[key] = val;
                   }
               });
           });

    if (!('id' in args)) {
        fst = argsraw.split(/(?<!\\)\||\n/)[0];
        if (!rx.test(fst)) {
            args['id'] = fst;
        }
    } else {
        if (rx.test(args['id'])) { // cannot have chars in id
            delete args['id'];
        }
    }

    if (!('number' in args)) {
        args['number'] = number;
    }
    return args;
}

// Block Parser
class BlockParser {
    constructor(renderer, inline, options) {
        this.renderer = renderer;
        this.inline = inline;
        this.options = options || defaults;
        this.rules = block;
    }

    parseList(src) {
        let items = src
            .split('\n')
            .filter(x => x.length > 0);

        let ordered = true;
        let rows = items.map(function(item) {
            let ret = block._item.exec(item);
            ordered &&= (ret[2].length > 1);
            return item.slice(ret[0].length);
        });

        let body = rows.map(function(row) {
            let cont = this.inline.output(row);
            return this.renderer.listitem(cont);
        }, this).join('');

        return this.renderer.list(body, ordered);
    }

    parseTable(header, align, cells) {
        let i, j;

        header = header.replace(/^ *| *$/g, '').split(/ *\| */);
        align = align.replace(/^ *| *$/g, '').split(/ *\| */);
        cells = cells.replace(/^ *| *\n?$/, '').split('\n');

        align = align.map(function(al) {
            if (/^ *-+: *$/.test(al)) {
                return 'right';
            } else if (/^ *:-+: *$/.test(al)) {
                return 'center';
            } else if (/^ *:-+ *$/.test(al)) {
                return 'left';
            } else {
                return null;
            }
        });

        cells = cells.map(function(cell) {
            return cell
                .replace(/^ *\| *| *\| *$/g, '')
                .split(/ *\| */);
        });

        // head
        let head = [];
        for (i = 0; i < header.length; i++) {
            let cont = this.inline.output(header[i]);
            let cell = this.renderer.tablecell(cont, align[i], true);
            head.push(cell);
        }
        head = this.renderer.tablerow(head);

        // body
        let body = '';
        for (i = 0; i < cells.length; i++) {
            let rlist = [];
            let row = cells[i];
            for (j = 0; j < row.length; j++) {
                let cont = this.inline.output(row[j]);
                let cell = this.renderer.tablecell(cont, align[j], false);
                rlist.push(cell);
            }
            body += this.renderer.tablerow(rlist) + '\n';
        }

        return this.renderer.table(head, body, align);
    }

    parseBiblio(id, text) {
        let bib = {};
        text.split('\n').forEach(function(line) {
            if (line.includes(':')) {
                let [key, val] = line.split(':', 1);
                bib[key.trim()] = val.trim();
            }
        });
        return this.renderer.biblio(id, bib);
    }

    parseSource(src) {
        src = src
            .replace(/\r\n|\r/g, '\n')
            .replace(/\t/g, '    ')
            .replace(/\u00a0/g, ' ')
            .replace(/\u2424/g, '\n')
            .replace(/^ +$/gm, '');

        let cap;

        // empty cell (all whitespace)
        if (cap = this.rules.empty.exec(src)) {
            let text = cap[1];
            return this.renderer.empty(text);
        }

        // equation
        if (cap = this.rules.equation.exec(src)) {
            let vargs = cap[1] || '';
            let argsraw = cap[2] || '';
            let number = !vargs.includes('*');
            let multi = vargs.includes('&');
            let args = parseArgs(argsraw, number);
            args.multiline = multi;
            let text = src.slice(cap[0].length);
            this.env = {
                type: 'env_one',
                env: 'equation',
                args: args,
            }
            return this.renderer.equation(text, multi);
        }

        // svg
        if (cap = this.rules.svg.exec(src)) {
            let number = cap[2] != '*';
            let argsraw = cap[3] || '';
            let args = parseArgs(argsraw, number);
            args.mime = {svg: 'image/svg+xml', gum: 'image/svg+gum'}[cap[1]];
            args.svg = src.slice(cap[0].length);
            this.env = {
                type: 'env_one',
                env: 'svg',
                args: args,
            }
            return this.renderer.svg();
        }

        // image
        if (cap = this.rules.image.exec(src)) {
            src = src.slice(0, cap[0].length);
            let href = cap[4];
            if(href){
            let env = cap[1] || 'image'
            env = (env=='youtube')?'yt':env;
            let number = cap[2] == undefined;
            let argsraw = cap[3] || '';
            let args = parseArgs(argsraw, number);
            if(env=='yt'){
                href = href.replace('watch?v=', 'embed/');
                href = href.split('&')[0];
                args.caption = args.caption || 'none';
                args.figtype = args.figtype || 'none';
            }
            this.env = {
                type: 'env_one',
                env: env,
                args: args,
            }
            return this.renderer.image(href, env=='yt');
            } else {
                let number = cap[2] == undefined;
                let argsraw = cap[3] || '';
                let args = parseArgs(argsraw, number);
                this.env = {
                    type: 'env_one',
                    env: 'imagelocal',
                    args: args,
                }
                return this.renderer.imagelocal();
            }
        }

        // upload
        if (cap = this.rules.upload.exec(src)) {
            let gum = cap[1] != undefined;
            let argsraw = cap[2] || '';
            let args = parseArgs(argsraw);
            return this.renderer.upload(args, gum);
        }

        // figure table
        if (cap = this.rules.figtab.exec(src)) {
            let argsraw = cap[1] || '';
            let args = parseArgs(argsraw);
            this.env = {
                type: 'env_one',
                env: 'table',
                args: args,
            }
            return this.parseTable(cap[2], cap[3], cap[4]);
        }

        // comment
        if (cap = this.rules.comment.exec(src)) {
            let text = src.slice(cap[0].length);
            return this.renderer.comment(text);
        }

        // code
        if (cap = this.rules.code.exec(src)) {
            let vargs = cap[1] || '';
            let argsraw = cap[2] || '';
            let number = !vargs.includes('*');
            let args = parseArgs(argsraw);
            let text = src.slice(cap[0].length);
            this.env = {
                type: 'env_one',
                env: 'code',
                args: args,
            }
            return this.renderer.code(text, number);
        }

        // title
        if (cap = this.rules.title.exec(src)) {
            let argsraw = cap[1] || '';
            let args = parseArgs(argsraw);
            let title = this.inline.output(cap[2]);
            let text = src.slice(cap[0].length);
            let preamble = parsePreamble(text);
            this.env = {
                type: 'env_one',
                env: 'title',
                args: args,
                title: title,
                preamble: preamble,
            }
            return this.renderer.title(title);
        }

        // heading
        if (cap = this.rules.heading.exec(src)) {
            let number = (cap[2].length == 0);
            let args = parseArgs(cap[3], number=number);
            args.level = (cap[1].length);
            let text = this.inline.output(cap[4]);
            this.env = {
                type: 'env_one',
                env: 'heading',
                args: args,
            }
            return this.renderer.heading(text);
        }

        // envbeg
        if (cap = this.rules.envbeg.exec(src)) {
            let end = cap[1] != undefined;
            let number = cap[3] == undefined;
            let argsraw = cap[4] || '';
            let args = parseArgs(argsraw, number);
            let text = src.slice(cap[0].length);
            let cont = this.inline.output(text);
            let env = cap[2];
            this.env = {
                type: 'env_beg',
                single: end,
                env: env,
                args: args,
            };
            return this.renderer.envbeg(cont, args);
        }

        // envend
        if (cap = this.rules.envend.exec(src)) {
            let text = src.slice(cap[0].length);
            let cont = this.inline.output(text);
            this.env = {
                type: 'env_end',
                args: {}
            };
            return this.renderer.envend(cont);
        }

        // lheading
        if (cap = this.rules.lheading.exec(src)) {
            return {
                type: 'heading',
                depth: cap[2] === '=' ? 1 : 2,
                text: cap[1]
            };
        }

        // hrule
        if (cap = this.rules.hrule.exec(src)) {
            return this.renderer.hr();
        }

        // blockquote
        if (cap = this.rules.blockquote.exec(src)) {
            let text = src.slice(cap[0].length);
            return this.renderer.blockquote(text);
        }

        // list
        if (cap = this.rules.list.exec(src)) {
            return this.parseList(cap[1]);
        }

        // table (gfm)
        if (cap = this.rules.table.exec(src)) {
            return this.parseTable(cap[1], cap[2], cap[3]);
        }

        // top-level paragraph (fallback)
        let cont = this.inline.output(src);
        return this.renderer.paragraph(cont);
    }

    parse(src) {
        this.env = null;
        let out = this.parseSource(src);

        return {
            'src': out,
            'env': this.env
        };
    }
}

/**
 * Inline Parser
 */

let inline = {
    special: /^(?<!\\)\\([\`\"\^\~])\{([A-z])\}/,
    escape: /^\\([\\/`*{}\[\]()#+\-.!_>\$%&])/,
    in_comment: /^\/\/([^\n]*?)(?:\n|$)/,
    autolink: /^<([^ >]+:\/[^ >]+)>/,
    url: noop,
    link: /^(!?)\[(inside)\]\(href\)/,
    hash: /^#(\[[\w| ]+\]|\w+)/,
    ilink: /^\[\[([^\]]+)\]\]/,
    strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
    em: /^\b_((?:[^_]|__)+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
    code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
    br: /^ {2,}\n(?!\s*$)/,
    del: noop,
    text: /^[\s\S]+?(?=[\/\\<!\[_*`\$\^@#]| {2,}\n|$)/,
    math: /^\$((?:\\\$|[\s\S])+?)\$/,
    refcite: /^(@{1,2})\[([^\]]+)\]/,
    footnote: /^\^(\!)?\[(inside)\]/,
};

inline._inside = /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/;
inline._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;
inline._refid = /\[([\w-]+)\]/;

inline.link = replace(inline.link)
    ('inside', inline._inside)
    ('href', inline._href)
    ();

inline.footnote = replace(inline.footnote)
    ('inside', inline._inside)
    ();

// GFM Inline Grammar
inline.gfm = merge({}, inline, {
    escape: replace(inline.escape)('])', '~|])')(),
    url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
    del: /^~~(?=\S)([\s\S]*?\S)~~/,
    text: replace(inline.text)
        (']|', '~]|')
        ('|', '|https?://|')
        ()
});

// GFM + Line Breaks Inline Grammar
inline.breaks = merge({}, inline.gfm, {
    br: replace(inline.br)('{2,}', '*')(),
    text: replace(inline.gfm.text)('{2,}', '*')()
});

// parse markdown into `InlineElement`s
function parseInline(src, ctx) {
    ctx = ctx ?? {};
    let cap, mat, text, href, tex, esc, acc, letter, argsraw,
        args, inner, pre, cls, elem, text1, text2, delim;

    let out = [];
    while (src) {
        // special
        if (cap = this.rules.special.exec(src)) {
            [mat, acc, letter] = cap;
            out.push(new SpecialElement(acc, letter));
            src = src.substring(mat.length);
            continue;
        }

        // escape
        if (cap = this.rules.escape.exec(src)) {
            [mat, esc] = cap;
            out.push(new EscapeElement(esc));
            src = src.substring(mat.length);
            continue;
        }

        // math
        if (cap = this.rules.math.exec(src)) {
            [mat, tex] = cap;
            out.push(new MathElement(tex));
            src = src.substring(mat.length);
            continue;
        }

        // comment
        if (cap = this.rules.in_comment.exec(src)) {
            [mat, text] = cap;
            out.push(new CommentElement(text));
            src = src.substring(mat.length);
            continue;
        }

        // ref/cite
        if (cap = this.rules.refcite.exec(src)) {
            [mat, pre, argsraw] = cap;
            cls = (pre == '@') ? RefElement : CiteElement;
            args = parseArgs(argsraw, false, false);
            text = args.text || args.txt || args.t || '';
            inner = parseInline(text);
            out.push(new cls(inner, args));
            src = src.substring(mat.length);
            continue;
        }

        // footnote/sidenote
        if (cap = this.rules.footnote.exec(src)) {
            [mat, pre, text] = cap;
            cls = (pre == '!') ? 'sidenote' : 'footnote';
            inner = parseInline(text);
            out.push(new cls(inner));
            src = src.substring(mat.length);
            continue;
        }

        // internal link
        if (cap = this.rules.ilink.exec(src)) {
            [mat, argsraw] = cap;
            args = parseArgs(argsraw, false, false);
            text = args.text || args.txt || args.t || '';
            inner = parseInline(text);
            out.push(new InternalLinkElement(inner, args));
            src = src.substring(mat.length);
            continue;
        }

        // autolink
        if (cap = this.rules.autolink.exec(src)) {
            [mat, href] = cap;
            out.push(new LinkElement(href));
            src = src.substring(mat.length);
            continue;
        }

        // url (gfm)
        if (!ctx.inLink && (cap = this.rules.url.exec(src))) {
            [mat, href] = cap;
            out.push(new LinkElement(href));
            src = src.substring(mat.length);
            continue;
        }

        // link
        if (cap = this.rules.link.exec(src)) {
            [mat, pre, text, href, title] = cap;
            [href, title] = [escape(href), escape(title)];
            if (pre == '!') {
                elem = new ImageElement(href, text, title);
            } else {
                inner = parseInline(text, {...ctx, link: true});
                elem = new LinkElement(href, inner, title);
            }
            out.push(elem);
            src = src.substring(mat.length);
            continue;
        }

        // strong
        if (cap = this.rules.strong.exec(src)) {
            [mat, text1, text2] = cap;
            text = text1 || text2;
            inner = parseInline(text);
            out.push(new BoldElement(inner));
            src = src.substring(mat.length);
            continue;
        }

        // hash
        if (cap = this.rules.hash.exec(src)) {
            [mat, text] = cap;
            tag = text.replace('[', '').replace(']', '');
            out.push(new HashElement(tag));
            src = src.substring(mat.length);
            continue;
        }

        // em
        if (cap = this.rules.em.exec(src)) {
            [mat, text1, text2] = cap;
            text = text1 || text2;
            inner = parseInline(text);
            out.push(new ItalicElement(inner));
            src = src.substring(mat.length);
            continue;
        }

        // code
        if (cap = this.rules.code.exec(src)) {
            [mat, delim, text] = cap;
            out.push(new CodeElement(text));
            src = src.substring(mat.length);
            continue;
        }

        // br
        if (cap = this.rules.br.exec(src)) {
            out.push(new NewlineElement());
            src = src.substring(mat.length);
            continue;
        }

        // del (gfm)
        if (cap = this.rules.del.exec(src)) {
            [mat, text] = cap;
            inner = parseInline(text);
            out.push(new StrikeoutElement(inner));
            src = src.substring(mat.length);
            continue;
        }

        // text
        if (cap = this.rules.text.exec(src)) {
            out.push(new TextElement(cap));
            src = src.substring(mat.length);
            continue;
        }

        if (src) {
            throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
        }
    }

    return out;
}

/**
 * Elements
 */

class InlineElement {
    constructor() {
    }
}

class TextElement extends InlineElement {
    constructor(text) {
        super();
        this.text = text;
    }
}

class SpecialElement extends InlineElement {
    constructor(acc, letter) {
        super();
        this.acc = acc;
        this.letter = letter;
    }
}

class EscapeElement extends InlineElement {
    constructor(text) {
        super();
        this.text = text;
    }
}

class CommentElement extends InlineElement {
    constructor(text) {
        super();
        this.text = text;
    }
}

class LinkElement extends InlineElement {
    constructor(href, text, title) {
        super();
        this.href = href;
        this.text = text ?? href;
        this.title = title ?? null;
    }
}

class ImageElement extends InlineElement {
    constructor(href, title, text) {
        super();
        this.href = href;
        this.title = title;
        this.text = text;
    }
}

class BoldElement extends InlineElement {
    constructor(text) {
        super();
        this.text = text;
    }
}

class ItalicElement extends InlineElement {
    constructor(text) {
        super();
        this.text = text;
    }
}

class CodeElement extends InlineElement {
    constructor(text) {
        super();
        this.text = text;
    }
}

class DelElement extends InlineElement {
    constructor(text) {
        super();
        this.text = text;
    }
}

class RefElement extends InlineElement {
    constructor(tag) {
        super();
        this.tag = tag;
    }
}

class CiteElement extends InlineElement {
    constructor(tag) {
        super();
        this.tag = tag;
    }
}

class FootnoteElement extends InlineElement {
    constructor(text) {
        super();
        this.text = text;
    }
}

class MathElement extends InlineElement {
    constructor(tex) {
        super();
        this.tex = tex;
    }
}

class HashElement extends InlineElement {
    constructor(tag) {
        super();
        this.tag = tag;
    }
}

class NewlineElement extends InlineElement {
    constructor() {
        super();
    }
}

class StrikeoutElement extends InlineElement {
    constructor(text) {
        super();
        this.text = text;
    }
}

/**
 *  DIV Renderer
 */

class DivRenderer {
    constructor(options) {
        this.options = options ?? {};
    }

    empty(text) {
        return `<div class="empty">\n${text}\n</div>\n\n`;
    }

    comment(text) {
        text = escape(text);
        return `<div class="comment">${text}</div>\n\n`;
    }

    in_comment(text) {
        return '';
    }

    code(code, ln) {
        let numbered = ln ? 'numbered' : '';
        code = escape(code)
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
        text = escape(text, true);
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
        return escape(esc);
    }

    special(acc, letter) {
        return special(acc, letter);
    }

    text(text) {
        return escape(text);
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
        const dtext = text ? ` data-text="${escape(text)}"` : '';
        const [art, key] = id.split(':');
        const href = ext ? `${window.location.origin}/a/${art}\#${key}` : `\#${id}`;
        return `<a ${targ} href="${href}" class="reference ${pclass}" refkey="${id}" reftype="${type}" format="${format}" ${dtext}></a>`;
    }

    cite(args, text) {
        const id = args.id || '';
        const format = args.format || args.fmt || args.f || '';
        const pclass = (args.popup != 'false') ? 'pop_anchor': '';
        const dtext = text ? ` data-text="${escape(text)}"` : '';
        return `<a target="_blank" href="" class="reference ${pclass}" refkey="${id}" reftype="cite" format="${format}" ${dtext}></a>`;
    }

    ilink(args, text) {
        const id = args.id ?? '';
        const pclass = (args.popup != 'false') ? 'pop_anchor': '';
        const dtext = text ? ` data-text="${escape(text)}"` : '';
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

/**
 *  TEX Renderer
 */

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

/**
 * Helpers
 */

function escape(html, encode) {
    return html
        .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;')
        .replace(/%/g, '&#37;');
}

function escape_latex(tex) {
    return tex
        .replace(/#/g, '\\#')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/\^/g,'\\textasciicircum');
}

let acc_dict = {
    '`': {'name': 'grave', 'allowed': ['a', 'e', 'i', 'o', 'u', 'A', 'E', 'I', 'O', 'U']},
    "'": {'name': 'acute', 'allowed': ['a', 'e', 'i', 'o', 'u', 'y', 'A', 'E', 'I', 'O', 'U', 'Y']},
    '^': {'name': 'circ', 'allowed': ['a', 'e', 'i', 'o', 'u', 'A', 'E', 'I', 'O', 'U']},
    '"': {'name': 'uml', 'allowed': ['a', 'e', 'i', 'o', 'u', 'y', 'A', 'E', 'I', 'O', 'U', 'Y']},
    '~': {'name': 'tilde', 'allowed': ['a', 'n', 'o', 'A', 'N', 'O']},
}

function special(acc, letter) {
    if (acc in acc_dict) {
        let spec = acc_dict[acc];
        if (spec.allowed.includes(letter)) {
            return `&${letter}${spec.name};`
        }
    }
    return letter;
}

function unescape(html) {
    // explicitly match decimal, hex, and named HTML entities
    return html.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/g, function(_, n) {
        n = n.toLowerCase();
        if (n === 'colon') return ':';
        if (n.charAt(0) === '#') {
            return n.charAt(1) === 'x'
                ? String.fromCharCode(parseInt(n.substring(2), 16))
                : String.fromCharCode(+n.substring(1));
        }
        return '';
    });
}

function replace(regex, opt) {
    regex = regex.source;
    opt = opt || '';
    return function self(name, val) {
        if (!name) return new RegExp(regex, opt);
        val = val.source || val;
        val = val.replace(/(^|[^\[])\^/g, '$1');
        regex = regex.replace(name, val);
        return self;
    };
}

function parsePreamble(raw) {
    let macros = {};
    let macro_list = raw.split(/[\n,;]+/) // split on \n or comma
        .filter(macraw => macraw.includes(':')) // is it a macro?
        .map(macraw => macraw.split(':')) // split on :
        .forEach(el => macros[el[0]] = el[1]); // save internal macros
    let tags = raw.split(/[\n,;]+/)
        .filter(t => t.match(/#(\[[\w| ]+\]|\w+)/)) // is it a tag?
        .map(t => t.replace('[','').replace(']','').replace('#','')) // is it a tag?
    return {macros, tags}
}

// dummy regex pattern
function noop() {}
noop.exec = noop;

function merge(obj) {
    let i = 1
      , target
      , key;

    for (; i < arguments.length; i++) {
        target = arguments[i];
        for (key in target) {
            if (Object.prototype.hasOwnProperty.call(target, key)) {
                obj[key] = target[key];
            }
        }
    }

    return obj;
}

/**
 * Options
 */

let defaults = {
    gfm: true,
    tables: true,
    breaks: true,
};

/**
 * Interface
 */

let divRenderer = new DivRenderer();
let divInlineParser = new InlineParser(divRenderer);
let divParser = new BlockParser(divRenderer, divInlineParser);

let texRenderer = new TexRenderer();
let texInlineParser = new InlineParser(texRenderer);
let texParser = new BlockParser(texRenderer, texInlineParser);

function markthree(src, output) {
    output = output ?? 'html';

    let parser;
    if (output == 'html') {
        parser = divParser;
    } else if (output == 'latex') {
        parser = texParser;
    }

    try {
        return parser.parse(src);
    } catch (e) {
        console.log(e);
        return {
            src: `<p>internal parsing error [marked3.js:${e.lineNumber}] → ${e.message}</p>`
        };
    }
}
