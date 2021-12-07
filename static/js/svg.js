/* random utilities */

export { initSVGEditor, hideSVGEditor, parseSVG, gums }

import { on_success, createIcon, createToggle, createButton, smallable_butt } from './utils.js'
import { state } from './state.js'
import { sendCommand } from './client.js'
import { replace } from './marked3.js'
import { showConfirm } from './editor.js'
import { deleteImage } from './img.js'
import { s, SyntaxHL, braceMatch } from './hl.js'
import { Gum, SVG, Element } from '../gum.js/lib/gum.js'

let svg_butts = {};

function initSVGEditor(el, raw='', key='', gum=true) {
    $('#hoot').html(`[201p // iamlemec ${s('// gum.js editor','math')}]`)
    if (state.SVGEditor) {
        $('#SVGEditorInputText').val(raw);
        $('#SVGEditorInputView').text(raw);
        $('#SVGEditorOutput').empty();
        $('#SVGEditorTag').val(key);
        $('#SVGEditorOuter').show();
        svgSyntaxHL();
        renderInput();
    } else {
        // custom buttons and toggles
        let tog = createToggle('svgShow', 'Show SVG');
        let commit = createButton('SVGEditorCommit', 'Commit', 'exp', svg_butts);
        let del = createButton('SVGEditorDelete', 'Delete', 'delete', svg_butts);
        let exit = createButton('SVGEditorExit', 'Exit', 'exit', svg_butts);
        $('#SVGEditorNavUp').append(tog);
        $('#SVGEditorNavDown').append(commit).append(del).append(exit);

        // load in data
        if (key) {
            $('#SVGEditorTag').val(key);
        }
        if (raw) {
            $('#SVGEditorInputText').val(raw);
        }

        // render all
        svgSyntaxHL();
        renderInput();
        smallable_butt(svg_butts);
        $('#SVGEditorOuter').css('visibility', 'unset');

        // mark constructed
        state.SVGEditor = true;


    $(document).on('click', '#SVGEditorExit', function() {
        hideSVGEditor();
    });

    $(document).on('click', '#SVGEditorDelete', function() {
        if(state.key){//only if extant image
            let key = state.key;
            let txt = `Delete Image "${key}"?`
            let del = createButton('ConfirmDelete', 'Delete', 'delete');
            let action = function(){
                deleteImage(key)
            };
        showConfirm(del, action, txt)
        }
    });

    window.onresize = () => {
        smallable_butt(svg_butts);
    };

    $(document).on('change', '#svgShow_check', function() {
        let check = $(this);
        let val = check.is(':checked');
        if(val){
            $('#SVGEditorParsed').show()
            $('#SVGEditorParsedView').show()
            $('#SVGEditorInputBox').removeClass('fullsize')
        } else{
            $('#SVGEditorParsed').hide()
            $('#SVGEditorParsedView').hide()
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
            braceMatch(this, null, 'gum', svgSyntaxHL);
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
}

function hideSVGEditor() {
    state.key = null;
    $('#hoot').html('[201p // iamlemec]');
    $('#SVGEditorOuter').hide();
}

// hard-coded options
let prec = 2;
let size = 500;

// gum.js interface mapper
let gums = ['log', ...Gum.map(g => g.name)];
let mako = [console.log, ...Gum.map(g => function(...args) { return new g(...args); })];

function renderInput(src) {
    if (src == null) {
        src = $('#SVGEditorInputText').val();
    }

    let right = $('#SVGEditorOutput');
    let parsed = $('#SVGEditorParsedView');

    let ret = parseGum(src, size);
    if (ret.success) {
        right.html(ret.svg);
        parsed.html(SyntaxHL(ret.svg, 'svg'));
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
        // the n-2 is to match internal line numbers, there must be a header on e.lines
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
        if (!ret.success) {
            return ret.message;
        } else {
            return ret.svg;
        }
    } else {
        if (src.match(/ *<svg( |>)/) == null) {
            let [w, h] = (typeof(size) == 'number') ? [size, size] : size;
            return `<svg viewBox="0 0 ${w} ${h}">\n${src}\n</svg>`;
        } else {
            return src;
        }
    }
}

function svgSyntaxHL() {
    let src = $('#SVGEditorInputText').val();
    let out = SyntaxHL(src, 'gum')
    $('#SVGEditorInputView').html(out);
}
