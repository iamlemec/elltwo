/**
 *
 * a markdown+ to syntax tree parser
 * based on marked - https://github.com/chjj/marked
 *
 */

export { replace, parseArgs, escape_html, escape_latex }

/**
 * Block Parser
 */

let block = {
    empty: /^(\s*)$/,
    comment: /^\/\/ ?/,
    hrule: /^([-*_]){3,}\s*$/,
    heading: /^(#{1,6})(\*?) *(?:refargs)? *([^\n]+?)$/,
    lheading: /^([^\n]+)\n *(=|-){2,}\s*$/,
    blockquote: /^q*>\s*\n?/,
    code: /^``(\*)? *(?:refargs)?(?:\n)?(?: |\n)?/,
    equation: /^\$\$(\*&|&\*|\*|&)? *(?:refargs)?\s*/,
    title: /^#! *(?:refargs)?\s*([^\n]*)\s*/,
    upload: /^!!(gum)? *(?:refargs)?\s*$/,
    svg: /^\!(svg|gum)(\*)? *(?:refargs)?\s*/,
    image: /^!(yt|youtube)?(\*)? *(?:refargs)? *(?:\(href\))?\s*/,
    figtab: /^\| *(?:refargs)?\s*\n/,
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

// block prefix parser
function parsePrefix(pre) {
    return (pre ?? '').split('');
}

// variable argument parser (inside []'s)
function parseArgs(argsraw, number=true, set=true) {
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

/**
 * Block Parser
 */

function parseList(src) {
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

function parseTable(header, align, cells) {
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

function parseBiblio(id, text) {
    let bib = {};
    text.split('\n').forEach(function(line) {
        if (line.includes(':')) {
            let [key, val] = line.split(':', 1);
            bib[key.trim()] = val.trim();
        }
    });
    return this.renderer.biblio(id, bib);
}

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
        inner = parseInline(text);
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

    // svg
    if (cap = block.svg.exec(src)) {
        let [mat, sog, pargs, rargs] = cap;
        let mime = (sog == 'gum') ? 'image/svg+gum' : 'image/svg+xml';
        pargs = parsePrefix(pargs);
        let args = {
            number: !pargs.includes('*'),
            mime, ...parseArgs(rargs)
        };
        let code = src.slice(mat.length);
        return new SvgBlock(code, args);
    }

    // image
    if (cap = block.image.exec(src)) {
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
    if (cap = block.envend.exec(src)) {
        let text = src.slice(cap[0].length);
        let cont = this.inline.output(text);
        this.env = {
            type: 'env_end',
            args: {}
        };
        return this.renderer.envend(cont);
    }

    // lheading
    if (cap = block.lheading.exec(src)) {
        let [mat, body, bar] = cap;
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
        if (cap = inline.special.exec(src)) {
            [mat, acc, letter] = cap;
            out.push(new SpecialElement(acc, letter));
            src = src.substring(mat.length);
            continue;
        }

        // escape
        if (cap = inline.escape.exec(src)) {
            [mat, esc] = cap;
            out.push(new EscapeElement(esc));
            src = src.substring(mat.length);
            continue;
        }

        // math
        if (cap = inline.math.exec(src)) {
            [mat, tex] = cap;
            out.push(new MathElement(tex));
            src = src.substring(mat.length);
            continue;
        }

        // comment
        if (cap = inline.in_comment.exec(src)) {
            [mat, text] = cap;
            out.push(new CommentElement(text));
            src = src.substring(mat.length);
            continue;
        }

        // ref/cite
        if (cap = inline.refcite.exec(src)) {
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
        if (cap = inline.footnote.exec(src)) {
            [mat, pre, text] = cap;
            cls = (pre == '!') ? 'sidenote' : 'footnote';
            inner = parseInline(text);
            out.push(new cls(inner));
            src = src.substring(mat.length);
            continue;
        }

        // internal link
        if (cap = inline.ilink.exec(src)) {
            [mat, argsraw] = cap;
            args = parseArgs(argsraw, false, false);
            text = args.text || args.txt || args.t || '';
            inner = parseInline(text);
            out.push(new InternalLinkElement(inner, args));
            src = src.substring(mat.length);
            continue;
        }

        // autolink
        if (cap = inline.autolink.exec(src)) {
            [mat, href] = cap;
            out.push(new LinkElement(href));
            src = src.substring(mat.length);
            continue;
        }

        // url (gfm)
        if (!ctx.inLink && (cap = inline.url.exec(src))) {
            [mat, href] = cap;
            out.push(new LinkElement(href));
            src = src.substring(mat.length);
            continue;
        }

        // link
        if (cap = inline.link.exec(src)) {
            [mat, pre, text, href, title] = cap;
            [href, title] = [escape_html(href), escape_html(title)];
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
        if (cap = inline.strong.exec(src)) {
            [mat, text1, text2] = cap;
            text = text1 || text2;
            inner = parseInline(text);
            out.push(new BoldElement(inner));
            src = src.substring(mat.length);
            continue;
        }

        // hash
        if (cap = inline.hash.exec(src)) {
            [mat, text] = cap;
            tag = text.replace('[', '').replace(']', '');
            out.push(new HashElement(tag));
            src = src.substring(mat.length);
            continue;
        }

        // em
        if (cap = inline.em.exec(src)) {
            [mat, text1, text2] = cap;
            text = text1 || text2;
            inner = parseInline(text);
            out.push(new ItalicElement(inner));
            src = src.substring(mat.length);
            continue;
        }

        // code
        if (cap = inline.code.exec(src)) {
            [mat, delim, text] = cap;
            out.push(new CodeElement(text));
            src = src.substring(mat.length);
            continue;
        }

        // br
        if (cap = inline.br.exec(src)) {
            out.push(new NewlineElement());
            src = src.substring(mat.length);
            continue;
        }

        // del (gfm)
        if (cap = inline.del.exec(src)) {
            [mat, text] = cap;
            inner = parseInline(text);
            out.push(new StrikeoutElement(inner));
            src = src.substring(mat.length);
            continue;
        }

        // text
        if (cap = inline.text.exec(src)) {
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
 * Blocks
 */

class BlockElement {
    constructor() {
    }
}

class EmptyBlock extends BlockElement {
    constructor() {
        super();
    }
}

class TextBlock extends BlockElement {
    constructor(text) {
        super();
        this.text = text;
    }
}

class CommentBlock extends BlockElement {
    constructor(text) {
        super();
        this.text = text;
    }
}

class HeadingBlock extends BlockElement {
    constructor(level, text) {
        super();
        this.level = level;
        this.text = text;
    }
}

class RuleBlock extends BlockElement {
    constructor() {
        super();
    }
}

class QuoteBlock extends BlockElement {
    constructor(text) {
        super();
        this.text = text;
    }
}

class EquationBlock extends BlockElement {
    constructor(tex, args) {
        let {numbered, multiline} = args ?? {};
        super();
        this.tex = tex;
        this.numbered = numbered ?? true;
        this.multiline = multiline ?? false;
    }
}

class SvgBlock extends BlockElement {
    constructor(code, args) {
        let {width, pixel, numbered, caption} = args ?? {};
        super();
        this.code = code;
        this.numbered = numbered ?? true;
        this.caption = caption ?? null;
        this.width = width ?? null;
        this.pixel = pixel ?? null;
    }
}

class UploadBlock extends BlockElement {
    constructor(id, args) {
        let {gum} = args ?? {};
        super();
        this.id = id;
        this.gum = gum ?? false;
    }
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
 * Helpers
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
