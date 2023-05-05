import { EditorView, drawSelection, lineNumbers, keymap } from '../node_modules/@codemirror/view/dist/index.js';
import { EditorState } from '../node_modules/@codemirror/state/dist/index.js';
import { history, indentWithTab, defaultKeymap, historyKeymap } from '../node_modules/@codemirror/commands/dist/index.js';
import { bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '../node_modules/@codemirror/language/dist/index.js';
import { parseDocument } from './markum.js';

function readWriteEditor(parent, update) {
    return new EditorView({
        state: EditorState.create({
            doc: '',
            extensions: [
                // javascript(),
                history(),
                drawSelection(),
                lineNumbers(),
                bracketMatching(),
                keymap.of([
                    indentWithTab,
                    ...defaultKeymap,
                    ...historyKeymap,
                ]),
                syntaxHighlighting(defaultHighlightStyle),
                EditorView.lineWrapping,
                EditorView.updateListener.of(update),
            ],
        }),
        parent: parent,
    });
}

function getText(state) {
    return state.doc.toString();
}

function setText(editor, text) {
    let len = editor.state.doc.length;
    let upd = editor.state.update({
        changes: {from: 0, to: len, insert: text}
    });
    editor.dispatch(upd);
}

class ElltwoEditor {
    constructor(code, disp, cookie) {
        this.code = code;
        this.disp = disp;
        this.cookie = cookie;

        // init editor
        this.edit_text = readWriteEditor(code, upd => {
            if (upd.docChanged) {
                let text = getText(upd.state);
                this.setCookie(text);
                this.updateView(text);
            }
        });
    }

    setCookie(src) {
        if (this.cookie != null) {
            this.cookie(src);
        }
    }

    setCode(src) {
        setText(this.edit_text, src);
    }

    setDisplay(html) {
        this.disp.innerHTML = html;
    }

    updateView(src) {
        let tree = parseDocument(src);
        let html = tree.html();
        this.setDisplay(html);
    }
}

function enableResize(left, right, mid) {
    let base = left.getBoundingClientRect().left;
    function resizePane(e) {
        let vw = window.innerWidth;
        let x = e.clientX;
        let lw = Math.max(200, x - 2 - base);
        let rw = Math.max(200, vw - x - 2);
        left.style.width = `${lw}px`;
        right.style.width = `${rw}px`;
    }
    
    mid.addEventListener('mousedown', evt => {
        document.addEventListener('mousemove', resizePane, false);
    }, false);
    
    document.addEventListener('mouseup', evt => {
        document.removeEventListener('mousemove', resizePane, false);
    }, false);
}

export { ElltwoEditor, enableResize };
