/* random utilities */

export { initSVGEditor, hideSVGEditor, parseSVG }

import { on_success } from './utils.js'
import { state } from './state.js'
import { sendCommand } from './client.js'
import { s, esc_html, braceMatch} from './render.js'
import {replace } from './marked3.js'
import { Gum, SVG, Element } from '../gum.js/lib/gum.js'

function createIcon(id) {
    return `<svg>
            <use xlink:href="/static/img/icons.svg#${id}"></use>
            </svg>`;
}

function initSVGEditor(el, raw='', key='', gum=true) {
    if (state.SVGEditor) {
        $('#SVGEditorInputText').val(raw);
        $('#SVGEditorInputView').text(raw);
        $('#SVGEditorOutput').empty();
        $('#SVGEditorTag').val(key);
        $('#SVGEditorOuter').show();
        svgSyntaxHL();
        renderInput();
    } else {
        let outerBox = $('<div>', {id: 'SVGEditorOuter'});
        let editBox = $('<div>', {id: 'SVGEditorBox'});

        // editor panes
        let left = $('<div>', {id: 'SVGEditorBoxLeft'});
        let right = $('<div>', {id: 'SVGEditorBoxRight'});
        let inputBox = $('<div>', {id: 'SVGEditorInputBox'});
        let inputText = $('<textarea>', {id: 'SVGEditorInputText'});
        let inputView = $('<div>', {id: 'SVGEditorInputView', class: 'p_input_view'});
        let parsed = $('<textarea>', {id: 'SVGEditorParsed'});
        parsed.prop('readonly', true);
        inputText.attr('placeholder',  'Add SVG code here')
        let output = $('<div>', {id: 'SVGEditorOutput'});
        let tag = $('<input>', {id: 'SVGEditorTag'});
        tag.attr('placeholder',  'Image tag (required)');
        inputBox.append(inputText).append(inputView);

        // navbar
        let navBar = $('<div>', {id: 'SVGEditorNav'});
        let exit = $('<button>', {id: 'SVGEditorExit', text: 'Exit Editor', class: 'foot_butt'});
        let commit = $('<button>', {id: 'SVGEditorCommit', text: 'Commit', class: 'foot_butt'});
        exit.append(createIcon('hist'));
        commit.append(createIcon('exp'));
        navBar.append(tag).append(commit).append(exit);

        // high level
        left.append(inputBox).append(parsed);
        right.append(output).append(navBar);
        editBox.append(left).append(right);
        outerBox.append(editBox);
        el.append(outerBox);

        // load in data
        if (key) {
            $('#SVGEditorTag').val(key);
        }
        if (raw) {
            $('#SVGEditorInputText').val(raw);
        }
        svgSyntaxHL();
        renderInput();

        // mark constructed
        state.SVGEditor = true;
    }

    $(document).on('click', '#SVGEditorExit', function() {
        hideSVGEditor();
    });

    $(document).on('input', '#SVGEditorInputText', function(e) {
        svgSyntaxHL();
        renderInput();
    });

    $(document).on('keyup', '#SVGEditorInputText', function(e) {
        let arrs = [37, 38, 39, 40, 48, 57, 219, 221];
        if (arrs.includes(e.keyCode)) {
            braceMatch(this, null, svgSyntaxHL, svgSyntaxHL);
        }
    });

    $(document).on('focus', '#SVGEditorTag', function(e) {
        $(this).removeClass('input_err');
    });

    $(document).on('click', '#SVGEditorCommit', function(e) {
        if (key = $('#SVGEditorTag').val()) {
            let raw = $('#SVGEditorInputText').val();
            let data = {'key': key, 'mime': 'text/svg+gum', 'raw': raw};
            sendCommand('save_svg', data);
        } else {
            $('#SVGEditorTag').addClass('input_err');
        }
    });
}

function hideSVGEditor() {
    $('#SVGEditorOuter').hide();
}

// hard-coded options
let prec = 2;

// gum.js interface mapper
let gums = ['log', ...Gum.map(g => g.name)];
let mako = [console.log, ...Gum.map(g => function(...args) { return new g(...args); })];

function renderInput(src) {
    if (src == null) {
        src = $('#SVGEditorInputText').val();
    }

    let right = $('#SVGEditorOutput');
    let parsed = $('#SVGEditorParsed');

    let [vw, vh] = [right.innerHeight(), right.innerWidth()];
    let size = 0.8*Math.min(vw, vh);
    let ret = parseGum(src, size);

    if (ret.success) {
        right.html(ret.svg);
        parsed.text(ret.svg);
    } else {
        parsed.text(`parse error, line ${ret.line}: ${ret.message}`);
    }
}

function parseGum(src, size) {
    if (src.length == 0) {
        return {success: true, svg: ''};
    }

    let out;
    try {
        let e = new Function(gums, src);
        out = e(...mako);
    } catch (e) {
        return {success: false, message: e.message, line: e.lineNumber};
    }

    if (out == null) {
        return {success: false, message: 'no return value', line: 0};
    }

    let svg;
    if (out instanceof Element) {
        out = (out instanceof SVG) ? out : new SVG([out]);
        svg = out.svg({size: size, prec: prec});
    } else {
        return {success: false, message: 'did not return gum element', line: 0};
    }

    return {success: true, svg: svg};
}

function parseSVG(mime, src, size) {
    if (mime == 'text/svg+gum') {
        let ret = parseGum(src, size);
        return ret.svg;
    } else {
        if (src.match(/ *<svg( |>)/) == null) {
            let [w, h] = (typeof(size) == 'number') ? [size, size] : size;
            return `<svg viewBox="0 0 ${w} ${h}">\n${src}\n</svg>`;
        } else {
            return src;
        }
    }
}

/* snytax hl */

let jskeys = [
    'await', 'break', 'catch', 'class', 'const',
    'continue', 'do', 'else', 'eval', 'export', 'for',
    'function', 'if', 'import', 'let', 'return', 'switch',
    'throw', 'try', 'while', 'with', 'yield'
];

let boolean = ['true', 'false', 'null', 'undefined', 'new'];

let jschars = `\\|\\&\\>\\<\\!\\;\\.\\=\\:\\,\\(\\)\\{\\}\\[\\]`;

let rules = {
    brace: /^&!(R|L)&/,
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
            text

        while (src) {
            // brace match (for hl, not blocks)
            if (cap = this.rules.brace.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.brace(cap[0], (cap[1]=='L'));
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

            // tokens to do nothing with
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

        return out;
    }
}

class GumRenderer {
    constructor(options) {
        this.options = options ?? {};
    }

    brace(text, left) {
        if (left) {
            return'<span class="brace">';
        } else {
            return'</span>'
        }
    }

    basic(text, klass) {
        return s(text,klass);
    }

    nothing(text) {
        return text;
    }
}

function svgSyntaxHL(src=null) {
    if (src === null) {
        src = $('#SVGEditorInputText').val();
    }
    let renderer = new GumRenderer();
    let lexer = new GumLexer(renderer);
    let out = lexer.output(src);
    $('#SVGEditorInputView').html(out);
}
