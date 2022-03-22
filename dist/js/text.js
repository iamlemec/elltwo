import './marklez.js';
import { SyntaxHL, braceMatch } from './hl.js';
import { config } from './state.js';
import { ccRefs } from './article.js';

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
            this.complete();
            this.highlight();
        });
        this.text.addEventListener('keyup', e => {
            this.braceMatch();
        });
        this.text.addEventListener('keydown', e => {
            if (state.cc) {
                return;
            }
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

    complete() {
        let raw = this.getText();
        let cur = this.getCursorPos();
        ccRefs(this.view, raw, cur, config.cmd);
    }

    highlight() {
        let raw = this.text.value;
        let parsed = SyntaxHL(raw, this.lang);
        this.view.innerHTML = parsed;
    }

    async braceMatch() {
        let hl = await braceMatch(this.text, this.view);
        if (hl) {
            this.highlight();
        }
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

export { TextEditorNative };
