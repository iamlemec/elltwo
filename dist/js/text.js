import './marklez.js';
import { SyntaxHL } from './hl.js';

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
        this.text.focus();
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

export { TextEditorNative };
