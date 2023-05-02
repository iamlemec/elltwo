import katex from '../node_modules/katex/dist/katex.js';
import { props_repr, parseGum, SVG, Element as Element$1 } from '../node_modules/gum.js/js/gum.js';

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
        rargs = parseArgs(rargs);
        if (rargs.caption != null) {
            rargs.caption = parseInline(rargs.caption);
        }
        let args = {number: !pargs.includes('*'), ...rargs};
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
        let args = parseArgs(rargs);
        let title = parseInline(text);
        return new TitleBlock(title, args);
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
            out.push(mat);
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

class GumBox extends Element {
    constructor(code, args) {
        let {pixel} = args ?? {};
        super('div', false); // this is overridden
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

    html() {
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

class FigureCaption extends Div {
    constructor(caption, args) {
        let {ftype, title, ...attr} = args ?? {};
        ftype = ftype ?? 'figure';
        title = title ?? capitalize(ftype);
        let prefix = new Span([
            `${title} `, new Counter(ftype), ': ',
        ], {'class': 'caption-prefix'});
        let children = [prefix, ...caption];
        let attr1 = mergeAttr(attr, {'class': 'figure-caption'});
        super(children, attr1);
    }
}

/**
 * Inline Renderer
 */

class TextInline extends Element {
    constructor(text, args) {
        let attr = args ?? {};
        super('span', false, attr);
        this.text = text;
    }

    inner() {
        return this.text;
    }
}

class SpecialInline extends TextInline {
    constructor(acc, letter, args) {
        let attr = args ?? {};
        let text = special(acc, letter);
        let attr1 = mergeAttr(attr, {class: 'special-inline'});
        super(text, attr1);
    }
}

class EscapeInline extends TextInline {
    constructor(esc, args) {
        let attr = args ?? {};
        let text = escape_html(esc);
        let attr1 = mergeAttr(attr, {class: 'escape-inline'});
        super(text, attr1);
    }
}

class CommentInline extends TextInline {
    constructor(comm, args) {
        let attr = args ?? {};
        let text = `// ${comm}`;
        let attr1 = mergeAttr(attr, {class: 'comment-inline'});
        super(text, attr1);
    }
}

class LinkInline extends Container {
    constructor(href, text, args) {
        let attr = args ?? {};
        let children = text ?? [TextInline(href)];
        let attr1 = mergeAttr(attr, {class: 'link-inline'});
        super('a', children, attr1);
    }
}

class ImageInline extends Element {
    constructor(src, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {src, class: 'image-inline'});
        super('img', true, attr1);
    }
}

class BoldInline extends Container {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'bold-inline'});
        super('span', children, attr1);
    }
}

class ItalicInline extends Container {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'italic-inline'});
        super('span', children, attr1);
    }
}

class StrikeoutInline extends Container {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'strikeout-inline'});
        super('span', children, attr1);
    }
}

class CodeInline extends TextInline {
    constructor(text, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'code-inline'});
        super(text, attr1);
    }
}

class RefInline extends Element {
    constructor(tag) {
        super();
        this.tag = tag;
    }

    // pull this from context
    html() {
        return `<a href="#${this.tag}" class="ref-inline">#${this.tag}</a>`;
    }
}

class CiteInline extends Element {
    constructor(tag) {
        super();
        this.tag = tag;
    }

    // pull this from context
    html() {
        return `<a href="" class="cite-inline">@${this.tag}</a>`;
    }
}

class FootnoteInline extends Container {
    constructor(children) {
        super(children);
    }

    // get number from context
    html() {
        let inner = this.inner();
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
    html() {
        let inner = this.inner();
        let popup = `<div class="sidenote-popup">${inner}</div>`;
        return `<span class="sidenote-inline">N</span>\n${popup}\n`;
    }
}

class MathInline extends Element {
    constructor(tex, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'math-inline'});
        super('span', false, attr1);
        this.tex = tex;
    }

    inner() {
        return katex.renderToString(this.tex, {throwOnError: false});
    }
}

class HashInline extends LinkInline {
    constructor(tag, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'hash-inline'});
        let href = `#${tag}`;
        super(href, attr1);
    }
}

class NewlineInline extends Element {
    constructor(args) {
        super('br', true, args);
    }
}

class ListItemElement extends Container {
    constructor(children, args) {
        super('li', children, args);
    }
}

class ListElement extends Container {
    constructor(children, args) {
        let {ordered, ...attr} = args ?? {};
        let tag = ordered ? 'ol' : 'ul';
        super(tag, children, attr);
    }
}

/**
 * Block Renderer
 */

class Block extends Container {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'block'});
        super('div', children, attr1);
    }
}

class EmptyBlock extends Block {
    constructor(args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'empty-block'});
        super([], attr1);
    }
}

class TextBlock extends Block {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'text-block'});
        super(children, attr1);
    }
}

class CommentBlock extends Block {
    constructor(comm, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'comment-block'});
        let text = `// ${comm}`;
        super([text], attr1);
    }
}

class TitleBlock extends Block {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'title-block'});
        super(children, attr1);
    }
}

class HeadingBlock extends Block {
    constructor(level, children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: `heading-block heading-${level}`});
        let num = new Counter(`heading-${level}`);
        super([num, ' ', ...children], attr1);
    }
}

class RuleBlock extends Block {
    constructor() {
        let rule = new Element('hr', true);
        super([rule]);
    }
}

class QuoteBlock extends Block {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'quote-block'});
        super(children, attr1);
    }
}

class CodeBlock extends Block {
    constructor(children, args) {
        let {lang, ...attr} = args ?? {};
        let attr1 = mergeAttr(attr, {class: `code-block code-${lang}`});
        super(children, attr1);
        this.code = code;
        this.lang = lang ?? null;
    }

    // highlight here
    inner() {
        return this.code;
    }
}

class ListBlock extends Block {
    constructor(children, args) {
        let {ordered, ...attr} = args ?? {};
        let list = new ListElement(children, {ordered});
        let attr1 = mergeAttr(attr, {class: 'list-block'});
        super([list], attr1);
    }
}

class EquationBlock extends Block {
    constructor(tex, args) {
        let {number, multiline, ...attr} = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'equation-block'});
        super([], attr1);
        this.tex = tex;
        this.multiline = multiline ?? false;
    }

    inner() {
        let tex = this.multiline ? `\\begin{aligned}${this.tex}\\end{aligned}` : this.tex;
        return katex.renderToString(tex, {displayMode: true, throwOnError: false});
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

class SvgBlock extends Block {
    constructor(code, args) {
        let {number, caption, width, ...attr} = args ?? {};
        let sizer = new Div(code, {class: 'svg-sizer', style: `width: ${width}%`});
        let attr1 = mergeAttr(attr, {class: 'figure-block svg-block'});
        let children = [sizer];
        if (caption != null) {
            children.push(new FigureCaption(caption));
        }
        super(children, attr1);
    }
}

class GumBlock extends Block {
    constructor(code, args) {
        let {number, caption, width, pixel, ...attr} = args ?? {};
        let gum = new GumBox(code, {pixel});
        let sizer = new Div(gum, {class: 'gum-sizer', style: `width: ${width}%`});
        let attr1 = mergeAttr(attr, {class: 'figure-block gum-block'});
        let children = [sizer];
        if (caption != null) {
            children.push(new FigureCaption(caption));
        }
        super(children, attr1);
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

export { parseBlock, parseDocument, parseInline };
