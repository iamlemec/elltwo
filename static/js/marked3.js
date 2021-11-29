/**
 *
 * marked3 - a markdown+ parser
 * based on marked - https://github.com/chjj/marked
 *
 */

export { markthree, replace, divInlineLexer, }

import {SyntaxHL} from'./hl.js'


/**
 * Block-Level Grammar
 */

let block = {
    empty: /^(\s*)$/,
    comment: /^\/\/ ?/,
    hr: /^([-*_]){3,}\s*$/,
    heading: /^(#{1,6})(\*?) *(?:refargs)? *([^\n]+?)$/,
    lheading: /^([^\n]+)\n *(=|-){2,}\s*$/,
    blockquote: /^q*> ?\n?/,
    code: /^``(\*)? *(?:refargs)?(?:\n)?(?: |\n)?/,
    equation: /^\$\$(\*&|&\*|\*|&)? *(?:refargs)?\s*/,
    title: /^#! *(?:refargs)?\s*([^\n]*)\s*/,
    upload: /^!! *(?:refargs)?\s*$/,
    svg: /^\!(svg|gum)(\*)? *(?:refargs)?\s*/,
    image: /^!(\*)? *(?:refargs)? *\(href\)\s*$/,
    imagelocal: /^!(\*)? *(?:refargs)\s*$/,
    // biblio: /^@@ *(?:refid)\s*/,
    figtab: /^@\| *(?:refargs) *\n(?:table)/,
    envbeg: /^\>\>(\!)? *([\w-]+)(\*)? *(?:refargs)?\s*/,
    envend: /^\<\<\s*/,
    fences: /^(?:`{3,}|~{3,})\ ?(\S+)?\s*/,
    list: /^((?: *(?:bull) [^\n]*(?:\n|$))+)\s*$/,
    table: /^\|([^\n]+)\| *\n *\|( *[-:]+[-| :]*)\| *\n((?: *\|[^\n]*\| *(?:\n|$))*)\s*$/,
};

block._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;
block._refid = /\[([\w-]+)\]/;
// block._refargs = /(?:\[([\w-\|\=\s\.\?\!\$]+)\])/;
block._refargs = /(?:\[((?:[^\]]|(?<=\\)\])*)\])/;

block._bull = /(?:[*+-]|\d+\.)/;
block._item = /^( *)(bull) ?/;

block.image = replace(block.image)
    ('refargs', block._refargs)
    ('href', block._href)
    ();

block.upload = replace(block.upload)
    ('refargs', block._refargs)
    ();

block.imagelocal = replace(block.imagelocal)
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

/*
block.biblio = replace(block.biblio)
    ('refid', block._refid)
    ();
*/

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
 * Args Parser
 */

function parseArgs(argsraw, number=true, set=true) {
    if (!argsraw) {
        return {
            'number': number
        };
    }

    let fst;
    let args = {};
    let rx = /[^a-zA-Z\d\_\-]/ //invalid chars for arg labels and id's

    if (!set) {
        rx = /[^a-zA-Z\d\_\-\:]/ //allow : for references
    }

    // using lookbehinds, might not work on old browsers.
    argsraw.split(/(?<!\\)\||\n/)
           .map(x => x.split(/(?<!\\)\=/))
           .filter(x => x.length > 1)
           .forEach(x => {
               let val = x.pop();
               x.forEach(key => {
                   if (!rx.test(key)) {
                       args[key] = val;
                   }
               });
           });

    // if ((Object.keys(args).length==0) && argsraw) {
    //     args['id'] = argsraw;
    // }

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

/**
 * Block Lexer
 */

class Lexer {
    constructor(options) {
        this.options = options || defaults;
        this.rules = block;
    }

    lex(src) {
        src = src
            .replace(/\r\n|\r/g, '\n')
            .replace(/\t/g, '    ')
            .replace(/\u00a0/g, ' ')
            .replace(/\u2424/g, '\n');

        return this.token(src);
    }

    parseBiblio(id, text) {
        let bib = {
            type: 'biblio',
            id: id,
        };

        let lines = text.split('\n');
        let line, kv, key, val, i;

        for (i in lines) {
            line = lines[i];
            if (line.includes(':')) {
                kv = lines[i].split(':');
                key = kv[0];
                val = kv.slice(1).join(':').trim();
                bib[key] = val;
            }
        }

        return bib;
    }

    parseTable(header, align, cells) {
        let item = {
            type: 'table',
            header: header.replace(/^ *| *\| *$/g, '').split(/ *\| */),
            align: align.replace(/^ *|\| *$/g, '').split(/ *\| */),
            cells: cells.replace(/(?: *\| *)?\n$/, '').split('\n')
        };

        let i;

        for (i = 0; i < item.align.length; i++) {
            if (/^ *-+: *$/.test(item.align[i])) {
                item.align[i] = 'right';
            } else if (/^ *:-+: *$/.test(item.align[i])) {
                item.align[i] = 'center';
            } else if (/^ *:-+ *$/.test(item.align[i])) {
                item.align[i] = 'left';
            } else {
                item.align[i] = null;
            }
        }

        for (i = 0; i < item.cells.length; i++) {
            item.cells[i] = item.cells[i]
                .replace(/^ *\| *| *\| *$/g, '')
                .split(/ *\| */);
        }

        return item;
    }

    parseList(items) {
        let list = {
            type: 'list',
            ordered: true,
            items: items.split('\n').filter(x => x.length > 0)
        };

        let i, text, ret;

        for (i = 0; i < list.items.length; i++) {
            text = list.items[i];
            ret = block._item.exec(text);
            list.items[i] = text.slice(ret[0].length);
            list.ordered &&= (ret[2].length > 1);
        }

        return list;
    }

    token(src) {
        src = src.replace(/^ +$/gm, '');
        let cap
          , number
          , multi
          , vargs
          , argsraw
          , args
          , text
          , i;

          // empty cell
          if (cap = this.rules.empty.exec(src)) {
              return {
                  type: 'empty',
                  text: cap[1]
              };
          }

          // equation
          if (cap = this.rules.equation.exec(src)) {
              vargs = cap[1] || '';
              argsraw = cap[2] || '';
              number = !vargs.includes('*');
              multi = vargs.includes('&');
              args = parseArgs(argsraw, number);
              args.multiline = multi;
              text = src.slice(cap[0].length);
              return {
                  type: 'equation',
                  args: args,
                  tex: text
              };
          }

          // image
          if (cap = this.rules.image.exec(src)) {
              number = cap[1] == undefined;
              argsraw = cap[2] || '';
              args = parseArgs(argsraw, number);
              return {
                  type: 'image',
                  args: args,
                  href: cap[3]
              };
          }

          // imagelocal
          if (cap = this.rules.imagelocal.exec(src)) {
              number = cap[1] == undefined;
              argsraw = cap[2] || '';
              args = parseArgs(argsraw, number);
              return {
                  type: 'imagelocal',
                  args: args,
              };
          }

          // upload
          if (cap = this.rules.upload.exec(src)) {
              argsraw = cap[1] || '';
              args = parseArgs(argsraw);
              return {
                  type: 'upload',
                  args: args,
              };
          }

          // figure table
          if (cap = this.rules.figtab.exec(src)) {
              argsraw = cap[1] || '';
              args = parseArgs(argsraw);
              let table = this.parseTable(cap[2], cap[3], cap[4]);
              return {
                  type: 'figtab',
                  args: args,
                  table: table
              };
          }

          // bibliographic info
          /*
          if (cap = this.rules.biblio.exec(src)) {
              text = src.slice(cap[0].length);
              return this.parseBiblio(cap[1], text);
          }
          */

          // comment
          if (cap = this.rules.comment.exec(src)) {
              text = src.slice(cap[0].length);
              return {
                  type: 'comment',
                  text: text
              };
          }

          // code fence
          if (cap = this.rules.fences.exec(src)) {
              text = src.slice(cap[0].length);
              return {
                  type: 'code',
                  lang: cap[1],
                  text: text
              };
          }

          // code
          if (cap = this.rules.code.exec(src)) {
              vargs = cap[1] || '';
              argsraw = cap[2] || '';
              number = !vargs.includes('*');
              args = parseArgs(argsraw);
              text = src.slice(cap[0].length);
              return {
                  type: 'code',
                  text: text,
                  args: args,
                  ln: number,
              };
          }

          // title
          if (cap = this.rules.title.exec(src)) {
              argsraw = cap[1] || '';
              args = parseArgs(argsraw);
              text = src.slice(cap[0].length);
              return {
                  type: 'title',
                  args: args,
                  title: cap[2],
                  preamble: text
              };
          }

          // svg
          if (cap = this.rules.svg.exec(src)) {
              number = cap[2] != '*';
              argsraw = cap[3] || '';
              args = parseArgs(argsraw, number);
              args.mime = cap[1];
              args.svg = src.slice(cap[0].length);
              return {
                  type: 'svg',
                  args: args
              };
          }

          // heading
          if (cap = this.rules.heading.exec(src)) {
              let number = (cap[2].length == 0);
              let args = parseArgs(cap[3], number=number);
              args.level = (cap[1].length);
              return {
                  type: 'heading',
                  args: args,
                  text: cap[4]
              };
          }

          // envbeg
          if (cap = this.rules.envbeg.exec(src)) {
              let end = cap[1] != undefined;
              number = cap[3] == undefined;
              argsraw = cap[4] || '';
              args = parseArgs(argsraw, number);
              text = src.slice(cap[0].length);
              return {
                  type: 'envbeg',
                  end: end,
                  env: cap[2],
                  args: args,
                  text: text
              };
          }

          // envend
          if (cap = this.rules.envend.exec(src)) {
              text = src.slice(cap[0].length);
              return {
                  type: 'envend',
                  text: text
              };
          }

          // lheading
          if (cap = this.rules.lheading.exec(src)) {
              return {
                  type: 'heading',
                  depth: cap[2] === '=' ? 1 : 2,
                  text: cap[1]
              };
          }

          // hr
          if (cap = this.rules.hr.exec(src)) {
              return {
                  type: 'hr'
              };
          }

          // blockquote
          if (cap = this.rules.blockquote.exec(src)) {
              text = src.slice(cap[0].length);
              return {
                  type: 'blockquote',
                  text: text
              };
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
          return {
              type: 'paragraph',
              text: src
          };
      }
}

/**
 * Inline-Level Grammar
 */

let inline = {
    special: /^(?<!\\)\\([\`\"\^\~])\{([A-z])\}/,
    escape: /^\\([\\/`*{}\[\]()#+\-.!_>\$])/,
    in_comment: /^\/\/([^\n]*?)(?:\n|$)/,
    autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
    url: noop,
    tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^'">])*?>/,
    link: /^!?\[(inside)\]\(href\)/,
    ilink: /^\[\[([^\]]+)\]\]/,
    strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
    em: /^\b_((?:[^_]|__)+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
    code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
    br: /^ {2,}\n(?!\s*$)/,
    del: noop,
    text: /^[\s\S]+?(?=[\/\\<!\[_*`\$\^@%]| {2,}\n|$)/,
    math: /^\$((?:\\\$|[\s\S])+?)\$/,
    ref: /^@\[([^\]]+)\]/,
    cite: /^@@\[([^\]]+)\]/,
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


/**
 * Normal Inline Grammar
 */

inline.normal = merge({}, inline);

/**
 * Pedantic Inline Grammar
 */

inline.pedantic = merge({}, inline.normal, {
  strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
  em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
});

/**
 * GFM Inline Grammar
 */

inline.gfm = merge({}, inline.normal, {
  escape: replace(inline.escape)('])', '~|])')(),
  url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
  del: /^~~(?=\S)([\s\S]*?\S)~~/,
  text: replace(inline.text)
    (']|', '~]|')
    ('|', '|https?://|')
    ()
});

/**
 * GFM + Line Breaks Inline Grammar
 */

inline.breaks = merge({}, inline.gfm, {
  br: replace(inline.br)('{2,}', '*')(),
  text: replace(inline.gfm.text)('{2,}', '*')()
});

/**
 * Inline Lexer & Compiler
 */

class InlineLexer {
    constructor(renderer, options) {
        this.renderer = renderer;
        this.options = options ?? defaults;
        this.rules = inline.normal;

        if (this.options.gfm) {
            if (this.options.breaks) {
                this.rules = inline.breaks;
            } else {
                this.rules = inline.gfm;
            }
        } else if (this.options.pedantic) {
            this.rules = inline.pedantic;
        }
    }

    output(src) {
        let out = ''
          , text
          , href
          , cap
          , tex
          , esc
          , id
          , acc
          , letter
          , alt;

        while (src) {

            // special
            if (cap = this.rules.special.exec(src)) {
                src = src.substring(cap[0].length);
                acc = cap[1];
                letter = cap[2];
                out += this.renderer.special(acc,letter);
                continue;
            }

            // escape
            if (cap = this.rules.escape.exec(src)) {
                src = src.substring(cap[0].length);
                esc = cap[1];
                out += this.renderer.escape(esc);
                continue;
            }

            // math
            if (cap = this.rules.math.exec(src)) {
                src = src.substring(cap[0].length);
                tex = cap[1];
                out += this.renderer.math(tex);
                continue;
            }

            // comment
            if (cap = this.rules.in_comment.exec(src)) {
                src = src.substring(cap[0].length);
                text = cap[1];
                out += this.renderer.in_comment(text);
                continue;
            }

            // ref
            if (cap = this.rules.ref.exec(src)) {
                src = src.substring(cap[0].length);
                let argsraw = cap[1];
                let args = parseArgs(argsraw, false, false);
                let text = args.text || args.txt || args.t || '';
                out += this.renderer.ref(args, this.output(text));
            }

            // cite
            if (cap = this.rules.cite.exec(src)) {
                src = src.substring(cap[0].length);
                let argsraw = cap[1];
                let args = parseArgs(argsraw, false, false);
                let text = args.text || args.txt || args.t || '';
                out += this.renderer.cite(args, this.output(text));
            }

            // footnote
            if (cap = this.rules.footnote.exec(src)) {
                src = src.substring(cap[0].length);
                if(cap[1]){
                out += this.renderer.sidenote(this.output(cap[2]));
                } else {
                out += this.renderer.footnote(this.output(cap[2]));
                }
                continue;
            }

            // internal link
            if (cap = this.rules.ilink.exec(src)) {
                src = src.substring(cap[0].length);
                let argsraw = cap[1];
                let args = parseArgs(argsraw, false, false);
                let text = args.text || args.txt || args.t || '';
                out += this.renderer.ilink(args, this.output(text));
            }

            // autolink
            if (cap = this.rules.autolink.exec(src)) {
                src = src.substring(cap[0].length);
                if (cap[2] === '@') {
                    text = cap[1].charAt(6) === ':'
                    ? this.mangle(cap[1].substring(7))
                    : this.mangle(cap[1]);
                    href = this.mangle('mailto:') + text;
                } else {
                    text = cap[1];
                    href = text;
                }
                out += this.renderer.link(href, null, text);
                continue;
            }

            // url (gfm)
            if (!this.inLink && (cap = this.rules.url.exec(src))) {
                src = src.substring(cap[0].length);
                text = cap[1];
                href = text;
                out += this.renderer.link(href, null, text);
                continue;
            }

            // tag
            if (cap = this.rules.tag.exec(src)) {
                if (!this.inLink && /^<a /i.test(cap[0])) {
                    this.inLink = true;
                } else if (this.inLink && /^<\/a>/i.test(cap[0])) {
                    this.inLink = false;
                }
                src = src.substring(cap[0].length);
                out += this.options.sanitize
                    ? (this.options.sanitizer
                        ? this.options.sanitizer(cap[0])
                        : escape(cap[0])
                    )
                    : cap[0];
                continue;
            }

            // link
            if (cap = this.rules.link.exec(src)) {
                src = src.substring(cap[0].length);
                this.inLink = true;
                out += this.outputLink(cap, {
                    href: cap[2],
                    title: cap[3]
                });
                this.inLink = false;
                continue;
            }

            // strong
            if (cap = this.rules.strong.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.strong(this.output(cap[2] || cap[1]));
                continue;
            }

            // em
            if (cap = this.rules.em.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.em(this.output(cap[2] || cap[1]));
                continue;
            }

            // code
            if (cap = this.rules.code.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.codespan(cap[2].trim());
                continue;
            }

            // br
            if (cap = this.rules.br.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.br();
                continue;
            }

            // del (gfm)
            if (cap = this.rules.del.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.del(this.output(cap[1]));
                continue;
            }

            // text
            if (cap = this.rules.text.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.text(this.smartypants(cap[0]));
                continue;
            }

            if (src) {
                throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
            }
        }

        return out;
    }

    outputLink(cap, link) {
        let href = escape(link.href)
          , title = link.title ? escape(link.title) : null;

        return cap[0].charAt(0) !== '!'
            ? this.renderer.link(href, title, this.output(cap[1]))
            : this.renderer.image(href, title, escape(cap[1]));
    }

    smartypants(text) {
        if (!this.options.smartypants) return text;
        return text
            // em-dashes
            .replace(/---/g, '\u2014')
            // en-dashes
            .replace(/--/g, '\u2013')
            // opening singles
            .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
            // closing singles & apostrophes
            .replace(/'/g, '\u2019')
            // opening doubles
            .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
            // closing doubles
            .replace(/"/g, '\u201d')
            // ellipses
            .replace(/\.{3}/g, '\u2026');
    }

    mangle(text) {
        if (!this.options.mangle) return text;
        let out = ''
          , l = text.length
          , i = 0
          , ch;

        for (; i < l; i++) {
            ch = text.charCodeAt(i);
            if (Math.random() > 0.5) {
                ch = 'x' + ch.toString(16);
            }
            out += '&#' + ch + ';';
        }

        return out;
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

    code(code, lang, escaped, args, ln) {
        if (this.options.highlight) {
            let out = this.options.highlight(code, lang);
            if (out != null && out !== code) {
                escaped = true;
                code = out;
            }
        }


        ln = ln && (args.ln!='false');
        let js = args.lang=='js' || args.lang=='javascript' || args.lang=='gum';
        let ell = args.lang=='elltwo' || args.lang=='l2' || args.lang=='ell2';

        //code = escaped ? code : escape(code, true);
        //lang = lang ? (this.options.langPrefix + escape(lang, true)) : '';

        let numbered = ln ? 'numbered' : '';

        if (js) {
            code = SyntaxHL(code, 'gum');
        } else if (ell) {
            code = SyntaxHL(code, 'elltwo');
        } else {
            code = `<div class="linenum"></div>` + code.replace(/\n/g, `\n<div class=linenum></div>`);
        }

        if (ln) {
            numbered = ' numbered';
        }

        return `<div class="code ${numbered}"><pre>\n${code}\n</pre></div>\n\n`;
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
        return this.options.xhtml ? '<hr/>\n\n' : '<hr>\n\n';
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

    table(header, body) {
        return `<div class="table">\n<div class="table-header">\n${header}</div>\n<div class="table-body">\n${body}</div>\n</div>\n\n`;
    }

    tablerow(content) {
        return `<div class="table-row">${content}</div>\n`;
    }

    tablecell(content, flags) {
        return `<div class="table-cell">${content}</div>`;
    }

    strong(text) {
        return `<span class="strong">${text}</span>`;
    }

    em(text) {
        return `<span class="em">${text}</span>`;
    }

    codespan(text) {
        text = escape(text, true);
        return `<span class="code">${text}</span>`;
    }

    br() {
        return this.options.xhtml ? '<br/>' : '<br>';
    }

    del(text) {
        return `<span class="del">${text}</span>`;
    }

    link(href, title, text) {
        if (this.options.sanitize) {
            try {
                let prot = decodeURIComponent(unescape(href))
                    .replace(/[^\w:]/g, '')
                    .toLowerCase();
            } catch (e) {
                return '';
            }
            if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) {
                return '';
            }
        }

        title = title ? `title="${title}"` : '';
        //text = escape(text);
        return `<a href="${href}" ${title}>${text}</a>`;

    }

    escape(esc) {
        return escape(esc);
    }

    special(acc, letter) {
        return special(acc,letter);
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
        const type = ext ? 'ext' : 'int';
        const format = args.format || args.fmt || args.f || '';
        const pclass = (args.popup != 'false') ? 'pop_anchor': '';
        const dtext = text ? ` data-text="${escape(text)}"` : '';
        const [art, key] = id.split(':');
        const href = ext ? `${window.location.origin}/a/${art}\#${key}` : `\#${id}`;
        return `<a href="${href}" class="reference ${pclass}" refkey="${id}" reftype="${type}" format="${format}" ${dtext}></a>`;
    }

    cite(args, text) {
        const id = args.id || '';
        const format = args.format || args.fmt || args.f || '';
        const pclass = (args.popup != 'false') ? 'pop_anchor': '';
        const dtext = text ? ` data-text="${escape(text)}"` : '';
        return `<a href="" class="reference ${pclass}" refkey="${id}" reftype="cite" format="${format}" ${dtext}></a>`;
    }

    ilink(args, text) {
        const id = args.id || '';
        const pclass = (args.popup != 'false') ? 'pop_anchor': '';
        const dtext = text ? ` data-text="${escape(text)}"` : '';
        return `<a class="reference ${pclass}" href="${id}" refkey="${id}" ${dtext} reftype="link"></a>`;
    }

    footnote(text) {
        return `<span class="footnote pop_anchor" reftype="self"><span class="num" counter="footnote" inc="1"></span><span class="ft_content">${text}</span></span>`;
    }

    sidenote(text) {
        return `<span class="sidenote pop_anchor" reftype="self"><span class=sn_skinny>*</span><span class="ft_content">${text}</span></span>`;
        //return `<div class="sidenote">${text}</div>`;
    }

    image(href) {
        return `<div class="fig_cont"><img src="${href}"></div>`;
    }

    imagelocal() {
        return `<div class="fig_cont"></div>`;
    }

    upload(args) {
        const img = args.image || args.img;
        const key = img ? `key="${img}"`: '';
        return `<div ${key} class="dropzone">Drop Image or Click to Upload</div>`;
    }

    figure(ftype, tag, title, body) {
        let tagtxt = (tag != undefined) ? `id="${tag}"`: '';
        let captxt = (title != undefined) ? `<figcaption>${title}</figcaption>` : '';
        return `<figure class="${ftype}" ${tagtxt}>\n${body}\n${captxt}\n</figure>\n\n`;
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

    code(code, lang, escaped) {
        if (this.options.highlight) {
            let out = this.options.highlight(code, lang);
            if (out != null && out !== code) {
                escaped = true;
                code = out;
            }
        }

        code = escaped ? code : escape_latex(code, true);
        lang = lang ? (this.options.langPrefix + escape(lang, true)) : '';

        return `\\begin{blockcode}\n${code}\n\\end{blockcode}`;
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

    /*
    table(header, body) {
      return `<div class="table">\n<div class="table-header">\n${header}</div>\n<div class="table-body">\n${body}</div>\n</div>\n\n`;
    }

    tablerow(content) {
      return `<div class="table-row">${content}</div>\n`;
    }

    tablecell(content, flags) {
      return `<div class="table-cell">${content}</div>`;
    }
    */

    // span level TexRenderer
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
        // text = escape_latex(text, true);
        return `\\cverb\`${code}\``;
    }

    br() {
        return `\\bigskip`;
    }

    /*
    del(text) {
      return `<span class="del">${text}</span>`;
    }
    */

    link(href, title, text) {
        if (this.options.sanitize) {
            try {
                let prot = decodeURIComponent(unescape(href))
                    .replace(/[^\w:]/g, '')
                    .toLowerCase();
            } catch (e) {
                return '';
            }
            if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) {
                return '';
            }
        }
        text = escape_latex(text);

        return `\\href{${href}}{${text}}`
    }

    ilink(href) {
        return `\\href{${window.location.origin}/r/${href}}{${href}}`
    }

    image(href) {
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
        return `${tex}`;
    }

    ref(args) {
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

    /*
    figure(ftype, tag, title, body) {
      let tagtxt = (tag != undefined) ? `id="${tag}"`: '';
      let captxt = (title != undefined) ? `<figcaption>${title}</figcaption>` : '';
      return `<figure class="${ftype}" ${tagtxt}>\n${body}\n${captxt}\n</figure>\n\n`;
    }
    */
}

/**
 * Parsing & Compiling
 */

class Parser {
    constructor(renderer, inline, options) {
        this.renderer = renderer;
        this.inline = inline;
        this.options = options ?? defaults;
        this.token = null;
    }

    parse(src) {
        this.token = src;
        this.env = null;

        return {
            'src': this.tok(),
            'env': this.env
        };
    }

    parseTable(token) {
        let header = ''
          , body = ''
          , row
          , cell
          , flags
          , i
          , j;

        // header
        cell = '';
        for (i = 0; i < token.header.length; i++) {
            flags = { header: true, align: token.align[i] };
            cell += this.renderer.tablecell(
                this.inline.output(token.header[i]),
                { header: true, align: token.align[i] }
            );
        }
        header += this.renderer.tablerow(cell);

        for (i = 0; i < token.cells.length; i++) {
            row = token.cells[i];

            cell = '';
            for (j = 0; j < row.length; j++) {
                cell += this.renderer.tablecell(
                    this.inline.output(row[j]),
                    { header: false, align: token.align[j] }
                );
            }

            body += this.renderer.tablerow(cell);
        }

        return this.renderer.table(header, body);
    }

    parseList(token) {
        let body = ''
          , ordered = token.ordered
          , row
          , item
          , i;

        for (i = 0; i < token.items.length; i++) {
            row = token.items[i];
            item = this.inline.output(row);
            body += this.renderer.listitem(item);
        }

        return this.renderer.list(body, ordered);
    }

    tok() {
        switch (this.token.type) {
            case 'empty': {
                return this.renderer.empty(this.token.text);
            }
            case 'hr': {
                return this.renderer.hr();
            }
            case 'title': {
                this.env = {
                    type: 'env_one',
                    env: 'title',
                    args: this.token.args,
                    title: this.token.title,
                    preamble: this.token.preamble,
                }
                return this.renderer.title(this.inline.output(this.token.title));
            }
            case 'svg': {
                this.env = {
                    type: 'env_one',
                    env: 'svg',
                    args: this.token.args
                }
                return this.renderer.svg();
            }
            case 'heading': {
                this.env = {
                    type: 'env_one',
                    env: 'heading',
                    args: this.token.args
                }
                return this.renderer.heading(
                    this.inline.output(this.token.text)
                );
            }
            case 'envbeg': {
                this.env = {
                    type: 'env_beg',
                    single: this.token.end,
                    env: this.token.env,
                    args: this.token.args
                };
                return this.renderer.envbeg(
                    this.inline.output(this.token.text), this.token.args
                );
            }
            case 'envend': {
                this.env = {
                    type: 'env_end',
                    args: {}
                };
                return this.renderer.envend(
                    this.inline.output(this.token.text),
                );
            }
            case 'equation': {
                this.env = {
                    type: 'env_one',
                    env: 'equation',
                    args: this.token.args
                }
                return this.renderer.equation(this.token.tex, this.token.args.multiline);
            }
            case 'comment': {
                return this.renderer.comment(this.token.text);
            }
            case 'code': {
                return this.renderer.code(
                    this.token.text,
                    this.token.lang,
                    this.token.escaped,
                    this.token.args,
                    this.token.ln
                );
            }
            case 'table': {
                return this.parseTable(this.token);
            }
            case 'blockquote': {
                return this.renderer.blockquote(this.token.text);
            }
            case 'list': {
                return this.parseList(this.token);
            }
            case 'html': {
                let html = !this.token.pre && !this.options.pedantic
                    ? this.inline.output(this.token.text)
                    : this.token.text;
                return this.renderer.html(html);
            }
            case 'paragraph': {
                return this.renderer.paragraph(this.inline.output(this.token.text));
            }
            case 'text': {
                return this.renderer.paragraph(this.parseText());
            }
            case 'upload': {
                return this.renderer.upload(this.token.args);
            }
            case 'image': {
                this.env = {
                    type: 'env_one',
                    env: 'image',
                    args: this.token.args
                }
                return this.renderer.image(this.token.href);
            }
            case 'imagelocal': {
                this.env = {
                    type: 'env_one',
                    env: 'imagelocal',
                    args: this.token.args
                }
                return this.renderer.imagelocal();
            }
            case 'figtab': {
                this.env = {
                    type: 'env_one',
                    env: 'table',
                    args: this.token.args
                }
                return this.parseTable(this.token.table);
            }
            case 'biblio': {
                let id = this.token.id;
                delete this.token['type'];
                delete this.token['id'];
                return this.renderer.biblio(id, this.token);
            }
        }
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
        .replace(/\$/g, '\\$')
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
    if(acc in acc_dict){
        let spec = acc_dict[acc];
        if(spec.allowed.includes(letter)){
            return `&${letter}${spec.name};`
        }
    }
    return letter
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
    pedantic: false,
    sanitize: false,
    sanitizer: null,
    mangle: true,
    highlight: null,
    langPrefix: 'lang-',
    smartypants: false,
    xhtml: false,
};

/**
 * Markthree
 */

let lexer = new Lexer();

let divRenderer = new DivRenderer();
let divInlineLexer = new InlineLexer(divRenderer);
let divParser = new Parser(divRenderer, divInlineLexer);

let texRenderer = new TexRenderer();
let texInlineLexer = new InlineLexer(texRenderer);
let texParser = new Parser(texRenderer, texInlineLexer);

function markthree(src, output) {
    output = output ?? 'html';

    let parser;
    if (output == 'html') {
        parser = divParser;
    } else if (output == 'latex') {
        parser = texParser;
    }

    try {
        let tokens = lexer.lex(src);
        let html = parser.parse(tokens);
        return html;
    } catch (e) {
        console.log(e)
        return {
            src: `<p>marked3 error [marked3.js:${e.lineNumber}] → ${e.message}</p>`
        };
    }
}
