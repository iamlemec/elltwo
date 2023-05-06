import katex from '../node_modules/katex/dist/katex.js';
import { props_repr, zip, parseGum, SVG, Element as Element$1 } from '../node_modules/gum.js/js/gum.js';

/**
 *
 * a markdown+ to syntax tree parser
 * based on marked - https://github.com/chjj/marked
 *
 */

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
};

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
    figtab: /^\!tab(\*)? *(?:refargs)?\s*\n(?:table)/,
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
    let blocks = src.trim().split(/\n{2,}/).map(parseBlock);
    blocks = blocks.map(b => new Block(b));
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
    let rx = /[^a-zA-Z\d\_\-]/; // invalid chars for arg labels and id's

    if (!set) {
        rx = /[^a-zA-Z\d\_\-\:]/; // allow : for references
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
        parseInline(text);
        return new Block([]);
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
        return new Equation(text, args);
    }

    // svg/gum
    if (cap = block.svg.exec(src)) {
        let [mat, sog, pargs, rargs] = cap;
        let cls = (sog == 'gum') ? Gum : Svg;
        pargs = parsePrefix(pargs);
        let number = !pargs.includes('*');
        let {id, caption, ...args} = parseArgs(rargs);
        caption = parseInline(caption);
        let code = src.slice(mat.length);
        let child = new cls(code, args);
        return new Figure(child, {id, caption, number});
    }

    // table
    if (cap = block.figtab.exec(src)) {
        let [_, pargs, rargs, header, align, cells] = cap;
        pargs = parsePrefix(pargs);
        let number = !pargs.includes('*');
        let {id, caption, ...args} = parseArgs(rargs);
        caption = parseInline(caption);
        let table = parseTable(header, align, cells, args);
        return new Figure(table, {id, caption, number, ftype: 'table'});
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
 * Inline Parser
 */

// parse markdown into `Element`s
function parseInline(src) {
    if (src == null) {
        return null;
    }

    let cap, out = [];
    while (src) {
        // detect empty early
        if (src.length == 0) {
            break;
        }

        // special
        if (cap = inline.special.exec(src)) {
            let [mat, acc, letter] = cap;
            out.push(new Special(acc, letter));
            src = src.substring(mat.length);
            continue;
        }

        // escape
        if (cap = inline.escape.exec(src)) {
            let [mat, esc] = cap;
            out.push(new Escape(esc));
            src = src.substring(mat.length);
            continue;
        }

        // math
        if (cap = inline.math.exec(src)) {
            let [mat, tex] = cap;
            out.push(new Math(tex));
            src = src.substring(mat.length);
            continue;
        }

        // comment
        if (cap = inline.in_comment.exec(src)) {
            let [mat, text] = cap;
            out.push(new Comment(text));
            src = src.substring(mat.length);
            continue;
        }

        // ref/cite
        if (cap = inline.refcite.exec(src)) {
            let [mat, pre, rargs] = cap;
            let cls = (pre == '@') ? Reference : Citation;
            let {id, ...args} = parseArgs(rargs, false, false);
            out.push(new cls(id, args));
            src = src.substring(mat.length);
            continue;
        }

        // footnote/sidenote
        if (cap = inline.footnote.exec(src)) {
            let [mat, pre, text] = cap;
            let cls = (pre == '!') ? Sidenote : Footnote;
            let inner = parseInline(text);
            out.push(new cls(inner));
            src = src.substring(mat.length);
            continue;
        }

        // internal link
        if (cap = inline.ilink.exec(src)) {
            let [mat, rargs] = cap;
            let {id, ...args} = parseArgs(rargs, false, false);
            let inner = parseInline(id);
            out.push(new Link(inner, args));
            src = src.substring(mat.length);
            continue;
        }

        // autolink
        if (cap = inline.autolink.exec(src)) {
            let [mat, href] = cap;
            out.push(new Link(href));
            src = src.substring(mat.length);
            continue;
        }

        // url (gfm)
        if (cap = inline.url.exec(src)) {
            let [mat, href] = cap;
            out.push(new Link(href));
            src = src.substring(mat.length);
            continue;
        }

        // link
        if (cap = inline.link.exec(src)) {
            let [mat, pre, text, href, title] = cap;
            [href, title] = [escape_html(href), escape_html(title)];
            let elem;
            if (pre == '!') {
                elem = new Image(href, text);
            } else {
                inner = parseInline(text);
                elem = new Link(href, inner);
            }
            out.push(elem);
            src = src.substring(mat.length);
            continue;
        }

        // strong
        if (cap = inline.strong.exec(src)) {
            let [mat, text1, text2] = cap;
            let text = text1 || text2;
            let inner = parseInline(text);
            out.push(new Bold(inner));
            src = src.substring(mat.length);
            continue;
        }

        // hash
        if (cap = inline.hash.exec(src)) {
            let [mat, text] = cap;
            let tag = text.replace('[', '').replace(']', '');
            out.push(new Hash(tag));
            src = src.substring(mat.length);
            continue;
        }

        // em
        if (cap = inline.em.exec(src)) {
            let [mat, text1, text2] = cap;
            let text = text1 || text2;
            let inner = parseInline(text);
            out.push(new Italic(inner));
            src = src.substring(mat.length);
            continue;
        }

        // code
        if (cap = inline.code.exec(src)) {
            let [mat, delim, text] = cap;
            out.push(new Monospace(text));
            src = src.substring(mat.length);
            continue;
        }

        // del (gfm)
        if (cap = inline.del.exec(src)) {
            let [mat, text] = cap;
            let inner = parseInline(text);
            out.push(new Strikeout(inner));
            src = src.substring(mat.length);
            continue;
        }

        // br
        if (cap = inline.br.exec(src)) {
            out.push(new Newline());
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

class DefaultCounter {
    constructor() {
        this.values = new Map();
    }

    inc(key) {
        let val = !this.values.has(key) ? 1 : this.values.get(key) + 1;
        this.values.set(key, val);
        return val;
    }

    get(key) {
        return this.values.get(key);
    }
}

/**
 * Core Elements
 */

class Context {
    constructor() {
        this.count = new DefaultCounter();
        this.refer = new Map();
        this.popup = new Map();
    }

    incNum(key) {
        return this.count.inc(key);
    }

    getNum(key) {
        return this.count.get(key);
    }

    addRef(id, label) {
        this.refer.set(id, label);
    }

    getRef(id) {
        return this.refer.get(id);
    }

    hasRef(id) {
        return this.refer.has(id);
    }

    addPop(id, elem) {
        this.popup.set(id, elem);
    }

    getPop(id) {
        return this.popup.get(id);
    }

    hasPop(id) {
        return this.popup.has(id);
    }
}

class Element {
    constructor(tag, unary, attr) {
        this.tag = tag ?? 'div';
        this.unary = unary ?? false;
        this.attr = attr ?? {};
    }

    refs(ctx) {
    }

    props(ctx) {
        return this.attr;
    }

    inner(ctx) {
        return '';
    }

    html(ctx) {
        // collect all properties
        let pvals = this.props(ctx);
        let props = props_repr(pvals);
        let pre = props.length > 0 ? ' ' : '';

        // return final html
        if (this.unary) {
            return `<${this.tag}${pre}${props} />`;
        } else {
            let ivals = this.inner(ctx);
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

    refs(ctx) {
        this.children.forEach(c => (c instanceof Element) ? c.refs(ctx) : null);
    }

    inner(ctx) {
        return this.children.map(c => (c instanceof Element) ? c.html(ctx) : c).join('');
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
        let ctx = new Context();
        this.refs(ctx);
        return this.inner(ctx);
    }
}

/**
 * gum.js and katex bridges
 */

// this will return an Element or String
// contingent upon the idiotic number of possible return types
class GumWrap extends Element {
    constructor(code, args) {
        let {pixel} = args ?? {};
        super('svg', false); // this is overridden
        try {
            this.gum = parseGum(code);
            if (this.gum instanceof SVG) {
            } else if (this.gum instanceof Element$1) {
                this.gum = new SVG(this.gum, {pixel});
            }
        } catch (err) {
            this.gum = new Span(err.message, {class: 'gum-error'});
        }
    }

    html(ctx) {
        if (this.gum instanceof Element$1) {
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

    html(ctx) {
        return katex.renderToString(this.tex, {displayMode: this.display, throwOnError: false});
    }
}

/**
 * Numbering
 */

// handles counters for footnotes/equations/figures
class Number extends Element {
    constructor(name, args) {
        let {title, id, bare} = args ?? {};
        super('span', false, {class: 'number'});
        this.name = name;
        this.title = title;
        this.id = id;
        this.bare = bare ?? true;
    }

    refs(ctx) {
        if (this.title == null) {
            this.num = ctx.incNum(this.name);
            let title = capitalize(this.name);
            this.label = `${title} ${this.num}`;
        } else {
            this.label = this.title;
        }
        if (this.id != null) {
            ctx.addRef(this.id, this.label);
        }
    }

    inner(ctx) {
        return this.bare ? this.num : this.label;
    }
}

class NestedNumber extends Element {
    constructor(name, level, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'nested-number'});
        super('span', false, attr1);
        this.name = name;
        this.level = level;
    }

    refs(ctx) {
        let acc = [];
        let tag = this.name;
        for (let i = 1; i < this.level; i++) {
            let num = ctx.getNum(tag) ?? 0;
            acc.push(num);
            tag = `${tag}-${num}`;
        }
        let fin = ctx.incNum(tag);
        acc.push(fin);
        this.num = acc.join('.');
    }

    inner(ctx) {
        return this.num;
    }
}

/* Figures and Equations */

class Caption extends Div {
    constructor(caption, args) {
        let {ftype, title, number, id, ...attr} = args ?? {};
        ftype = ftype ?? 'figure';
        let children = caption;
        if (number) {
            let counter = new Number(ftype, {title, id, bare: false});
            children.unshift(counter, ': ');
        }
        let attr1 = mergeAttr(attr, {'class': 'caption'});
        super(children, attr1);
    }
}

class Figure extends Div {
    constructor(child, args) {
        let {ftype, title, id, number, caption, ...attr} = args ?? {};
        ftype = ftype ?? 'figure';
        caption = (caption != null) ? new Caption(caption, {ftype, title, number, id}) : null;
        let attr1 = mergeAttr(attr, {'class': ftype, id});
        super([child, caption], attr1);
        this.id = id;
    }

    refs(ctx) {
        super.refs(ctx);
        if (this.id != null) {
            ctx.addPop(this.id, this);
        }
    }
}

class Equation extends Div {
    constructor(tex, args) {
        let {multiline, number, id, tag, ...attr} = args ?? {};
        let math = new Math(tex, {multiline, display: true});
        let num = (number != null) ? new Number('equation', {title: tag, id}) : null;
        let attr1 = mergeAttr(attr, {class: 'equation', id});
        super([math, num], attr1);
        this.id = id;
        this.math = math;
    }

    refs(ctx) {
        super.refs(ctx);
        if (this.id != null) {
            ctx.addPop(this.id, this.math);
        }
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

    inner(ctx) {
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
        let attr1 = mergeAttr(attr, {href, class: 'link'});
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

class Reference extends Element {
    constructor(id, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'reference'});
        super('a', false, attr1);
        this.id = id;
    }

    // pull ref/popup from context
    html(ctx) {
        let targ = ctx.hasPop(this.id) ? ctx.getPop(this.id).html() : '';
        if (ctx.hasRef(this.id)) {
            let ref = ctx.getRef(this.id);
            let pop = targ ? `<div class="popup">${targ}</div>` : '';
            return `<span class="popper"><a href="#${this.id}" class="reference">${ref}</a>${pop}</span>`;
        } else {
            return `<a class="reference fail">@${this.id}</a>`;
        }
    }
}

class Citation extends Div {
    constructor(tag, args) {
        let attr = args ?? {};
        let link = new Link('', `@@${tag}`);
        let attr1 = mergeAttr(attr, {class: 'citation'});
        super(link, attr1);
    }

    // pull ref/popup from context
    // html(ctx) {}
}

class Popup extends Div {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'popup'});
        super(children, attr1);
    }
}

class Sidebar extends Div {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'sidebar'});
        super(children, attr1);
    }
}

class Footnote extends Span {
    constructor(children, args) {
        let attr = args ?? {};
        let num = new Number('footnote');
        let pop = new Popup(children);
        let attr1 = mergeAttr(attr, {class: 'footnote popper'});
        super([num, pop], attr1);
    }
}

class Sidenote extends Span {
    constructor(children, args) {
        let attr = args ?? {};
        let num = new Number('footnote');
        let pop = new Sidebar(children);
        let attr1 = mergeAttr(attr, {class: 'sidenote'});
        super([num, pop], attr1);
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
        let num = new NestedNumber('heading', level);
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
    constructor(code, args) {
        let {lang, ...attr} = args ?? {};
        let attr1 = mergeAttr(attr, {class: `code code-${lang}`});
        super('div', false, attr1);
        this.code = code;
        this.lang = lang ?? null;
    }

    // highlight here
    inner(ctx) {
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

export { parseBlock, parseDocument, parseInline };
