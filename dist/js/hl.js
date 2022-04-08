import { replace, parseArgs } from './marked3.js';
import { gums } from '../node_modules/gum.js/js/gum.js';
import './render.js';
import './state.js';

/* random utilities */

/* HELPERS */

function s(text, cls) {
    return `<span class="syn_${cls}">${text}</span>`;
}

function esc_md(raw) {
    return raw.replace(/\\/g, '&#92;')
              .replace(/\//g, '&#47;')
              .replace(/\[/g, '&#91;')
              .replace(/\]/g, '&#93;')
              .replace(/\*/g, '&#42;')
              .replace(/\$/g, '&#36;')
              .replace(/\@/g, '&#36;')
              .replace(/\^/g, '&#94;')
              .replace(/\`/g, '&#96;')
              .replace(/\!/g, '&#33;');
}

function esc_html(raw, brace=true) {
    return raw.replace(/\</g, '&lt;')
             .replace(/\>/g, '&gt;')
}

function fArgs(argsraw, set=true) {
    let argmatch = /([\[\|\n\r])((?:[^\]\|\n\r]|(?<=\\)\||(?<=\\)\])*)/g;
    let illegal = /[^a-zA-Z\d\_\-]/;
    if (!set) {
        illegal = /[^a-zA-Z\d\_\-\:]/;
    }

    // match and parse inside args
    let args = argsraw.replace(argmatch, function(a, b, c) {
        c = c.split(/(?<!\\)\=/);
        if (c.length > 1) {
            let val = c.pop();
            let arg_val = s(syntaxParseInline(val), 'delimit');
            let arg_key = '';
            c.forEach(key => {
                if (illegal.test(key)) {
                    arg_key += s(key, 'err') + '=';
                } else if (key == 'id' && illegal.test(val)) {
                    arg_key += s(key, 'err') + '=';
                    arg_val = s(val, 'err');
                } else {
                    arg_key += s(key, 'math') + '=';
                }
            });
            return b + arg_key + arg_val;
        } else {
            let arg_key = (c[0]) ? s(c[0], 'math') : '';
            if (illegal.test(c[0])) {
                arg_key = s(c[0], 'err');
            }
            return b + arg_key;
        }
    });

    // swap out leading/trailing bracket highlight
    return args
}

// GUM

let jskeys = [
    'await', 'break', 'catch', 'class', 'const',
    'continue', 'do', 'else', 'eval', 'export', 'for',
    'function', 'if', 'import', 'let', 'return', 'switch',
    'throw', 'try', 'while', 'with', 'yield'
];

let boolean = ['true', 'false', 'null', 'undefined', 'new'];

let jschars = `\\|\\&\\>\\<\\!\\;\\.\\=\\:\\,\\(\\)\\{\\}\\[\\]`;

let rules = {
    newline: /^(\n)/,
    string: /^(['|"]+)\s*([\s\S]*?[^'"])\s*\1(?!['|"])/,
    jskey: /^(squish)(?=\s|[jschars]|$)/,
    bool: /^(squish)(?=\s|[jschars]|$)/,
    gumex: /^(squish)(?![a-zA-Z0-9_-])/,
    jschars: /^([jschars]+?)(?:\&\!)?/,
    space: /^\s+/,
    func: /^[\w]+(?=\(|\&\!)/,
    text: /^[\S]+?(?=[jschars]|\s|$)/,
};

rules.gumex = replace(rules.gumex)
    ('squish', gums.join('|'))
    ();

rules.jskey = replace(rules.jskey)
    ('squish', jskeys.join('|'))
    ();

rules.bool = replace(rules.bool)
    ('squish', boolean.join('|'))
    ();

rules.jschars = replace(rules.jschars)
    ('jschars', jschars)
    ();

rules.jskey = replace(rules.jskey)
    ('jschars', jschars)
    ();

rules.bool = replace(rules.bool)
    ('jschars', jschars)
    ();

rules.text = replace(rules.text)
    ('jschars', jschars)
    ();

class GumLexer {
    constructor(renderer, options={}) {
        this.renderer = renderer;
        this.options = options;
        this.rules = rules;
    }

    output(src) {
        let out = '',
            cap,
            key;

        let l1 = this.renderer.newline('');

        while (src) {

            // newline (for line numbers)
            if (cap = this.rules.newline.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.newline(cap[0]);
                continue;
            }

            // strings
            if (cap = this.rules.string.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.basic(cap[0], 'delimit');
                continue;
            }

            // gum builtin expressions
            if (cap = this.rules.gumex.exec(src)) {
                src = src.substring(cap[0].length);
                key = cap[1];
                out += this.renderer.basic(key, 'ref');
                continue;
            }

            //bool types and stuff
            if (cap = this.rules.bool.exec(src)) {
                src = src.substring(cap[0].length);
                key = cap[0];
                out += this.renderer.basic(key, 'hl');
                continue;
            }

            // js keywords
            if (cap = this.rules.jskey.exec(src)
                || this.rules.func.exec(src)) {
                src = src.substring(cap[0].length);
                key = cap[0];
                out += this.renderer.basic(key, 'math');
                continue;
            }

            // js chars, like = () {} etc
            if (cap = this.rules.jschars.exec(src)) {
                src = src.substring(cap[1].length);
                key = cap[1];
                out += this.renderer.basic(key, 'jschars');
                continue;
            }

            //tokens to do nothing with
            if (cap = this.rules.text.exec(src)
                || this.rules.space.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.nothing(cap[0]);
                continue;
            }

            if (src) {
                throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
            }
        }


        return l1 + out;
    }
}

class GumRenderer {
    constructor(options) {
        this.options = options ?? {};
    }

    basic(text, klass) {
        return s(text, klass);
    }

    newline(text) {
        return text + '<div class=linenum></div>';
    }

    nothing(text) {
        text = text.replace(/\n/g, '\n<div class=linenum></div>');
        return text;
    }
}

//// ELLTWO

let inline = {
    escape: /\\([\\/`*{}\[\]()#+\-.!_>\$])/g,
    cmd: /\\(\w+)/g,
    brac: /(\\*)([\{,\}])/g,
    url: /(https?):\/\/([^\s<]+[^<.,:;"')\]\s])/g,
    comment: /\/\/([^\n]*?)(\n|$)/g,
    code: /(`+)([\s\S\$]*?[^`])\1(?!`)/g,
    ftnt: /\^(\!)?\[((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*)\]/g,
    math: /\$((?:\\\$|[\s\S])+?)\$/g,
    ref: /@(\[([^\]]+)\])/g,
    cite: /@@(\[([^\]]+)\])/g,
    ilink: /\[\[([^\]]+)\]\]/g,
    link: /(!?)\[([^\]]+)\]\(([^\)]+)\)/g,
    em: /\*((?:\*\*|[\s\S])+?)\*(?!\*)/g,
    strong: /\*\*([\s\S]+?)\*\*(?!\*)/g,
    hash: /(?<!&)#(\[[\w| ]+\]|\w+)/g
};

function mathHL(raw) {
    raw = raw.replace(inline.brac, (a, b, c) => {
        b = b||"";
        return (b.length%2==0) ? b + s(c, 'hl') : a //even number of / is escaped
    }
        );

    raw = raw.replace(inline.cmd, (a, b) =>
        s('\\', 'hl') + s(esc_md(b), 'comment_head')
    );

    return raw
}

function syntaxParseInline(raw) {
    let endmath = '';

    let dollars = [...raw.matchAll(/(\\*)\$/g)] || []; // match dollars
    dollars = dollars.filter(x => (x[0].length%2==1)); // filter out escaped dollars
    if (dollars.length % 2 == 1) {
        let ld = dollars.pop().index + 1;
        endmath = raw.substring(ld);
        raw = raw.substring(0,ld-1);
        endmath = esc_html(endmath);
        endmath = s('$', 'delimit') + s(mathHL(endmath), 'math');
    }

    let html = esc_html(raw);

    html = html.replace(inline.escape, (a, b) =>
        s('\\', 'comment_head') + s(esc_md(b), 'comment')
    );

    html = html.replace(inline.url, (a, b, c) =>
        s(b, 'hl') + ':' + s('&#47;&#47;', 'math') + s(c.replace(/\//g, s('/', 'math')), 'comment')
    );

    html = html.replace(inline.comment, (a, b, c) =>
        s('//', 'comment_head') + s(b, 'comment') + c
    );

    html = html.replace(inline.code, (a, b, c) =>
        s(b, 'comment_head') + s(c, 'code') + s(b, 'comment_head')
    );

    html = html.replace(inline.ftnt, (a, b, c) => {
        if (b) {
            return s('^!', 'hl') + s('[', 'delimit') + c + s(']', 'delimit');
        } else {
            return s('^[', 'delimit') + c + s(']', 'delimit');
        }
    });

    html= html.replace(inline.math, (a, b) => {
        b = mathHL(b);
        return s('$', 'delimit') + s(b, 'math') + s('$', 'delimit')
    });

    html = html.replace(inline.cite, (a, b) =>
        s('@@', 'delimit') + s(fArgs(b, false), 'ref')
    );

    html = html.replace(inline.ref, (a, b) =>
        s('@', 'delimit') + s(fArgs(b, false), 'ref')
    );

    html = html.replace(inline.ilink, (a, b) =>
        s('[[', 'delimit') + s(b, 'ref') + s(']]', 'delimit')
    );

    html = html.replace(inline.link, (a, b, c, d) =>
        s(b, 'delimit')
        + s('[', 'ref') + s(c, 'math') + s(']', 'ref')
        + s('(', 'ref') + s(d, 'math') + s(')', 'ref')
    );

    // escape so we don't highlight these on italics
    html = html.replace(inline.strong, (a, b) =>
        s('&#42;&#42;', 'comment_head') + b + s('&#42;&#42;', 'comment_head')
    );

    html = html.replace(inline.em, (a, b) =>
        s('*', 'delimit') + b + s('*', 'delimit')
    );

    html = html.replace(inline.hash, (a, b) => {
        b = b.replace('[', s('[', 'delimit'))
             .replace(']', s(']', 'delimit'));
        return s('#', 'ref') + b
        }
    );

    return html + endmath;
}

function syntaxParsePre(raw){

let html = esc_html(raw);

    html = html.replace(/\#(\w+)/g, (a, b) =>
        s('#', 'ref') + s(b, 'math')
    );
    html = html.replace(/([\\\w]+):([\\\w]+)/g, (a,b,c) =>
        s(b, 'ref') + s(':', 'delimit') + s(c, 'ref')
    );

    return html

}

// uses lookbehinds, might not work on old ass-browsers
// set = true is for non ref when seting ids

let block = {
    title: /^#!( *)(?:refargs)?(\s*)([^\n]*)(\s*)/,
    heading: /^(#{1,6})(\*?)( *)(?:refargs)?(\s*)([^\n]*)$/,
    code: /^``(\*)?( *)(?:refargs)?((\s|\n)?)/,
    comment: /^\/\/( ?)/,
    equation: /^\$\$(\*?)( *)(?:refargs)?(\s*)/,
    image: /^(!{1,2})(yt|youtube)?(\*)?( *)(?:refargs)?( *)(\()?([\w-:#/.&%=]*)(\))?(\s*)$/,
    svg: /^\!(svg|gum)(\*)?( *)(?:refargs)?/,
    figtab: /^\|( *)(?:refargs)?/,
    envbeg: /^\>\>(\!)?( *)([\w-]+)(\*)?( *)(?:refargs)?/,
    envend: /^\<\<( ?)/,
};

block._refargs = /(\[(?:[^\]]|(?<=\\)\])*\]?)/;

block.title = replace(block.title)
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
block.image = replace(block.image)
    ('refargs', block._refargs)
    ();
block.svg = replace(block.svg)
    ('refargs', block._refargs)
    ();
block.figtab = replace(block.figtab)
    ('refargs', block._refargs)
    ();
block.envbeg = replace(block.envbeg)
    ('refargs', block._refargs)
    ();

function syntaxParseBlock(raw) {
    let cap;

    if (cap = block.title.exec(raw)) {
        let id = cap[2] ? s(fArgs(cap[2]), 'ref') : '';
        let tit = cap[4] ? syntaxParseInline(cap[4]) : '';
        let rest = raw.slice(cap[0].length);
        let pre = syntaxParsePre(rest);
        return s('#!', 'hl') + cap[1] + id + cap[3] + tit + cap[5] + s(pre, 'ref');
    }

    if (cap = block.heading.exec(raw)) {
        let star = cap[2] ? s(cap[2], 'hl') : '';
        let id = cap[4] ? s(fArgs(cap[4]), 'ref') : '';
        let text = cap[6] ? syntaxParseInline(cap[6]) : '';
        return s(cap[1], 'delimit') + star + cap[3] + id + cap[5] + text;
    }

    if (cap = block.code.exec(raw)) {
        let star = cap[1] ? s(cap[1], 'hl') : '';
        let id = cap[3] ? s(fArgs(cap[3]), 'ref') : '';
        let rest = raw.slice(cap[0].length);
        let text = rest;
        if(cap[3]){
            let lang = parseArgs(cap[3].slice(1,-1))['lang'] || null;
            text = SyntaxHL(rest, lang);
        }
        return s('``', 'delimit') + star + cap[2] + id + cap[4] + text;
    }

    if (cap = block.comment.exec(raw)) {
        let space = cap[1] || '';
        let rest = raw.slice(cap[0].length);
        let text = esc_html(rest);
        return s('//', 'comment_head') + space + s(text, 'comment');
    }

    if (cap = block.equation.exec(raw)) {
        let star = cap[1] ? s(cap[1], 'hl') : '';
        let id = cap[3] ? s(fArgs(cap[3]), 'ref') : '';
        let rest = raw.slice(cap[0].length);
        rest = esc_html(rest);
        rest = mathHL(rest);
        return s('$$', 'delimit') + star + cap[2] + id + cap[4] + s(rest, 'math');
    }

    if (cap = block.image.exec(raw)) {
        let excl = cap[1] ? s(cap[1], 'hl') : '';
        let yt = cap[2] ? s(cap[2], 'math') : '';
        let star = cap[3] ? s('*', 'hl') : '';
        let id = cap[5] ? s(fArgs(cap[5]), 'ref'): '';
        let l = cap[7] ? s('(', 'delimit') : '';
        let href = cap[8] ? s(cap[8], 'hl') : '';
        let r = cap[9] ? s(')', 'delimit') : '';
        return excl + yt + star + cap[4] + id + cap[6] + l + href + r + cap[10];
    }

    if (cap = block.svg.exec(raw)) {
        let mime = cap[1];
        let star = cap[2] ? s('*', 'hl') : '';
        let id = cap[4] ? s(fArgs(cap[4]), 'ref') : '';
        let rest = raw.slice(cap[0].length);
        let text = '';
        if (mime == 'gum') {
            text = SyntaxHL(rest, 'gum');
        } else {
            text = SyntaxHL(rest, 'svg');
        }
        return s('!', 'hl') + s(mime, 'math') + star + cap[3] + id + text;
    }

    if (cap = block.figtab.exec(raw)) {
        let id = cap[2] ? s(fArgs(cap[2]), 'ref') : '';
        let rest = raw.slice(cap[0].length);
        return s('|', 'hl') + cap[1] + id + rest;
    }

    if (cap = block.envbeg.exec(raw)) {
        let bang = cap[1] ? s('!', 'hl') : '';
        let env = cap[3] ? s(cap[3], 'ref') : '';
        let star = cap[4] ? s(cap[4], 'hl') : '';
        let id = cap[6] ? s(fArgs(cap[6]), 'ref'): '';
        let rest = raw.slice(cap[0].length);
        let text = syntaxParseInline(rest);
        return s('>>', 'delimit') + bang + cap[2] + env + star + cap[5] + id + text;
    }

    if (cap = block.envend.exec(raw)) {
        let space = cap[1] || '';
        let rest = raw.slice(cap[0].length);
        let text = syntaxParseInline(rest);
        return s('<<', 'delimit') + space + text;
    }

    return syntaxParseInline(raw);
}

let SVGrules = {
    opentag: /\&lt;(\w+)?/g,
    closetag: /(\/)?(\w+)?\&gt;/g,
    attr: /(\s)(\w+)?\=/g,
    newline: /(\n)/g,
};

function shittySVG(raw) {
    raw = esc_html(raw, false);
    let n = `<div class=linenum></div>`;

    raw = raw.replace(SVGrules.attr, (a, b, c) => {
        c = c ? c : "";
        return b + s(c, 'math') + s('=', 'delimit');
    });
    raw = raw.replace(SVGrules.opentag, (a, b) => {
        b = b ? b : "";
        return s('&lt;', 'delimit') + s(b, 'ref');
    });
    raw = raw.replace(SVGrules.closetag, (a, b, c) => {
        b = b ? s('/', 'hl') : "";
        c = c ? s(c, 'ref') : "";
        return b + c + s('\&gt;', 'delimit');
    });
    raw = raw.replace(SVGrules.newline, (a) => {
        return n + '\n';
    });
    return n + raw;
}

/// BRACE MATACH

function braceMatch(text, cpos) {
    let delimit = {'(': ')', '[': ']', '{': '}'};
    let rev_delimit = {')': '(', ']': '[', '}': '{'};

    let after = text[cpos];
    let before = text[cpos-1] || false;
    let pos;

    if (after in delimit) {
        pos = getBracePos(text, after, delimit[after], cpos);
    } else if (before in delimit) {
        pos = getBracePos(text, before, delimit[before], cpos-1);
    } else if (before in rev_delimit) {
        pos = getBracePos(text, before, rev_delimit[before], cpos, true);
    } else if (after in rev_delimit) {
         pos = getBracePos(text, after, rev_delimit[after], cpos+1, true);
    } else {
        $('.brace').contents().unwrap();
        return null;
    }

    if (pos) {
        return braceHL(text, pos);
    } else {
        return null;
    }
}

function getBracePos(text, brace, match, cpos, rev=false) {
    let len = text.length;
    if (rev) {
        text = text.split('').reverse().join('');
        cpos = len - cpos;
    }

    let z = 1;
    let pos = cpos;
    let char;

    while (true) {
        pos += 1;
        if (pos <= len) {
            char = text[pos];
            if (char == brace) {
                z += 1;
            } else if (char == match) {
                z -= 1;
            }
            if (z == 0) {
                break;
            }
        } else {
            if (!rev) {
                return false;
            } else {
                break;
            }
        }
    }

    if (rev) {
        return {'l': Math.max(0, len - pos - 1), 'r': len - cpos - 1};
    } else {
        return {'l': cpos, 'r': pos};
    }
}

function braceHL(text, pos) {
    let new_text = [
        text.slice(0, pos['l']),
        `<span class='brace'>`,
        text.slice(pos['l'], pos['r']+1),
        `</span>`,
        text.slice(pos['r']+1)
    ].join('');

    return new_text;
}

function jsHL(src) {
    let renderer = new GumRenderer();
    let lexer = new GumLexer(renderer);
    return lexer.output(src);
}

let HLs =  {
    'gum': jsHL,
    'js': jsHL,
    'svg': shittySVG,
    'elltwo': syntaxParseBlock,
    'elltwoInline': syntaxParseInline,
};

function SyntaxHL(src, hl=null) {
    let syn = HLs[hl] ?? esc_html;
    return syn(src);
}

export { SyntaxHL, braceMatch, esc_html, s };
