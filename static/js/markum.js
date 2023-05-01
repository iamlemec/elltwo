/**
 *
 * a markdown+ to syntax tree parser
 * based on marked - https://github.com/chjj/marked
 *
 */

export { parseInline, parseBlock, parseDocument }

import katex from 'katex'
import {
    parseGum, Element as GumElement, SVG as GumSVG
} from 'gum.js'

/**
 * Helper Functions
 */

 function escape_html(html, encode) {
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
 * Block Regex
 */

let block = {
    empty: /^(\s*)$/,
    comment: /^\/\/ ?/,
    hrule: /^([-*_]){3,}\s*$/,
    heading: /^(#{1,6})(\*?) *(?:refargs)? *([^\n]+?)$/,
    lheading: /^([^\n]+)\n *(=|-){2,}\s*$/,
    blockquote: /^q*>\s*\n?/,
    code: /^``(\*)? *(?:refargs)?(?:\n)?(?: |\n)?/,
    equation: /^\$\$(\*|&|\*&|&\*)? *(?:refargs)?\s*/,
    title: /^#! *(?:refargs)?\s*([^\n]*)\s*/,
    upload: /^!!(gum)? *(?:refargs)?\s*$/,
    svg: /^\!(svg|gum)(\*)? *(?:refargs)?\s*/,
    image: /^!(yt|youtube)?(\*)? *(?:refargs)? *(?:\(href\))?\s*/,
    figtab: /^\| *(?:refargs)?\s*\n/,
    envbeg: /^\>\>(\!|\*|\!\*|\*\!)? *([\w-]+) *(?:refargs)?\s*/,
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


/**
 * Inline Regex
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

/**
 * Document Parser
 */

function parseDocument(src) {
    let blocks = src.split(/\n{2,}/).map(parseBlock);
    return new Document(blocks);
}

/**
 * Block Parser
 */

// block prefix parser
function parsePrefix(pre) {
    return (pre ?? '').split('');
}

// variable argument parser (inside []'s)
function parseArgs(argsraw, number=true, set=true) {
    if (argsraw == null) {
        return {};
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

    return args;
}

function parseList(src) {
    let items = src
        .split('\n')
        .filter(x => x.length > 0);

    let ordered = true;
    let rows = items.map(item => {
        let [mat, _, bull] = block._item.exec(item);
        ordered &&= bull.length > 1;
        return item.slice(mat.length);
    });

    let body = rows.map(row => {
        let inner = parseInline(row);
        return new ListItemElement(inner);
    });

    return new ListBlock(body, {ordered});
}

function parseAlign(a) {
    if (/^ *-+: *$/.test(a)) {
        return 'right';
    } else if (/^ *:-+: *$/.test(a)) {
        return 'center';
    } else if (/^ *:-+ *$/.test(a)) {
        return 'left';
    } else {
        return null;
    }
}

// this only passes align info to top level table
function parseTable(header, align, cells) {
    // unpack cells
    header = header.trim().split(/ *\| */);
    align = align.trim().split(/ *\| */)
        .map(parseAlign);
    cells = cells.trim().split('\n')
        .map(c => c.trim().split(/ *\| */));

    // head
    let hcells = header.map(c =>
        new TableCellElement(parseInline(c), {header: true})
    );
    let head = new TableRowElement(hcells);

    // body
    let body = cells.map(r => {
        let rcells = r.map(c =>
            new TableCellElement(parseInline(c))
        );
        return new TableRowElement(rcells);
    });

    return new TableBlock(head, body, align);
}

function parseBiblio(id, text) {
    text = text.split('\n').map(line => line.includes(':'));
    let bibs = text.map(line => {
        let [key, val] = line.split(':', 1).map(s => s.trim());
        return new BiblioElement(key, val);
    });
    return new BiblioBlock(id, bibs);
}

// parse a block of text — usually main entry point
function parseBlock(src) {
    src = src
        .replace(/\r\n|\r/g, '\n') // DOS newlines
        .replace(/\t/g, '    ') // tab (4 spaces)
        .replace(/\u00a0/g, ' ') // non-breaking space
        .replace(/\u2424/g, '\n') // newline symbol
        .replace(/^ +$/gm, ''); // empty lines

    let cap;

    // empty cell (all whitespace)
    if (cap = block.empty.exec(src)) {
        let [_, text] = cap;
        let inner = parseInline(text);
        return new EmptyBlock(inner);
    }

    // equation
    if (cap = block.equation.exec(src)) {
        let [mat, pargs, rargs] = cap;
        pargs = parsePrefix(pargs);
        let args = {
            number: !pargs.includes('*'),
            multiline: pargs.includes('&'),
            ...parseArgs(rargs)
        };
        let text = src.slice(mat.length);
        return new EquationBlock(text, args);
    }

    // svg/gum
    if (cap = block.svg.exec(src)) {
        let [mat, sog, pargs, rargs] = cap;
        let cls = (sog == 'gum') ? GumBlock : SvgBlock;
        pargs = parsePrefix(pargs);
        let args = {
            number: !pargs.includes('*'),
            ...parseArgs(rargs)
        };
        let code = src.slice(mat.length);
        return new cls(code, args);
    }

    // image
    if (cap = block.image.exec(src)) {
        let [_, vid, pargs, rargs, href] = cap;
        pargs = parsePrefix(pargs);
        let cls = (vid != null) ? VideoBlock : ImageBlock;
        let args = {
            number: !pargs.includes('*'),
            ...parseArgs(rargs)
        };
        return new cls(href, args);
    }

    // upload
    if (cap = block.upload.exec(src)) {
        let [_, pargs, rargs] = cap;
        let args = {
            gum: pargs == 'gum',
            ...parseArgs(rargs)
        };
        return new UploadBlock(id, args);
    }

    // figure table
    if (cap = block.figtab.exec(src)) {
        let [mat, rargs] = cap;
        let args = parseArgs(rargs);
        let table = src.slice(mat.length);
        return this.parseTable(table, args);
    }

    // comment
    if (cap = block.comment.exec(src)) {
        let [mat] = cap;
        let text = src.slice(mat.length);
        return new CommentBlock(text);
    }

    // code
    if (cap = block.code.exec(src)) {
        let [mat, pargs, rargs] = cap;
        pargs = parsePrefix(pargs);
        let args = {
            number: !pargs.includes('*'),
            ...parseArgs(rargs)
        };
        let text = src.slice(mat.length);
        return new CodeBlock(text, args);
    }

    // title
    if (cap = block.title.exec(src)) {
        let [mat, rargs, text] = cap;
        let rest = src.slice(mat.length);
        let args = parseArgs(rargs);
        let title = parseInline(text);
        let preamble = parsePreamble(rest);
        return new TitleBlock(title, preamble, args);
    }

    // heading
    if (cap = block.heading.exec(src)) {
        let [mat, hash, pargs, rargs, body] = cap;
        pargs = parsePrefix(pargs);
        let level = hash.length;
        let text = parseInline(body);
        let args = {
            number: pargs.includes('*'),
            ...parseArgs(rargs)
        };
        return new HeadingBlock(level, text, args);
    }

    // envbeg
    if (cap = block.envbeg.exec(src)) {
        let [mat, pargs, env, rargs] = cap;
        let cls = pargs.includes('!') ? EnvSingleBlock : EnvBeginBlock;
        let args = {
            number: !pargs.includes('*'),
            ...parseArgs(rargs)
        };
        let text = src.slice(mat.length);
        let inner = parseInline(text);
        return new cls(inner, args);
    }

    // envend
    if (cap = block.envend.exec(src)) {
        let [mat] = cap;
        let text = src.slice(mat.length);
        let inner = parseInline(text);
        return new EnvEndBlock(inner);
    }

    // lheading
    if (cap = block.lheading.exec(src)) {
        let [_, body, bar] = cap;
        let text = parseInline(body);
        let depth = (bar == '=') ? 1 : 2;
        return new HeadingBlock(depth, text);
    }

    // hrule
    if (cap = block.hrule.exec(src)) {
        return new RuleBlock();
    }

    // blockquote
    if (cap = block.blockquote.exec(src)) {
        let [mat] = cap;
        let text = src.slice(mat.length);
        return new QuoteBlock(text);
    }

    // list
    if (cap = block.list.exec(src)) {
        let [mat] = cap;
        return parseList(mat);
    }

    // table (gfm)
    if (cap = block.table.exec(src)) {
        let [mat, head, spec, body] = cap;
        return parseTable(head, spec, body);
    }

    // top-level paragraph (fallback)
    let inner = parseInline(src);
    return new TextBlock(inner);
}

/**
 * Gum Wrapper
 */

function parseGumRobust(src, size) {
    let elem;
    try {
        elem = parseGum(src);
    } catch (err) {
        return String(err.message);
    }
    if (elem instanceof GumSVG) {
        return elem;
    } else if (elem instanceof GumElement) {
        return new GumSVG(elem, size);
    } else {
        return String(elem);
    }
}

/**
 * Inline Parser
 */

// parse markdown into `InlineElement`s
function parseInline(src, ctx) {
    ctx = ctx ?? {};
    let cap, mat, text, href, tex, esc, acc, letter, args,
        inner, pre, cls, elem, text1, text2, delim;

    let out = [];
    while (src) {
        // special
        if (cap = inline.special.exec(src)) {
            [mat, acc, letter] = cap;
            out.push(new SpecialInline(acc, letter));
            src = src.substring(mat.length);
            continue;
        }

        // escape
        if (cap = inline.escape.exec(src)) {
            [mat, esc] = cap;
            out.push(new EscapeInline(esc));
            src = src.substring(mat.length);
            continue;
        }

        // math
        if (cap = inline.math.exec(src)) {
            [mat, tex] = cap;
            out.push(new MathInline(tex));
            src = src.substring(mat.length);
            continue;
        }

        // comment
        if (cap = inline.in_comment.exec(src)) {
            [mat, text] = cap;
            out.push(new CommentInline(text));
            src = src.substring(mat.length);
            continue;
        }

        // ref/cite
        if (cap = inline.refcite.exec(src)) {
            [mat, pre, rargs] = cap;
            cls = (pre == '@') ? RefInline : CiteInline;
            args = parseArgs(rargs, false, false);
            text = args.text || args.txt || args.t || '';
            inner = parseInline(text);
            out.push(new cls(inner, args));
            src = src.substring(mat.length);
            continue;
        }

        // footnote/sidenote
        if (cap = inline.footnote.exec(src)) {
            [mat, pre, text] = cap;
            cls = (pre == '!') ? SidenoteInline : FootnoteInline;
            inner = parseInline(text);
            out.push(new cls(inner));
            src = src.substring(mat.length);
            continue;
        }

        // internal link
        if (cap = inline.ilink.exec(src)) {
            [mat, rargs] = cap;
            args = parseArgs(rargs, false, false);
            text = args.text || args.txt || args.t || '';
            inner = parseInline(text);
            out.push(new LinkInline(inner, args));
            src = src.substring(mat.length);
            continue;
        }

        // autolink
        if (cap = inline.autolink.exec(src)) {
            [mat, href] = cap;
            out.push(new LinkInline(href));
            src = src.substring(mat.length);
            continue;
        }

        // url (gfm)
        if (!ctx.inLink && (cap = inline.url.exec(src))) {
            [mat, href] = cap;
            out.push(new LinkInline(href));
            src = src.substring(mat.length);
            continue;
        }

        // link
        if (cap = inline.link.exec(src)) {
            [mat, pre, text, href, title] = cap;
            [href, title] = [escape_html(href), escape_html(title)];
            if (pre == '!') {
                elem = new ImageInline(href, text);
            } else {
                inner = parseInline(text, {...ctx, link: true});
                elem = new LinkInline(href, inner);
            }
            out.push(elem);
            src = src.substring(mat.length);
            continue;
        }

        // strong
        if (cap = inline.strong.exec(src)) {
            [mat, text1, text2] = cap;
            text = text1 || text2;
            inner = parseInline(text);
            out.push(new BoldInline(inner));
            src = src.substring(mat.length);
            continue;
        }

        // hash
        if (cap = inline.hash.exec(src)) {
            [mat, text] = cap;
            tag = text.replace('[', '').replace(']', '');
            out.push(new HashInline(tag));
            src = src.substring(mat.length);
            continue;
        }

        // em
        if (cap = inline.em.exec(src)) {
            [mat, text1, text2] = cap;
            text = text1 || text2;
            inner = parseInline(text);
            out.push(new ItalicInline(inner));
            src = src.substring(mat.length);
            continue;
        }

        // code
        if (cap = inline.code.exec(src)) {
            [mat, delim, text] = cap;
            out.push(new CodeInline(text));
            src = src.substring(mat.length);
            continue;
        }

        // br
        if (cap = inline.br.exec(src)) {
            out.push(new NewlineInline());
            src = src.substring(mat.length);
            continue;
        }

        // del (gfm)
        if (cap = inline.del.exec(src)) {
            [mat, text] = cap;
            inner = parseInline(text);
            out.push(new StrikeoutInline(inner));
            src = src.substring(mat.length);
            continue;
        }

        // text
        if (cap = inline.text.exec(src)) {
            let [mat] = cap;
            out.push(new TextInline(mat));
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
 * Render Tools
 */

// capitalize first letter of string
function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// make a caption element
function makeCaption(type, caption, args) {
    let {title} = args ?? {};
    title = title ?? capitalize(type);
    if (caption != null) {
        return `<div class="figure-caption ${type}-caption"><span class="caption-title">${title}</span>: ${caption}</div>`;
    } else {
        return '';
    }
}

/**
 * Core Renderer
 */

class Element {
    constructor() {
    }

    renderHtml() {
        throw new Error(`${this.constructor.name}: HTML renderer not implemented.`);
    }

    renderLatex() {
        throw new Error(`${this.constructor.name}: LaTeX renderer not implemented.`);
    }
}

class Container {
    constructor(children) {
        this.children = children;
    }

    innerHtml() {
        return this.children.map(c => c.renderHtml()).join('');
    }
}

class Document extends Container {
    constructor(children) {
        super(children);
    }

    renderHtml() {
        return this.innerHtml();
    }
}

/**
 * Inline Renderer
 */

class TextInline extends Element {
    constructor(text) {
        super();
        this.text = text;
    }

    renderHtml() {
        return this.text;
    }
}

class SpecialInline extends Element {
    constructor(acc, letter) {
        super();
        this.acc = acc;
        this.letter = letter;
    }

    renderHtml() {
        return special(this.acc, this.letter);
    }
}

class EscapeInline extends Element {
    constructor(text) {
        super();
        this.text = text;
    }

    renderHtml() {
        return escape_html(this.text);
    }
}

class CommentInline extends Element {
    constructor(text) {
        super();
        this.text = text;
    }

    renderHtml() {
        return `<span class="comment-inline">${this.text}</span>`;
    }
}

class LinkInline extends Element {
    constructor(href, text) {
        let children = text ?? [TextInline(href)];
        super(children);
        this.href = href;
    }

    renderHtml() {
        let inner = this.innerHtml();
        return `<a href="${this.href}" class="link-inline">${inner}</a>`;
    }
}

class ImageInline extends Element {
    constructor(href, alt) {
        super();
        this.href = href;
        this.alt = alt ?? null;
    }

    renderHtml() {
        let alt = (this.alt != null) ? `alt="${this.alt}"` : '';
        return `<img src="${this.href}" ${alt} class="image-inline" />`;
    }
}

class BoldInline extends Container {
    constructor(children) {
        super(children);
    }

    renderHtml() {
        let inner = this.innerHtml();
        return `<span class="bold-inline">${inner}</span>`;
    }
}

class ItalicInline extends Container {
    constructor(children) {
        super(children);
    }

    renderHtml() {
        let inner = this.innerHtml();
        return `<span class="italic-inline">${inner}</span>`;
    }
}

class CodeInline extends Element {
    constructor(text) {
        super();
        this.text = text;
    }

    renderHtml() {
        return `<span class="code-inline">${this.text}</span>`;
    }
}

class StrikeoutInline extends Container {
    constructor(children) {
        super(children);
    }

    renderHtml() {
        let inner = this.innerHtml();
        return `<span class="strikeout-inline">${inner}</span>`;
    }
}

class RefInline extends Element {
    constructor(tag) {
        super();
        this.tag = tag;
    }

    // pull this from context
    renderHtml() {
        return `<a href="#${this.tag}" class="ref-inline">#${this.tag}</a>`;
    }
}

class CiteInline extends Element {
    constructor(tag) {
        super();
        this.tag = tag;
    }

    // pull this from context
    renderHtml() {
        return `<a href="" class="cite-inline">@${this.tag}</a>`;
    }
}

class FootnoteInline extends Container {
    constructor(children) {
        super(children);
    }

    // get number from context
    renderHtml() {
        let inner = this.innerHtml();
        let popup = `<div class="footnote-popup">${inner}</div>`;
        return `<span class="footnote-inline">N</span>\n${popup}\n`;
    }
}

class SidenoteInline extends Element {
    constructor(text) {
        super();
        this.text = text;
    }

    // get number from context
    renderHtml() {
        let inner = this.innerHtml();
        let popup = `<div class="sidenote-popup">${inner}</div>`;
        return `<span class="sidenote-inline">N</span>\n${popup}\n`;
    }
}

class MathInline extends Element {
    constructor(tex) {
        super();
        this.tex = tex;
    }

    renderHtml() {
        let math = katex.renderToString(this.tex, {throwOnError: false});
        return `<span class="math-inline">${math}</span>`;
    }
}

class HashInline extends Element {
    constructor(tag) {
        super();
        this.tag = tag;
    }

    renderHtml() {
        return `<a href="/h/#${this.tag}" class="hash-inline">#${this.tag}</span>`;
    }
}

class NewlineInline extends Element {
    constructor() {
        super();
    }

    renderHtml() {
        return `<br class="newline-inline" />`;
    }
}

class ListItemElement extends Container {
    constructor(children) {
        super(children);
    }

    renderHtml() {
        let inner = this.innerHtml();
        return `<li class="listitem-inline">${inner}</li>`;
    }
}

/**
 * Block Renderer
 */

class EmptyBlock extends Element {
    constructor() {
        super();
    }

    renderHtml() {
        return '';
    }
}

class TextBlock extends Container {
    constructor(children) {
        super(children);
    }

    renderHtml() {
        let inner = this.innerHtml();
        return `<div class="block text-block">${inner}</div>`;
    }
}

class CommentBlock extends Element {
    constructor(text) {
        super();
        this.text = text;
    }

    renderHtml() {
        return `<div class="block comment-block"><span>${this.text}</span></div>`;
    }
}

class TitleBlock extends Container {
    constructor(children, preamble, args) {
        super(children);
        this.preamble = preamble ?? null;
    }

    renderHtml() {
        let inner = this.innerHtml();
        return `<div class="block title-block">${inner}</div>`;
    }
}

class HeadingBlock extends Container {
    constructor(level, children) {
        super(children);
        this.level = level;
    }

    renderHtml() {
        let inner = this.innerHtml();
        return `<div class="block heading-block h${this.level}-block">${inner}</div>`;
    }
}

class RuleBlock extends Element {
    constructor() {
        super();
    }

    renderHtml() {
        return `<div class="block rule-block"><div/>`;
    }
}

class QuoteBlock extends Element {
    constructor(text) {
        super();
        this.text = text;
    }

    renderHtml() {
        return `<div class="block quote-block">${this.text}</div>`;
    }
}

class CodeBlock extends Element {
    constructor(code, args) {
        let {lang} = args ?? {};
        super();
        this.code = code;
        this.lang = lang ?? null;
    }

    renderHtml() {
        let lang = (this.lang != null) ? `code-lang-${this.lang}` : '';
        return `<div class="block code-block ${lang}">${this.code}</div>`;
    }
}


class ListBlock extends Container {
    constructor(children, args) {
        let {ordered} = args ?? {};
        super(children);
        this.ordered = ordered ?? false;
    }

    renderHtml() {
        let inner = this.innerHtml();
        let tag = this.ordered ? 'ol' : 'ul';
        return `<div class="block list-block"><${tag}>${inner}</${tag}></div>`;
    }
}

class EquationBlock extends Element {
    constructor(tex, args) {
        let {number, multiline} = args ?? {};
        super();
        this.tex = tex;
        this.number = number ?? true;
        this.multiline = multiline ?? false;
    }

    renderHtml() {
        let tex = this.multiline ? `\\begin{aligned}${this.tex}\\end{aligned}` : this.tex;
        let math = katex.renderToString(tex, {displayMode: true, throwOnError: false});
        let number = this.number ? `<span class="equation-number"></span>` : '';
        return `<div class="block equation-block">${math}${number}</div>`;
    }
}

class ImageBlock extends Element {
    constructor(src, args) {
        let {number, caption, width} = args ?? {};
        super();
        this.src = src;
        this.number = number ?? true;
        this.caption = caption ?? null;
        this.width = width ?? null;
    }
}

class VideoBlock extends Element {
    constructor(src, args) {
        let {number, caption, width} = args ?? {};
        super();
        this.src = src;
        this.number = number ?? false;
        this.caption = caption ?? null;
        this.width = width ?? null;
    }
}

class SvgBlock extends Element {
    constructor(code, args) {
        let {number, caption, width} = args ?? {};
        super();
        this.code = code;
        this.number = number ?? true;
        this.caption = caption ?? null;
        this.width = width ?? 50;
    }

    renderHtml() {
        let style = this.width ? `style="width: ${this.width}%;"` : '';
        let caption = (this.caption != null) ? makeCaption('figure', this.caption) : '';
        let classes = ['block', 'figure-block', 'svg-block'];
        let inner = `<div class="svg-sizer" ${style}>${this.code}</div>`;
        return `<div class="${classes.join(' ')}">${inner}${caption}</div>`;
    }
}

class GumBlock extends Element {
    constructor(code, args) {
        let {number, caption, width, pixel} = args ?? {};
        super();
        this.number = number ?? true;
        this.caption = caption ?? null;
        this.width = width ?? 50;
        this.gum = parseGumRobust(code, pixel);
    }

    renderHtml() {
        let style = this.width ? `style="width: ${this.width}%;"` : '';
        let caption = (this.caption != null) ? makeCaption('figure', this.caption) : '';
        let classes = ['block', 'figure-block', 'gum-block'];
        let inner;
        try {
            let ret = (typeof(this.gum) == 'string') ? this.gum : this.gum.svg();
            inner = `<div class="gum-sizer" ${style}>${ret}</div>`;
        } catch (e) {
            inner = e.message;
            classes.push('gum-error');
        }
        return `<div class="${classes.join(' ')}">${inner}${caption}</div>`;
    }
}

class UploadBlock extends Element {
    constructor(id, args) {
        let {gum} = args ?? {};
        super();
        this.id = id;
        this.gum = gum ?? false;
    }
}

class EnvBeginBlock extends Container {
    constructor(name, args) {
        let {number} = args ?? {};
        super();
        this.name = name;
        this.number = number ?? true;
    }
}

class EnvSingleBlock extends Container {
    constructor(name, args) {
        let {number} = args ?? {};
        super();
        this.name = name;
        this.number = number ?? true;
    }
}

class EnvEndBlock extends Container {
    constructor() {
        super();
    }
}
