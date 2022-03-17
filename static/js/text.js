export { TextEditorCM, TextEditorNative }

import { elltwo } from './marklez.js'
import { SyntaxHL } from './hl.js'

import { EditorView, drawSelection, keymap } from '@codemirror/view'
import { EditorState, EditorSelection, Compartment } from '@codemirror/state'
import { bracketMatching } from '@codemirror/matchbrackets'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/closebrackets'
import { markdown } from '@codemirror/lang-markdown'
import { javascript } from '@codemirror/lang-javascript'
import { defaultHighlightStyle } from '@codemirror/highlight'
import { history, historyKeymap } from '@codemirror/history'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { lineNumbers, highlightActiveLineGutter } from '@codemirror/gutter'

class TextEditorCM {
    constructor(parent, eventHandler) {
        this.lang = 'elltwo';
        this.editable = new Compartment();
        this.language = new Compartment();
        this.eventHandler = eventHandler;

        this.view = new EditorView({
            state: EditorState.create({
                doc: '',
                extensions: [
                    drawSelection(),
                    bracketMatching(),
                    closeBrackets(),
                    // lineNumbers(),
                    history(),
                    this.language.of(elltwo),
                    this.editable.of(EditorView.editable.of(false)),
                    defaultHighlightStyle.fallback,
                    keymap.of([
                        indentWithTab,
                        { key: 'ArrowLeft', run: e => this.event('left', e) },
                        { key: 'ArrowRight', run: e => this.event('right', e) },
                        { key: 'ArrowUp', run: e => this.event('up', e) },
                        { key: 'ArrowDown', run: e => this.event('down', e) },
                        ...closeBracketsKeymap,
                        ...defaultKeymap,
                        ...historyKeymap,
                    ]),
                    EditorView.lineWrapping,
                    EditorView.updateListener.of(upd => {
                        if (upd.docChanged) {
                            console.log('updating');
                        }
                    }),
                ],
            }),
            parent: parent,
        });
    }

    focus() {
        this.view.focus();
    }

    event(c, e) {
        return this.eventHandler(this, c, e);
    }

    getLength() {
        return this.view.state.doc.length;
    }

    getText() {
        return this.view.state.doc.toString();
    }

    setText(text) {
        let len = this.getLength();
        let upd = this.view.state.update({
            changes: {from: 0, to: len, insert: text}
        });
        this.view.dispatch(upd);
    }

    getEditable() {
        return this.view.state.facet(EditorView.editable);
    }

    setEditable(rw) {
        this.view.dispatch({
            effects: this.editable.reconfigure(EditorView.editable.of(rw))
        });
    }

    getLanguage() {
        return this.lang;
    }

    setLanguage(lang) {
        if (this.lang == lang) return;
        this.lang = lang;

        if (lang == 'elltwo') {
            this.view.dispatch({
                effects: this.language.reconfigure(elltwo)
            })
        } else if (lang == 'gum') {
            this.view.dispatch({
                effects: this.language.reconfigure(javascript())
            })
        }
    }

    getCursorPos() {
        return this.view.state.selection.main.head;
    }

    setCursorPos(start, end) {
        end = end ?? start;
        this.view.dispatch({
            selection: EditorSelection.single(start, end)
        });
    }
}

class TextEditorNative {
    constructor(parent, eventHandler) {
        this.lang = 'elltwo';
        this.parent = parent;
        this.eventHandler = eventHandler;

        this.text = document.createElement('textarea');
        this.text.classList.add('p_input_text');
        this.text.setAttribute('readonly', true);
        this.text.addEventListener('input', e => {
            this.resize();
            this.highlight();
        });
        this.text.addEventListener('keydown', e => {
            if (e.key == 'ArrowLeft') {
                return this.event('left', e);
            } else if (e.key == 'ArrowRight') {
                return this.event('right', e);
            } else if (e.key == 'ArrowUp') {
                return this.event('up', e);
            } else if (e.key == 'ArrowDown') {
                return this.event('down', e);
            }
        });

        this.view = document.createElement('div');
        this.view.classList.add('p_input_view');

        parent.appendChild(this.view);
        parent.appendChild(this.text);
    }

    focus() {
        if (this.getEditable()) {
            this.text.focus();
        }
        this.resize();
        this.highlight();
    }

    resize() {
        this.text.style.height = 'auto';
        let height = `${this.text.scrollHeight}px`;
        this.text.style.height = height;
        this.parent.style.setProperty('min-height', height);
    }

    highlight() {
        let raw = this.text.value;
        let parsed = SyntaxHL(raw, this.lang);
        this.view.innerHTML = parsed;
    }

    event(c, e) {
        return this.eventHandler(this, c, e);
    }

    getLength() {
        return this.text.value.length;
    }

    getText() {
        return this.text.value;
    }

    setText(text) {
        this.text.value = text;
    }

    getEditable() {
        return !this.text.readOnly;
    }

    setEditable(rw) {
        this.text.readOnly = !rw;
    }

    getLanguage() {
        return this.lang;
    }

    setLanguage(lang) {
        this.lang = lang;
    }

    getCursorPos() {
        return this.text.selectionStart;
    }

    setCursorPos(start, end) {
        end = end ?? start;
        this.text.setSelectionRange(start, end);
    }
}
