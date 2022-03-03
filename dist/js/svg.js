import { createToggle, createButton, smallable_butt, cur, updateSliderValue } from './utils.js';
import { state, config } from './state.js';
import { sendCommand } from './client.js';
import './marked3.js';
import { makeActive, showConfirm, textWrap, textUnWrap, sendUpdatePara } from './editor.js';
import { deleteImage } from './img.js';
import { s, braceMatch, SyntaxHL } from './hl.js';
import { parseGum, InterActive, Element, SVG } from '../node_modules/gum.js/js/gum.js';

/* random utilities */

let svg_butts = {};

function initSVGEditor(el, raw='', key='', gum=true, updatePara=false) {
    $('#hoot').html(`[201p // iamlemec ${s('// gum.js editor','math')}]`);
    makeActive(false);

    if (state.SVGEditor) {
        $('#SVGEditorInputText').val(raw);
        $('#SVGEditorInputView').text(raw);
        $('#SVGEditorOutput').empty();
        $('#SVGEditorTag').val(key);
        $('#SVGEditorOuter').show();
        svgSyntaxHL();
        renderInput();
        state.SVGEditorOpen = true;
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
        state.SVGEditorOpen = true; //mark open

        $(document).on('click', '#SVGEditorExit', function() {
            hideSVGEditor();
        });

        $(document).on('click', '#SVGEditorDelete', function() {
            if(state.key){//only if extant image
                let key = state.key;
                let txt = `Delete Image "${key}"?`;
                let del = createButton('ConfirmDelete', 'Delete', 'delete');
                let action = function(){
                    deleteImage(key);
                };
            showConfirm(del, action, txt);
            }
        });

        window.onresize = () => {
            smallable_butt(svg_butts);
        };

        $(document).on('change', '#svgShow_check', function() {
            let check = $(this);
            let val = check.is(':checked');
            if(val){
                $('#SVGEditorParsed').show();
                $('#SVGEditorParsedView').show();
                $('#SVGEditorInputBox').removeClass('fullsize');
            } else {
                $('#SVGEditorParsed').hide();
                $('#SVGEditorParsedView').hide();
                $('#SVGEditorInputBox').addClass('fullsize');
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
                let data = {'key': key, 'mime': 'image/svg+gum', 'raw': raw};
                sendCommand('save_svg', data);
                if(updatePara){
                    let data = {pid: updatePara.attr('pid'), aid: config.aid};
                    sendCommand('lock', data, function(response) {
                        sendUpdatePara(updatePara, `![${key}]`, true);
                    });
                }
            } else {
                $('#SVGEditorTag').addClass('input_err');
            }
        });

        $(document).on('keydown', '#SVGEditorInputText', function(e) {
        let input = $(this);
        let key = e.key.toLowerCase();
        let ctrl = e.ctrlKey;
        e.altKey;
        let meta = e.metaKey;
        let tab = e.keyCode == 9;
        let space = e.keyCode == 32;
        let shift = e.shiftKey;
        let raw, c;
        if(tab){
                c = cur(e);
                raw = input.val();
                raw = raw.substring(0,c) + '\t' + raw.substring(c);
                input.val(raw).trigger('input');
                input[0].setSelectionRange(c+1,c+1);
                return false;
        }else if (key in brac_wraps) {
                c = cur(e, true);
                return textWrap(input, c, brac_wraps[key]);
        } else if (key == 'backspace') {
            let c = cur(e, true);
            return textUnWrap(input, c, brac_wraps);
        } else if (space) {
            state.undoBreakpoint = true;
        }else if (key == 'enter') {
            return getindent(input, cur(e))
        } else if ((ctrl || meta) && key == 'z') {
            if(shift){
                redo(state.active_para);
            }else {
                undo(state.active_para);
            }            return false;
        }
        });

        let mid = document.querySelector('#SVGWidthControl');
        let left = document.querySelector('#SVGEditorBoxLeft');
        let right = document.querySelector('#SVGEditorBoxRight');
        let ipt = document.querySelector('#SVGEditorInputText');
        let view = document.querySelector('#SVGEditorInputView');

        function resizePane(e) {
            let x = e.clientX;
            let vw = window.innerWidth;
            x = Math.max(x,100);
            x = Math.min(x, vw-300);
            let perc = (x-2)*100/vw;
            left.style.width = `${perc}%`;
            right.style.width = `${100-perc}%`;
        }

        mid.addEventListener('mousedown', evt => {
            document.addEventListener('mousemove', resizePane, false);
        }, false);

        document.addEventListener('mouseup', evt => {
            document.removeEventListener('mousemove', resizePane, false);
        }, false);

        ipt.addEventListener('scroll', evt => {
            console.log(evt.target.scrollTop);
            view.scrollTop = evt.target.scrollTop;
        }, false);
    }
}

function hideSVGEditor() {
    state.SVGEditorOpen = false;
    state.key = null;
    $('#hoot').html('[201p // iamlemec]');
    $('#SVGEditorOuter').hide();
}
let size0 = 500;

function renderInput(src) {
    if (src == null) {
        src = $('#SVGEditorInputText').val();
    }

    let right = $('#SVGEditorOutput');
    let parsed = $('#SVGEditorParsedView');
    let redraw = document.querySelector('#SVGEditorOutput');
    let iac = document.querySelector('#interActiveControl');

    let ret = renderGum(src, size0, redraw);
    if (ret.success) {
        iac.innerHTML = '';
        right.html(ret.svg);
        parsed.html(SyntaxHL(ret.svg, 'svg'));
        if (ret.anchors) {
            iac.append(...ret.anchors);
            $(iac).find('.slider_input').each((i,s) => {updateSliderValue(s);});
        }
    } else {
        parsed.text(`parse error, line ${ret.line}: ${ret.message}`);
    }
}

function renderGum(src, size, redraw) {
    size = size ?? size0;

    if (src.length == 0) {
        return {success: true, svg: ''};
    }

    let out;
    try {
        out = parseGum(src);
    } catch (e) {
        // the n-2 is to match internal line numbers, there must be a header on e.lines
        return {success: false, message: e.message, line: e.lineNumber - 2};
    }

    if (out == null) {
        return {success: false, message: 'no return value', line: 0};
    }

    let svg;
    let anchors = null;
    if (out instanceof InterActive) {
        anchors = out.createAnchors(redraw);
        out = out.create(redraw);
    }
    if (out instanceof Element) {
        let args = {size: size};
        out = (out instanceof SVG) ? out : new SVG(out, args);
        svg = out.svg();
    } else {
        return {success: false, message: 'did not return gum element', line: 0};
    }

    return {success: true, svg: svg, anchors: anchors};
}

function renderSVG(src, size) {
    size = size ?? size0;

    if (src.match(/ *<svg( |>)/) == null) {
        size = size || 100;
        let [w, h] = (typeof(size) == 'number') ? [size, size] : size;
        src = `<svg viewBox="0 0 ${w} ${h}">\n${src}\n</svg>`;
    }

    return {success: true, svg: src};
}

function parseSVG(mime, src, size, redraw) {
    if (mime == 'image/svg+gum') {
        return renderGum(src, size, redraw);
    } else if (mime == 'image/svg+xml') {
        return renderSVG(src, size);
    }
}

function svgSyntaxHL() {
    let src = $('#SVGEditorInputText').val();
    let out = SyntaxHL(src, 'gum');
    $('#SVGEditorInputView').html(out);
}

///editor fucntions

let brac_wraps = {'[': ['[',']'],
                '{': ['{','}'],
                '(': ['(',')'],
                '\'': ['\'','\'', true],
                '\"': ['\"','\"', true],
                '\`': ['\`','\`', true],
            };

function getindent(input,c) {
    let raw = input.val();
    let beg = raw.slice(0,c);
    let line = beg.split('\n').at(-1);
    let indent = line.match(/^([\t| ]*)(?:$|\S)/);
    let out, loc;
    indent = indent ? indent[1] : "";
    if(raw[c-1] in brac_wraps && !brac_wraps[raw[c-1]][2] ){
        if(raw[c] == brac_wraps[raw[c-1]][1]){
        out = beg + '\n\t' + indent + '\n' + indent + raw.slice(c);
        loc = (beg + '\n\t' + indent).length;
        }else {
        out = beg + '\n\t' + indent + raw.slice(c);
        loc = out.length - raw.slice(c).length;
        }
    } else {
        out = beg + '\n' + indent + raw.slice(c);
        loc = out.length - raw.slice(c).length;
    }
    input.val(out).trigger('input');
    input[0].setSelectionRange(loc,loc);
    return false
}

export { hideSVGEditor, initSVGEditor, parseSVG };
