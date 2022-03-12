export { TextEditor }

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

class TextEditor {
    constructor(parent, eventHandler) {
        this.lang = 'markdown';
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
                    this.language.of(markdown()),
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
                effects: this.language.reconfigure(markdown())
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
