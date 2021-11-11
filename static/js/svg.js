/* random utilities */

export { initSVGEditor, hideSVGEditor, parseSVG, jsHL }

import { on_success, createIcon, createToggle, smallable_butt } from './utils.js'
import { state } from './state.js'
import { sendCommand } from './client.js'
import { s, esc_html, braceMatch} from './render.js'
import {replace } from './marked3.js'
import { Gum, SVG, Element } from '../gum.js/lib/gum.js'

let svg_butts = {};

function createButton(id, text, iconName=null){
    if(iconName==null){
        iconName = id.toLowerCase();
    }
    let but = $('<button>', {id: `SVGEditor${id}`, class: 'foot_butt smallable_butt'});
    let t = $('<span>', {id: `${id}_text`});
    but.append(t);
    but.append(createIcon(iconName));
    svg_butts[`#${id}_text`] = text;
    return but
}

function initSVGEditor(el, raw='', key='', gum=true) {
    $('#hoot').html(`[201p // iamlamec ${s('// gum.js editor','math')}]`)
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
        let kw = $('<input>', {id: 'SVGEditorKW'});
        kw.attr('placeholder',  'Keywords');
        let tog = createToggle('svgShow', "Show SVG")
        inputBox.append(inputText).append(inputView);

        // navbar
        let navBar = $('<div>', {id: 'SVGEditorNav'});
        let navBarUp = $('<div>', {id: 'SVGEditorNavUp'});
        let navBarDown = $('<div>', {id: 'SVGEditorNavDown'});
        let exit = createButton('Exit', 'Exit')
        let del = createButton('Delete', 'Delete')
        let commit = createButton('Commit', 'Commit', 'exp')
        navBarUp.append(kw)
              .append(tog)
        navBarDown.append(tag)
                  .append(commit)
                  .append(del)
                  .append(exit);
        navBar.append(navBarUp).append(navBarDown);

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
        smallable_butt(svg_butts)

        // mark constructed
        state.SVGEditor = true;
    }

    $(document).on('click', '#SVGEditorExit', function() {
        hideSVGEditor();
    });

    window.onresize = () => {
        smallable_butt(svg_butts);
    };

    $(document).on('change', '#svgShow_check', function() {
        let check = $(this);
        let val = check.is(':checked');
        console.log(val)
        if(val){
            $('#SVGEditorParsed').show()
            $('#SVGEditorInputBox').removeClass('fullsize')
        } else{
            $('#SVGEditorParsed').hide()
            $('#SVGEditorInputBox').addClass('fullsize')
        }
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
    $('#hoot').html('[201p // iamlemec]')
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
        //the n-2 is to match internal line numbers, there must be a header on e.lines
        return {success: false, message: e.message, line: e.lineNumber - 2}; 
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
            text,
            key

        let l1 = this.renderer.newline("")

        while (src) {
            // brace match (for hl, not blocks)
            if (cap = this.rules.brace.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.brace(cap[0], (cap[1]=='L'));
                continue;
            }

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

        return l1 + out;
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

    newline(text) {
        return text+'<div class=linenum></div>';
    }

    nothing(text) {
        return text;
    }
}

function jsHL(src){
    let renderer = new GumRenderer();
    let lexer = new GumLexer(renderer);
    return lexer.output(src);
}

function svgSyntaxHL(src=null) {
    if (src === null) {
        src = $('#SVGEditorInputText').val();
    }
    let out = jsHL(src)
    $('#SVGEditorInputView').html(out);
}
