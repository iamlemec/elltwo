import { EditorView, drawSelection, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { lineNumbers, highlightActiveLineGutter } from '@codemirror/gutter'
import { history, historyKeymap } from '@codemirror/history'
import { indentOnInput } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { xml } from '@codemirror/lang-xml'
import { defaultKeymap, indentWithTab, insertTab } from '@codemirror/commands'
import { commentKeymap } from '@codemirror/comment'
import { defaultHighlightStyle } from '@codemirror/highlight'
import { bracketMatching } from '@codemirror/matchbrackets'

import { SVG, Element, InterActive, parseGum } from './lib/gum.js'

// svg presets
let prec = 2;
let size = 500;

// global elements
let code = document.querySelector('#code');
let conv = document.querySelector('#conv');
let disp = document.querySelector('#disp');
let stat = document.querySelector('#stat');
let copy = document.querySelector('#copy');
let mid = document.querySelector('#mid');
let left = document.querySelector('#left');
let right = document.querySelector('#right');
let iac = document.querySelector('#interActiveControl');

// wrap in SVG if needed
function renderGum(out) {
    let svg;
    let anchors = null;
    let redraw = document.querySelector('#disp');
    let iac = document.querySelector('#interActiveControl');
    iac.innerHTML = '';

    if (out instanceof InterActive) {
        anchors = out.createAnchors(redraw);
        out = out.create(redraw);
        iac.append(...anchors)
    }
    if (out instanceof Element) {
        let args = {size: size, prec: prec};
        out = (out instanceof SVG) ? out : new SVG(out, args);
        svg = out.svg();
        return svg
    } else {
        return String(out);
    }
}

// example code
let example0 = `
let n = 12;
let r = Rect();
let s = Group(
  range(-90, 90, 180/n).map(t => Ray(t))
);
let hs = HStack([s, s]);
let vs = VStack([hs, hs]);
let gg = Group([vs, r]);
return Frame(gg, {border: 1, margin: 0.05});
`.trim();

// initial value
let urlParams = new URLSearchParams(window.location.search);
let source = urlParams.get('source');
let cook = getCookie();
let example = source ?? cook ?? example0;

// canned error messages
let err_nodata = 'No data. Does your final line return an element?';

function getText(state) {
    return state.doc.toString();
}

function setConvert(text) {
    let len = conv_text.state.doc.length;
    let upd = conv_text.state.update({
        changes: {from: 0, to: len, insert: text}
    });
    conv_text.dispatch(upd);
}

function setState(good) {
    if (good == null) {
        stat.classList = [];
    } else if (good) {
        stat.classList = ['good'];
    } else {
        stat.classList = ['bad'];
    }
}

function getCookie() {
    let cookies = document.cookie.split(';').map(x => x.trim().split('='));
    let cgum = cookies.filter(([k, v]) => k == 'gum').shift();
    if (cgum == null) {
        return null;
    } else {
        let [_, vgum] = cgum;
        return decodeURIComponent(vgum);
    }
}

function setCookie(src) {
    let vgum = encodeURIComponent(src);
    document.cookie = `gum=${vgum}; SameSite=Lax`;
}

async function updateView(src) {
    setCookie(src);

    // parse gum into tree
    let elem;
    try {
        elem = await parseGum(src);
    } catch (err) {
        if (err == 'timeout') {
            setConvert('function timeout');
        } else {
            setConvert(`parse error, line ${err.lineNumber}: ${err.message}\n${err.stack}`);
        }
        setState(false);
        return;
    }

    // render gum tree
    if (elem == null) {
        setConvert(err_nodata);
        setState();
    } else {
        let svg;
        try {
            svg = renderGum(elem);
        } catch (err) {
            setConvert(`render error, line ${err.lineNumber}: ${err.message}\n${err.stack}`);
            setState(false);
            return;
        }
        setConvert(svg);
        setState(true);
        disp.innerHTML = svg;
    }
}

// init convert
let conv_text = new EditorView({
    state: EditorState.create({
        doc: '',
        extensions: [
            xml(),
            drawSelection(),
            defaultHighlightStyle.fallback,
            EditorState.readOnly.of(true),
            EditorView.editable.of(false),
        ],
    }),
    parent: conv,
});

// init editor
let edit_text = new EditorView({
    state: EditorState.create({
        doc: example,
        extensions: [
            javascript(),
            history(),
            drawSelection(),
            lineNumbers(),
            bracketMatching(),
            keymap.of([
                indentWithTab,
                ...defaultKeymap,
                ...historyKeymap,
                ...commentKeymap,
            ]),
            defaultHighlightStyle.fallback,
            EditorView.updateListener.of(upd => {
                if (upd.docChanged) {
                    console.log('updating');
                    let text = getText(upd.state);
                    updateView(text);
                }
            }),
        ],
    }),
    parent: code,
});

// connect handlers
copy.addEventListener('click', evt => {
    let text = conv_text.state.doc.toString();
    navigator.clipboard.writeText(text);
});

// trigger input
let text = getText(edit_text.state);
updateView(text);

// resize panels
function resizePane(e) {
    let vw = window.innerWidth;
    let x = e.clientX;
    left.style.width = `${x-2}px`;
    right.style.width = `${vw-x-2}px`;
}

mid.addEventListener('mousedown', evt => {
    document.addEventListener('mousemove', resizePane, false);
}, false);

document.addEventListener('mouseup', evt => {
    document.removeEventListener('mousemove', resizePane, false);
}, false);
