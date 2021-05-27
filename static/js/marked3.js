/**
 * marked - a markdown parser
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 */

;(function() {

/**
 * Block-Level Grammar
 */

var block = {
  empty: /^(\s*)$/,
  comment: /^\/\/ ?/,
  hr: /^([-*_]){3,}\s*$/,
  heading: /^(#{1,6})(\*?) *(?:refargs)? *([^\n]+?)$/,
  lheading: /^([^\n]+)\n *(=|-){2,}\s*$/,
  blockquote: /^q*> ?\n?/,
  code: /^``(?: |\n)?/,
  equation: /^\$\$(\*)? *(?:refargs)?\s*/,
  title: /^#! *(?:refargs)?\s*([^\n]*)\s*/,
  upload: /^!! *(?:refargs)?\s*$/,
  svg: /^\!svg(\*)? *(?:refargs)?\s*/,
  image: /^!(\*)? *(?:refargs)? *\(href\)\s*$/,
  imagelocal: /^!(\*)? *(?:refargs)\s*$/,
  biblio: /^@@ *(?:refid)\s*/,
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

block.title = replace(block.title)
  ('refargs', block._refargs)
  ();

block.svg = replace(block.svg)
  ('refargs', block._refargs)
  ();

block.biblio = replace(block.biblio)
  ('refid', block._refid)
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
 * Args Parser
 */

function parseArgs(argsraw, number=true, set=true) {
  if (!argsraw) {
    return {'number': number};
  }

  var fst;
  var args = {};
  var rx = /[^a-zA-Z\d\_\-]/ //invalid chars for arg labels and id's

  if(!set){
   rx = /[^a-zA-Z\d\_\-\:]/ //allow : for references
  }

  //using lookbehinds, might not work on old browsers.
  argsraw.split(/(?<!\\)\||\n/)
         .map(x => x.split(/(?<!\\)\=/))
         .filter(x => x.length > 1)
         .forEach(x => {
          let val = x.pop()
          x.forEach(key => {
            if(!rx.test(key)){
              args[key] = val
              }
            })
          });
  // if ((Object.keys(args).length==0) && argsraw) {
  //   args['id'] = argsraw;
  // }

  if (!('id' in args)) {
    fst = argsraw.split(/(?<!\\)\||\n/)[0];
    if (!rx.test(fst)) {
            args['id'] = fst;
    }
  } else {
    if (rx.test(args['id'])) { //cannot have chars in id
        delete args['id'];
    };

  };

  if (!('number' in args)) {
    args['number'] = number;
  }
  return args;
}

/**
 * Block Lexer
 */

function Lexer(options) {
  this.options = options || marked.defaults;
  this.rules = block;
}

/**
 * Expose Block Rules
 */

Lexer.rules = block;

/**
 * Static Lex Method
 */

Lexer.lex = function(src, options) {
  var lexer = new Lexer(options);
  return lexer.lex(src);
};

/**
 * Preprocessing
 */

Lexer.prototype.lex = function(src) {
  src = src
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2424/g, '\n');

  return this.token(src);
};

/**
 * Specialized Functions
 */

Lexer.prototype.parseBiblio = function(id, text) {
  var bib = {
    type: 'biblio',
    id: id,
  }

  var lines = text.split('\n');
  var line, kv, key, val;

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
};

Lexer.prototype.parseTable = function(header, align, cells) {
  var item = {
    type: 'table',
    header: header.replace(/^ *| *\| *$/g, '').split(/ *\| */),
    align: align.replace(/^ *|\| *$/g, '').split(/ *\| */),
    cells: cells.replace(/(?: *\| *)?\n$/, '').split('\n')
  };

  var i;

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
};

Lexer.prototype.parseList = function(items) {
  var list = {
    type: 'list',
    ordered: true,
    items: items.split('\n')
  };

  var i, text, ret;

  for (i = 0; i < list.items.length; i++) {
    text = list.items[i];
    ret = block._item.exec(text);
    list.items[i] = text.slice(ret[0].length);
    list.ordered &&= (ret[2].length > 1);
  }

  return list;
};

/**
 * Lexing
 */

Lexer.prototype.token = function(src) {
  var src = src.replace(/^ +$/gm, '')
    , cap
    , number
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
    number = cap[1] == undefined;
    argsraw = cap[2] || '';
    args = parseArgs(argsraw, number);
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
    var table = this.parseTable(cap[2], cap[3], cap[4]);
    return {
      type: 'figtab',
      args: args,
      table: table
    };
  }

  // bibliographic info
  if (cap = this.rules.biblio.exec(src)) {
    text = src.slice(cap[0].length);
    return this.parseBiblio(cap[1], text);
  }

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
    text = src.slice(cap[0].length);
    return {
      type: 'code',
      text: text
    };
  }

  // title
  if (cap = this.rules.title.exec(src)) {
    argsraw = cap[1] || '';
    args = parseArgs(argsraw, number);
    text = src.slice(cap[0].length);
    return {
      type: 'title',
      args: args,
      text: cap[2],
      preamble: text
    };
  }

  // svg
  if (cap = this.rules.svg.exec(src)) {
    number = cap[1] == undefined;
    argsraw = cap[2] || '';
    args = parseArgs(argsraw, number);
    text = src.slice(cap[0].length);
    return {
      type: 'svg',
      args: args,
      svg: text
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
};

/**
 * Inline-Level Grammar
 */

var inline = {
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
  ref: /^@\[([\w-\|\=\:]+)\]/,
  footnote: /^\^\[(inside)\]/
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

function InlineLexer(options) {
  this.options = options || marked.defaults;
  this.rules = inline.normal;
  this.renderer = this.options.renderer || new Renderer;
  this.renderer.options = this.options;

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

/**
 * Expose Inline Rules
 */

InlineLexer.rules = inline;

/**
 * Static Lexing/Compiling Method
 */

InlineLexer.output = function(src, options) {
  var inline = new InlineLexer(options);
  return inline.output(src);
};

/**
 * Lexing/Compiling
 */

InlineLexer.prototype.output = function(src) {
  var out = ''
    , text
    , href
    , cap
    , tex
    , esc
    , id
    , alt;

  while (src) {
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
      var args = {};
      argsraw = cap[1];
      args = parseArgs(argsraw, number=false, set=false);
      out += this.renderer.ref(args);
    }

    // footnote
    if (cap = this.rules.footnote.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.footnote(this.output(cap[1]));
      continue;
    }

    // internal link
    if (cap = this.rules.ilink.exec(src)) {
      src = src.substring(cap[0].length);
      href = cap[1].split('|')[0];
      text = cap[1].split('|')[1] || href;
      out += this.renderer.ilink(href, text);
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
        ? this.options.sanitizer
          ? this.options.sanitizer(cap[0])
          : escape(cap[0])
        : cap[0]
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
      throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }

  return out;
};

/**
 * Compile Link
 */

InlineLexer.prototype.outputLink = function(cap, link) {
  var href = escape(link.href)
    , title = link.title ? escape(link.title) : null;

  return cap[0].charAt(0) !== '!'
    ? this.renderer.link(href, title, this.output(cap[1]))
    : this.renderer.image(href, title, escape(cap[1]));
};

/**
 * Smartypants Transformations
 */

InlineLexer.prototype.smartypants = function(text) {
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
};

/**
 * Mangle Links
 */

InlineLexer.prototype.mangle = function(text) {
  if (!this.options.mangle) return text;
  var out = ''
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
};

/**
 *  DIV Renderer
 */

function DivRenderer(options) {
  this.options = options || {};
}

DivRenderer.prototype.empty = function(text) {
  return `<div class="empty">\n${text}\n</div>\n\n`;
};

DivRenderer.prototype.comment = function(text) {
  text = escape(text);
  return `<div class="comment">${text}</div>\n\n`;
};

DivRenderer.prototype.in_comment = function(text) {
  return ``;
};

DivRenderer.prototype.code = function(code, lang, escaped) {
  if (this.options.highlight) {
    var out = this.options.highlight(code, lang);
    if (out != null && out !== code) {
      escaped = true;
      code = out;
    }
  }

  code = escaped ? code : escape(code, true);
  lang = lang ? (this.options.langPrefix + escape(lang, true)) : '';

  return `<div class="code ${lang}"><pre>\n${code}\n</pre></div>\n\n`;
};

DivRenderer.prototype.blockquote = function(quote) {
  return `<div class="quote">\n${quote}\n</div>\n\n`;
};

DivRenderer.prototype.html = function(html) {
  return html;
};

DivRenderer.prototype.title = function(text) {
  return `<div class="title">${text}</div>\n\n`;
};

DivRenderer.prototype.heading = function(text) {
  return text;
};

DivRenderer.prototype.svg = function(svg) {
  if (!svg.startsWith('<svg ')) {
    svg = `<svg viewBox="0 0 100 100">\n${svg}\n</svg>`;
  }
  return `<div class="fig_cont">\n${svg}\n</div>`;
};

DivRenderer.prototype.envbeg = function(text) {
  return text;
};

DivRenderer.prototype.envend = function(text) {
  return text;
};

DivRenderer.prototype.hr = function() {
  return this.options.xhtml ? '<hr/>\n\n' : '<hr>\n\n';
};

DivRenderer.prototype.list = function(body, ordered) {
  var type = ordered ? 'ordered' : 'unordered';
  return `<div class="list ${type}">\n${body}</div>\n\n`;
};

DivRenderer.prototype.listitem = function(text) {
  return `<div class="list-item">${text}</div>\n`;
};

DivRenderer.prototype.paragraph = function(text) {
  return `<div class="p">${text}</div>\n\n`;
};

DivRenderer.prototype.table = function(header, body) {
  return `<div class="table">\n<div class="table-header">\n${header}</div>\n<div class="table-body">\n${body}</div>\n</div>\n\n`;
};

DivRenderer.prototype.tablerow = function(content) {
  return `<div class="table-row">${content}</div>\n`;
};

DivRenderer.prototype.tablecell = function(content, flags) {
  return `<div class="table-cell">${content}</div>`;
};

// span level DivRenderer
DivRenderer.prototype.strong = function(text) {
  return `<span class="strong">${text}</span>`;
};

DivRenderer.prototype.em = function(text) {
  return `<span class="em">${text}</span>`;
};

DivRenderer.prototype.codespan = function(text) {
  text = escape(text, true);
  return `<span class="code">${text}</span>`;
};

DivRenderer.prototype.br = function() {
  return this.options.xhtml ? '<br/>' : '<br>';
};

DivRenderer.prototype.del = function(text) {
  return `<span class="del">${text}</span>`;
};

DivRenderer.prototype.link = function(href, title, text) {
  if (this.options.sanitize) {
    try {
      var prot = decodeURIComponent(unescape(href))
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
  text = escape(text);

  return `<a href="${href}" ${title}>${text}</a>`;
};

DivRenderer.prototype.ilink = function(href, text) {
  return `<a class="reference pop_anchor" citekey="_ilink_" href="${href}" data-extern='true'>${text}</a>`;
};

DivRenderer.prototype.escape = function(esc) {
  return escape(esc);
};

DivRenderer.prototype.text = function(text) {
  return escape(text);
};

DivRenderer.prototype.math = function(tex) {
  return `<span class="latex">${tex}</span>`;
};

DivRenderer.prototype.equation = function(tex) {
  return `<div class="latex">\n${tex}\n</div>\n\n`;
};

DivRenderer.prototype.ref = function(args) {
  const id = args['id'] || "";
  const ext = id.includes(':') || false;
  const format = args['format'] || args['fmt'] || args['f'] || '';
  const text = args['text'] || args['txt'] || args['t'];
  const htext =  (text != undefined) ? `text="${text}"`: '';
  const pclass = (args['popup'] != 'false') ? 'pop_anchor': '';
  const ptext = ('poptext' in args) ? `poptext="${args['poptext']}"`: '';
  const x = (readonly) ? 'r' : 'a';
  const href = (ext) ? `${window.location.origin}/${x}/${id.split(':')[0]}\#${id.split(':')[1]}` : `\#${id}`;
  return `<a href="${href}" class="reference ${pclass}" citekey="${id}" data-extern="${ext}" format="${format}" ${htext} ${ptext}></a>`;
};

DivRenderer.prototype.footnote = function(text) {
  return `<span class="footnote pop_anchor" cite_type="footnote" citekey="_self_"><span class=num counter=footnote inc=1></span><span class="ft_content">${text}</span></span>`;
};

DivRenderer.prototype.image = function(href) {
  return `<div class="fig_cont"><img src="${href}"></div>`;
};

DivRenderer.prototype.imagelocal = function(key) {
  return `<div class="fig_cont"></div>`;
};

DivRenderer.prototype.upload = function(args) {
  const img_id  = (args['id']) ?  `img_id=${args['id']}`: '';
  return `<div ${img_id} class="dropzone">Drop Image or Click to Upload</div>`;
};

DivRenderer.prototype.figure = function(ftype, tag, title, body) {
  var tagtxt = (tag != undefined) ? `id="${tag}"`: '';
  var captxt = (title != undefined) ? `<figcaption>${title}</figcaption>` : '';
  return `<figure class="${ftype}" ${tagtxt}>\n${body}\n${captxt}\n</figure>\n\n`;
};

DivRenderer.prototype.biblio = function(id, info) {
  var keys = '';
  for (k in info) {
    var v = info[k];
    keys += ` ${k}="${v}"`;
  }
  return `<div class="biblio" id="${id}" ${keys}></div>\n`;
};

/**
 *  TEX Renderer
 */

function TexRenderer(options) {
  this.options = options || {};
}

TexRenderer.prototype.empty = function(text) {
  return  `% ${text}`;
};

TexRenderer.prototype.comment = function(text) {
  return `% ${text}`;
};

TexRenderer.prototype.in_comment = function(text) {
  return `% ${text}`;
};

TexRenderer.prototype.code = function(code, lang, escaped) {
  if (this.options.highlight) {
    var out = this.options.highlight(code, lang);
    if (out != null && out !== code) {
      escaped = true;
      code = out;
    }
  }

  code = escaped ? code : escape_latex(code, true);
  lang = lang ? (this.options.langPrefix + escape(lang, true)) : '';

  return `\\begin{blockcode}\n${code}\n\\end{blockcode}`;
};

TexRenderer.prototype.blockquote = function(quote) {
  return `\\verb\`${quote}\``;
};

TexRenderer.prototype.html = function(html) {
  return `\\verb\`${html}\``;
};

TexRenderer.prototype.title = function(title) {
  return title;
};

TexRenderer.prototype.heading = function(text) {
  return text;
};

TexRenderer.prototype.svg = function(svg) {
  return 'SVG';
};

TexRenderer.prototype.envbeg = function(text) {
  return text;
};

TexRenderer.prototype.envend = function(text) {
  return text;
};

TexRenderer.prototype.hr = function() {
  return `\\rule{\\textwidth}{0.4pt}`;
};

TexRenderer.prototype.list = function(body, ordered) {
  var type = ordered ? 'enumerate' : 'itemize';
  return `\\begin{${type}}\n${body}\n\\end{${type}}`;
};

TexRenderer.prototype.listitem = function(text) {
  return `\\item ${text}\n`;
};

TexRenderer.prototype.paragraph = function(text) {
  return `${text}`;
};

// DivRenderer.prototype.table = function(header, body) {
//   return `<div class="table">\n<div class="table-header">\n${header}</div>\n<div class="table-body">\n${body}</div>\n</div>\n\n`;
// };

// DivRenderer.prototype.tablerow = function(content) {
//   return `<div class="table-row">${content}</div>\n`;
// };

// DivRenderer.prototype.tablecell = function(content, flags) {
//   return `<div class="table-cell">${content}</div>`;
// };

// span level TexRenderer
TexRenderer.prototype.strong = function(text) {
  return `\\textbf{${text}}`;
};

TexRenderer.prototype.em = function(text) {
  return `\\textit{${text}}`;
};

TexRenderer.prototype.comment = function(comment) {
  return comment;
};

TexRenderer.prototype.codespan = function(code) {
  //text = escape_latex(text, true);
  return `\\cverb\`${code}\``;
};

TexRenderer.prototype.br = function() {
  return `\\bigskip`;
};

// DivRenderer.prototype.del = function(text) {
//   return `<span class="del">${text}</span>`;
// };

TexRenderer.prototype.link = function(href, title, text) {
  if (this.options.sanitize) {
    try {
      var prot = decodeURIComponent(unescape(href))
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
};

TexRenderer.prototype.ilink = function(href) {
  return `\\href{${window.location.origin}/r/${href}}{${href}}`
};

TexRenderer.prototype.escape = function(esc) {
  return escape_latex(esc);
};

TexRenderer.prototype.text = function(text) {
   return escape_latex(text);
 };

TexRenderer.prototype.math = function(tex) {
   return `$${tex}$`;
 };

TexRenderer.prototype.equation = function(tex) {
  return `${tex}`;
};

TexRenderer.prototype.ref = function(args) {
  let id = args['id'];
  let ext = id.includes(':');
  let format = args['format'] || args['fmt'] || args['f'] || '';
  let c = (format == 'plain') ? '': 'c';
  let text = args['text'] || args['txt'] || args['t'];
  let pclass = (args['popup'] != 'false') ? 'pop_anchor': '';
  //var ptext = ('poptext' in args) ? `poptext="${args['poptext']}"`: '';
  if(ext){
    let inner = (text) ? text : `<!!<${id}>!!>`
    return `\\href{${window.location.origin}/r/${id.split(':')[0]}\\\#${id.split(':')[1]}}{${inner}}`
  }else if (text){
    return `\\hyperref[${id}]{${text}}`
  } else {
  return `\\${c}ref{${id}}`
  }

};

TexRenderer.prototype.footnote = function(text) {
   return `\\footnote{${text}}`;
 };

// DivRenderer.prototype.image = function(href, alt) {
//   return `<img src="${href}" alt="${alt}">`;
// };

// DivRenderer.prototype.figure = function(ftype, tag, title, body) {
//   var tagtxt = (tag != undefined) ? `id="${tag}"`: '';
//   var captxt = (title != undefined) ? `<figcaption>${title}</figcaption>` : '';
//   return `<figure class="${ftype}" ${tagtxt}>\n${body}\n${captxt}\n</figure>\n\n`;
// };

/**
 * Parsing & Compiling
 */

function Parser(options) {
  this.token = null;
  this.options = options || marked.defaults;
  this.options.renderer = this.options.renderer || new Renderer;
  this.renderer = this.options.renderer;
  this.renderer.options = this.options;
}

/**
 * Static Parse Method
 */

Parser.parse = function(src, options, renderer) {
  var parser = new Parser(options, renderer);
  return parser.parse(src);
};

/**
 * Parse Loop
 */

Parser.prototype.parse = function(src) {
  this.inline = new InlineLexer(this.options, this.renderer);
  this.token = src;
  var out = this.tok();

  if (this.options.env) {
    return {'src': out, 'env': this.env};
  } else {
    return out;
  }
};

/**
 * Specialized Methods
 */

Parser.prototype.parseTable = function(token) {
  var header = ''
    , body = ''
    , i
    , row
    , cell
    , flags
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
};

Parser.prototype.parseList = function(token) {
  var body = ''
    , ordered = token.ordered
    , row
    , item;

  for (i = 0; i < token.items.length; i++) {
    row = token.items[i];
    item = this.inline.output(row);
    body += this.renderer.listitem(item);
  }

  return this.renderer.list(body, ordered);
};

/**
 * Parse Current Token
 */

Parser.prototype.tok = function() {
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
        preamble: this.token.preamble,
      }
      return this.renderer.title(this.inline.output(this.token.text));
    }
    case 'svg': {
      this.env = {
        type: 'env_one',
        env: 'svg',
        args: this.token.args
      }
      return this.renderer.svg(this.token.svg);
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
      return this.renderer.equation(this.token.tex);
    }
    case 'comment': {
      return this.renderer.comment(this.token.text);
    }
    case 'code': {
      return this.renderer.code(this.token.text,
        this.token.lang,
        this.token.escaped);
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
      var html = !this.token.pre && !this.options.pedantic
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
      var id = this.token.id;
      delete this.token['type'];
      delete this.token['id'];
      return this.renderer.biblio(id, this.token);
    }
  }
};

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
  var i = 1
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
 * Marked
 */

function marked(src, opt, callback) {
  if (callback || typeof opt === 'function') {
    if (!callback) {
      callback = opt;
      opt = null;
    }

    opt = merge({}, marked.defaults, opt || {});

    var highlight = opt.highlight
      , tokens
      , pending
      , i = 0;

    try {
      tokens = Lexer.lex(src, opt)
    } catch (e) {
      return callback(e);
    }

    pending = tokens.length;

    var done = function(err) {
      if (err) {
        opt.highlight = highlight;
        return callback(err);
      }

      var out;

      try {
        out = Parser.parse(tokens, opt);
      } catch (e) {
        err = e;
      }

      opt.highlight = highlight;

      return err
        ? callback(err)
        : callback(null, out);
    };

    if (!highlight || highlight.length < 3) {
      return done();
    }

    delete opt.highlight;

    if (!pending) return done();

    for (; i < tokens.length; i++) {
      (function(token) {
        if (token.type !== 'code') {
          return --pending || done();
        }
        return highlight(token.text, token.lang, function(err, code) {
          if (err) return done(err);
          if (code == null || code === token.text) {
            return --pending || done();
          }
          token.text = code;
          token.escaped = true;
          --pending || done();
        });
      })(tokens[i]);
    }

    return;
  }
  try {
    if (opt) opt = merge({}, marked.defaults, opt);
    return Parser.parse(Lexer.lex(src, opt), opt);
  } catch (e) {
    e.message += '\nPlease report this to https://github.com/chjj/marked.';
    if ((opt || marked.defaults).silent) {
      return '<p>An error occured:</p><pre>'
        + escape(e.message + '', true)
        + '</pre>';
    }
    throw e;
  }
}

/**
 * Options
 */

marked.options =
marked.setOptions = function(opt) {
  merge(marked.defaults, opt);
  return marked;
};

marked.defaults = {
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  sanitizer: null,
  mangle: true,
  smartLists: false,
  silent: false,
  highlight: null,
  langPrefix: 'lang-',
  smartypants: false,
  headerPrefix: '',
  renderer: new DivRenderer,
  xhtml: false,
  env: true,
  flatten: false
};

/**
 * Expose
 */

marked.merge = merge;
marked.replace = replace;

marked.Parser = Parser;
marked.parser = Parser.parse;

marked.Renderer = DivRenderer;
marked.texRenderer = TexRenderer;

marked.Lexer = Lexer;
marked.lexer = Lexer.lex;

marked.InlineLexer = InlineLexer;
marked.inlineLexer = InlineLexer.output;

marked.parse = marked;

marked.block = block;

if (typeof module !== 'undefined' && typeof exports === 'object') {
  module.exports = marked;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return marked; });
} else {
  this.markthree = marked;
}

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());
