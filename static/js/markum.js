/**
 *
 * a markdown+ to syntax tree parser
 * based on marked - https://github.com/chjj/marked
 *
 */

export { parseInline, parseBlock, parseDocument }

import katex from 'katex'
import {
    parseGum, Element as GumElement, SVG as GumSVG, props_repr, zip
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
    title: /^#\! *(?:refargs)?\s*([^\n]*)\s*/,
    upload: /^\!\!(gum)? *(?:refargs)?\s*$/,
    svg: /^\!(svg|gum)(\*)? *(?:refargs)?\s*/,
    image: /^\!(yt|youtube)?(\*)? *(?:refargs)? *(?:\(href\))?\s*/,
    figtab: /^\!tab *(?:refargs)?\s*\n(?:table)/,
    envbeg: /^\>\>(\!|\*|\!\*|\*\!)? *([\w-]+) *(?:refargs)?\s*/,
    envend: /^\<\<\s*/,
    list: /^((?: *(?:bull) [^\n]*(?:\n|$))+)\s*$/,
    table: /^\|([^\n]+)\| *\n *\|( *[-:]+[-| :]*)\| *\n((?: *\|[^\n]*\| *(?:\n|$))*)\s*$/,
};

block._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;
block._refid = /\[([\w-]+)\]/;
block._refargs = /(?:\[((?:[^\]]|(?<=\\)\])*)\])/;
// block._refargs = /\[((?:(?:[^\]\[\\]|\\.)+|\[(?:[^\]\[]+)*\])*)\]/;
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
    let blocks = src.split(/\n{2,}/)
        .map(parseBlock)
        .map(b => new Block(b));
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

    let body = rows.map(parseInline);

    return new List(body, {ordered});
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
function parseTable(header, align, cells, args) {
    // unpack cells
    header = header.trim().split(/ *\| */);
    align = align.trim().split(/ *\| */).map(parseAlign);
    cells = cells.trim().split('\n').map(c =>
        c.replace(/^ *\| *| *\| *$/g, '').split(/ *\| */)
    );

    // parse cells
    let head = header.map(parseInline);
    let body = cells.map(r => r.map(parseInline));

    // return table
    return new Table(head, body, {align, ...args});
}

function parseBiblio(id, text) {
    text = text.split('\n').map(line => line.includes(':'));
    let bibs = text.map(line => {
        let [key, val] = line.split(':', 1).map(s => s.trim());
        return new BiblioItem(key, val);
    });
    return new Biblio(id, bibs);
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
        return new Block([]);
    }

    // equation
    if (cap = block.equation.exec(src)) {
        let [mat, pargs, rargs] = cap;
        pargs = parsePrefix(pargs);
        let args = {
            display: true,
            number: !pargs.includes('*'),
            multiline: pargs.includes('&'),
            ...parseArgs(rargs)
        };
        let text = src.slice(mat.length);
        return new Math(text, args);
    }

    // svg/gum
    if (cap = block.svg.exec(src)) {
        let [mat, sog, pargs, rargs] = cap;
        let cls = (sog == 'gum') ? Gum : Svg;
        pargs = parsePrefix(pargs);
        let number = !pargs.includes('*');
        let {caption, ...args} = parseArgs(rargs);
        caption = parseInline(caption);
        let code = src.slice(mat.length);
        let child = new cls(code, args);
        return new Figure(child, {caption, number});
    }

    // table
    if (cap = block.figtab.exec(src)) {
        let [mat, rargs, header, align, cells] = cap;
        let {caption, number, ...args} = parseArgs(rargs);
        let table = src.slice(mat.length);
        let child = parseTable(header, align, cells, args);
        return new Figure(child, {caption, number, ftype: 'table'});
    }

    // upload
    if (cap = block.upload.exec(src)) {
        let [_, pargs, rargs] = cap;
        let args = {
            gum: pargs == 'gum',
            ...parseArgs(rargs)
        };
        return new Upload(id, args);
    }
    
    // image/video
    if (cap = block.image.exec(src)) {
        let [_, vid, pargs, rargs, href] = cap;
        pargs = parsePrefix(pargs);
        let number = !pargs.includes('*');
        let {caption, ...args} = parseArgs(rargs);
        let cls = (vid != null) ? Video : Image;
        let child = new cls(href, args);
        return new Figure(child, {caption, number});
    }

    // comment
    if (cap = block.comment.exec(src)) {
        let [mat] = cap;
        let text = src.slice(mat.length);
        return new Comment(text);
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
        return new Code(text, args);
    }

    // title
    if (cap = block.title.exec(src)) {
        let [mat, rargs, text] = cap;
        let args = parseArgs(rargs);
        let title = parseInline(text);
        return new Title(title, args);
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
        return new Heading(level, text, args);
    }

    // envbeg
    if (cap = block.envbeg.exec(src)) {
        let [mat, pargs, env, rargs] = cap;
        let cls = pargs.includes('!') ? EnvSingle : EnvBegin;
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
        return new EnvEnd(inner);
    }

    // lheading
    if (cap = block.lheading.exec(src)) {
        let [_, body, bar] = cap;
        let text = parseInline(body);
        let depth = (bar == '=') ? 1 : 2;
        return new Heading(depth, text);
    }

    // hrule
    if (cap = block.hrule.exec(src)) {
        return new Rule();
    }

    // blockquote
    if (cap = block.blockquote.exec(src)) {
        let [mat] = cap;
        let text = src.slice(mat.length);
        return new Blockquote(text);
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
    return parseInline(src);
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

// parse markdown into `Element`s
function parseInline(src, ctx) {
    if (src == null) {
        return null;
    }

    ctx = ctx ?? {};
    let cap, mat, text, href, tex, esc, acc, letter, args,
        inner, pre, cls, elem, text1, text2, delim;

    let out = [];
    while (src) {
        // detect empty early
        if (src.length == 0) {
            break;
        }

        // special
        if (cap = inline.special.exec(src)) {
            [mat, acc, letter] = cap;
            out.push(new Special(acc, letter));
            src = src.substring(mat.length);
            continue;
        }

        // escape
        if (cap = inline.escape.exec(src)) {
            [mat, esc] = cap;
            out.push(new Escape(esc));
            src = src.substring(mat.length);
            continue;
        }

        // math
        if (cap = inline.math.exec(src)) {
            [mat, tex] = cap;
            out.push(new Math(tex));
            src = src.substring(mat.length);
            continue;
        }

        // comment
        if (cap = inline.in_comment.exec(src)) {
            [mat, text] = cap;
            out.push(new Comment(text));
            src = src.substring(mat.length);
            continue;
        }

        // ref/cite
        if (cap = inline.refcite.exec(src)) {
            [mat, pre, rargs] = cap;
            cls = (pre == '@') ? Reference : Citation;
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
            cls = (pre == '!') ? Sidenote : Footnote;
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
            out.push(new Link(inner, args));
            src = src.substring(mat.length);
            continue;
        }

        // autolink
        if (cap = inline.autolink.exec(src)) {
            [mat, href] = cap;
            out.push(new Link(href));
            src = src.substring(mat.length);
            continue;
        }

        // url (gfm)
        if (!ctx.inLink && (cap = inline.url.exec(src))) {
            [mat, href] = cap;
            out.push(new Link(href));
            src = src.substring(mat.length);
            continue;
        }

        // link
        if (cap = inline.link.exec(src)) {
            [mat, pre, text, href, title] = cap;
            [href, title] = [escape_html(href), escape_html(title)];
            if (pre == '!') {
                elem = new Image(href, text);
            } else {
                inner = parseInline(text, {...ctx, link: true});
                elem = new Link(href, inner);
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
            out.push(new Bold(inner));
            src = src.substring(mat.length);
            continue;
        }

        // hash
        if (cap = inline.hash.exec(src)) {
            [mat, text] = cap;
            tag = text.replace('[', '').replace(']', '');
            out.push(new Hash(tag));
            src = src.substring(mat.length);
            continue;
        }

        // em
        if (cap = inline.em.exec(src)) {
            [mat, text1, text2] = cap;
            text = text1 || text2;
            inner = parseInline(text);
            out.push(new Italic(inner));
            src = src.substring(mat.length);
            continue;
        }

        // code
        if (cap = inline.code.exec(src)) {
            [mat, delim, text] = cap;
            out.push(new Monospace(text));
            src = src.substring(mat.length);
            continue;
        }

        // br
        if (cap = inline.br.exec(src)) {
            out.push(new Newline());
            src = src.substring(mat.length);
            continue;
        }

        // del (gfm)
        if (cap = inline.del.exec(src)) {
            [mat, text] = cap;
            inner = parseInline(text);
            out.push(new Strikeout(inner));
            src = src.substring(mat.length);
            continue;
        }

        // text
        if (cap = inline.text.exec(src)) {
            let [mat] = cap;
            out.push(mat);
            src = src.substring(mat.length);
            continue;
        }

        if (src.length > 0) {
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

// merge attributes accounting for lists
function mergeAttr(...args) {
    let classes0 = args.filter(a => 'class' in a).map(x => x['class']);
    let classes = classes0.join(' ').split(/ +/).join(' ');
    let attrs = Object.assign({}, ...args);
    attrs['class'] = classes;
    return attrs;
}

/**
 * Core Renderer
 */

class Element {
    constructor(tag, unary, attr) {
        this.tag = tag ?? 'div';
        this.unary = unary ?? false;
        this.attr = attr ?? {};
    }

    props() {
        return this.attr;
    }

    inner() {
        return '';
    }

    html() {
        // collect all properties
        let pvals = this.props();
        let props = props_repr(pvals);
        let pre = props.length > 0 ? ' ' : '';

        // return final html
        if (this.unary) {
            return `<${this.tag}${pre}${props} />`;
        } else {
            let ivals = this.inner();
            return `<${this.tag}${pre}${props}>${ivals}</${this.tag}>`;
        }
    }
}

class Container extends Element {
    constructor(tag, children, args) {
        // handle singleton case
        if (!Array.isArray(children)) {
            children = [children];
        }
        super(tag, false, args);
        this.children = children;
    }

    inner() {
        return this.children.map(c => (c instanceof Element) ? c.html() : c).join('');
    }
}

class Div extends Container {
    constructor(children, args) {
        super('div', children, args);
    }
}

class Span extends Container {
    constructor(children, args) {
        super('span', children, args);
    }
}

class Block extends Div {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'block'});
        super(children, attr1);
    }
}

class Document extends Container {
    constructor(children, args) {
        super('div', children, args);
    }

    html() {
        return this.inner();
    }
}

/**
 * gum.js bridge
 */

// this will return an Element or String
// contingent upon the idiotic number of possible return types
class GumWrap extends Element {
    constructor(code, args) {
        let {pixel} = args ?? {};
        super('div', false); // this is overridden
        try {
            this.gum = parseGum(code);
            if (this.gum instanceof GumSVG) {
            } else if (this.gum instanceof GumElement) {
                this.gum = new GumSVG(this.gum, {pixel});
            }
        } catch (err) {
            this.gum = new Span(err.message, {class: 'gum-error'});
        }
    }

    html() {
        if (this.gum instanceof GumElement) {
            try {
                return this.gum.svg();
            } catch (err) {
                return `<span class="gum-error">${err.message}</div>`;
            }    
        } else if (this.gum instanceof Element) {
            return this.gum.html();
        } else {
            return this.gum;
        }
    }
}

/**
 * Figures
 */

// this will handle counters for figures, equations, etc
class Counter extends Element {
    constructor(name) {
        super('span', false, {'class': 'counter'});
        this.name = name;
    }

    inner() {
        return 'N';
    }
}

class Caption extends Div {
    constructor(caption, args) {
        let {ftype, title, ...attr} = args ?? {};
        ftype = ftype ?? 'figure';
        title = title ?? capitalize(ftype);
        let prefix = new Span([
            `${title} `, new Counter(ftype), ': ',
        ], {'class': 'caption-prefix'});
        let children = [prefix, ...caption];
        let attr1 = mergeAttr(attr, {'class': 'caption'});
        super(children, attr1);
    }
}

class Figure extends Div {
    constructor(child, args) {
        let {ftype, title, caption, ...attr} = args ?? {};
        ftype = ftype ?? 'figure';
        title = title ?? capitalize(ftype);
        caption = (caption != null) ? new Caption(caption, {ftype, title}) : null;
        let attr1 = mergeAttr(attr, {'class': ftype});
        super([child, caption], attr1);
    }
}

/**
 * Inline Renderer
 */

class Text extends Element {
    constructor(text, args) {
        let attr = args ?? {};
        super('span', false, attr);
        this.text = text;
    }

    inner() {
        return this.text;
    }
}

class Special extends Text {
    constructor(acc, letter, args) {
        let attr = args ?? {};
        let text = special(acc, letter);
        let attr1 = mergeAttr(attr, {class: 'special'});
        super(text, attr1);
    }
}

class Escape extends Text {
    constructor(esc, args) {
        let attr = args ?? {};
        let text = escape_html(esc);
        let attr1 = mergeAttr(attr, {class: 'escape'});
        super(text, attr1);
    }
}

class Comment extends Text {
    constructor(comm, args) {
        let attr = args ?? {};
        let text = `// ${comm}`;
        let attr1 = mergeAttr(attr, {class: 'comment'});
        super(text, attr1);
    }
}

class Link extends Container {
    constructor(href, text, args) {
        let attr = args ?? {};
        let children = text ?? href;
        let attr1 = mergeAttr(attr, {class: 'link'});
        super('a', children, attr1);
    }
}

class Image extends Element {
    constructor(src, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {src, class: 'image'});
        super('img', true, attr1);
    }
}

class Video extends Element {
    constructor(src, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {src, class: 'video'});
        super('video', true, attr1);
    }
}

class Bold extends Span {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'bold'});
        super(children, attr1);
    }
}

class Italic extends Span {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'italic'});
        super(children, attr1);
    }
}

class Strikeout extends Span {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'strikeout'});
        super(children, attr1);
    }
}

class Monospace extends Text {
    constructor(text, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'monospace'});
        super(text, attr1);
    }
}

class Reference extends Div {
    constructor(tag, args) {
        let attr = args ?? {};
        let link = new Link(`#${tag}`, `@${tag}`);
        let attr1 = mergeAttr(attr, {class: 'reference'});
        super(link, attr1);
    }

    // pull popup from context
    // html() {}
}

class Citation extends Div {
    constructor(tag, args) {
        let attr = args ?? {};
        let link = new Link('', `@@${tag}`);
        let attr1 = mergeAttr(attr, {class: 'citation'});
        super(link, attr1);
    }

    // pull popup from context
    // html() {}
}

class Footnote extends Div {
    constructor(children, args) {
        let attr = args ?? {};
        let link = new Link('', 'N');
        let attr1 = mergeAttr(attr, {class: 'footnote'});
        super(link, attr1);
    }

    // get number from context
    // html() {}
}

class Sidenote extends Div {
    constructor(children, args) {
        let attr = args ?? {};
        let link = new Link('', 'N');
        let attr1 = mergeAttr(attr, {class: 'sidenote'});
        super(link, attr1);
    }

    // get number from context
    // html() {}
}

class Math extends Element {
    constructor(tex, args) {
        let {display, multiline, ...attr} = args ?? {};
        display = display ?? false;
        let tag = display ? 'div' : 'span';
        let attr1 = mergeAttr(attr, {class: 'math'});
        super(tag, false, attr1);
        this.tex = this.multiline ? `\\begin{aligned}${tex}\\end{aligned}` : tex;
        this.display = display;
    }

    inner() {
        return katex.renderToString(this.tex, {displayMode: this.display, throwOnError: false});
    }
}

class Hash extends Link {
    constructor(tag, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'hash'});
        let href = `#${tag}`;
        super(href, attr1);
    }
}

class Newline extends Element {
    constructor(args) {
        super('br', true, args);
    }
}

class List extends Container {
    constructor(children, args) {
        let {ordered, ...attr} = args ?? {};
        let tag = ordered ? 'ol' : 'ul';
        children = children.map(i => new Container('li', i));
        super(tag, children, attr);
    }
}

function make_cell(cell, align=null, header=false) {
    let tag = header ? 'th' : 'td';
    let style = (align != null) ? `text-align: ${align}` : null;
    return new Container(tag, cell, {style});
}

// this takes a list of header elements, and a list of body elements, and optional align flags
class Table extends Container {
    constructor(head, body, args) {
        let {align, ...attr} = args ?? {};
        head = new Container('thead',
            new Container('tr',
                zip(head, align).map(([c, a]) => make_cell(c, a, true))
            )
        );
        body = new Container('tbody',
            body.map(r => new Container('tr',
                zip(r, align).map(([c, a]) => make_cell(c, a))
            ))
        );
        super('table', [head, body], attr);
    }
}

/**
 * Block Level Elements
 */

class Title extends Div {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'title'});
        super(children, attr1);
    }
}

class Heading extends Div {
    constructor(level, children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: `heading heading-${level}`});
        let num = new Counter(`heading-${level}`);
        super([num, ' ', ...children], attr1);
    }
}

class Rule extends Element {
    constructor(args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'rule'});
        super('hr', true, attr1);
    }
}

class Blockquote extends Div {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'blockquote'});
        super(children, attr1);
    }
}

class Code extends Element {
    constructor(children, args) {
        let {lang, ...attr} = args ?? {};
        let attr1 = mergeAttr(attr, {class: `code code-${lang}`});
        super('div', false, attr1);
        this.code = code;
        this.lang = lang ?? null;
    }

    // highlight here
    inner() {
        return this.code;
    }
}

class Svg extends Div {
    constructor(code, args) {
        let {number, width, ...attr} = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'svg', style: `width: ${width}%`});
        super(code, attr1);
    }
}

class Gum extends Div {
    constructor(code, args) {
        let {number, width, pixel, ...attr} = args ?? {};
        let gum = new GumWrap(code, {pixel});
        let attr1 = mergeAttr(attr, {class: 'gum', style: `width: ${width}%`});
        super(gum, attr1);
    }
}

class Upload extends Element {
    constructor(id, args) {
        let {gum} = args ?? {};
        super();
        this.id = id;
        this.gum = gum ?? false;
    }
}

class EnvBegin extends Container {
    constructor(name, args) {
        let {number} = args ?? {};
        super();
        this.name = name;
        this.number = number ?? true;
    }
}

class EnvSingle extends Container {
    constructor(name, args) {
        let {number} = args ?? {};
        super();
        this.name = name;
        this.number = number ?? true;
    }
}

class EnvEnd extends Container {
    constructor() {
        super();
    }
}
