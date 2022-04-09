import { SyntaxHL, braceMatch } from './hl.js';
import { state, config } from './state.js';
import { ccRefs } from './article.js';
import { unEscCharCount } from './utils.js';

let wraps = {
    'i': ['*', '*'],
    'b': ['**', '**'],
    'm': ['$', '$'],
    '`': ['`', '`'],
    'n': ['^[', ']'],
    'k': ['[', ']()'],
    'tab': ['    ', ''],
};

let brac_wraps = {
    '[': ['[', ']'],
    '{': ['{', '}'],
    '(': ['(', ')'],
    '$': ['$', '$', true],
    '\'': ['\'', '\'', true],
    '\"': ['\"', '\"', true],
    ']': ['', ']', true],
    '}': ['', '}', true],
    ')': ['', ')', true],
};

function textWrapAbstract(raw, beg, end, left, right) {
    let b = raw.slice(0, beg);
    let m = raw.slice(beg, end);
    let e = raw.slice(end, raw.length);
    return b + left + m + right + e;
}

class UndoStack {
    constructor() {
        this.stack = [];
        this.pos = null;
        this.breakpoint = false;
        this.lastbreak = 0;
    }

    len() {
        return this.stack.length;
    }

    push(raw, cur) {
        cur = cur ?? raw.length;

        if (this.breakpoint) { // make it easier to undo---word at a time
            // if breakpoint is set, we collapse everything since last breakpoint
            this.stack = this.stack.slice(0, this.lastbreak + 2);
            this.breakpoint = false;
            this.pos = this.stack.length - 1;
            this.lastbreak = this.pos;
        }

        if (this.stack.length > config.max_undo) {
            this.stack.shift();
        }

        this.stack.push([raw, cur]);
        this.pos = this.stack.length - 1;
    }

    pop(redo=false) {
        if (this.stack.length == 0) {
            return null;
        }

        let new_pos = redo ?
            Math.min(this.pos + 1, this.stack.length - 1) :
            Math.max(this.pos - 1, 0);

        if (this.pos == new_pos) {
            return null;
        }

        this.pos = new_pos;
        return this.stack[new_pos];
    }

    break() {
        this.breakpoint = true;
    }
}

class TextEditorNative {
    constructor(parent, opts) {
        let { handler, lang, edit, mini } = opts ?? {};
        edit = edit ?? false;

        // editor components
        this.parent = parent;
        this.handler = handler;
        this.undoStack = new UndoStack();
        this.timeout = null;

        // editor config
        this.lang = lang ?? 'elltwo';
        this.mini = mini ?? true;

        this.text = document.createElement('textarea');
        this.text.classList.add('p_input_text','text_overlay');
        this.text.setAttribute('readonly', !edit);
        this.text.addEventListener('input', e => {
            let raw = this.getText();
            let cur = this.getCursorPos();
            this.undoStack.push(raw, cur);
            this.update();
            this.complete();
            this.event('input', e);
        });
        this.text.addEventListener('keydown', e => {
            let key = e.key.toLowerCase();
            let ctrl = e.ctrlKey;
            e.altKey;
            let meta = e.metaKey;
            let shift = e.shiftKey;
            let space = e.keyCode == 32;

            if (state.cc) {
                return;
            }

            this.braceMatch();

            if (key == 'arrowleft') {
                return this.event('left', e);
            } else if (key == 'arrowright') {
                return this.event('right', e);
            } else if (key == 'arrowup') {
                return this.event('up', e);
            } else if (key == 'arrowdown') {
                return this.event('down', e);
            } else if ((ctrl || meta) && key in wraps) {
                this.textWrap(wraps[key]);
                e.preventDefault();
            } else if (key in brac_wraps) {
                if (this.textWrap(brac_wraps[key])) {
                    e.preventDefault();
                }
            } else if (key == 'tab') {
                this.textWrap(wraps['tab']);
                e.preventDefault();
            } else if (key == 'backspace') {
                this.clearCorrect();
                if (this.textUnwrap()) {
                    e.preventDefault();
                }
            } else if ((ctrl || meta) && key == 'z') {
                let ret = this.undoStack.pop(shift);
                if (ret != null) {
                    let [raw, cur] = ret;
                    this.setText(raw, false);
                    this.setCursorPos(cur);
                }
            } else if (space) {
                if(config.ac){
                    this.correct();
                }
                this.undoStack.break();
            }
        });
        this.text.addEventListener('mouseup', e => {
            this.braceMatch();
        });

        //syntaxHL viewer
        this.view = document.createElement('div');
        this.view.classList.add('p_input_view','text_overlay');

        //bracket match viewer
        this.brace = document.createElement('div');
        this.brace.classList.add('p_input_brace','text_overlay');

        this.setEditable(edit);
        parent.appendChild(this.view);
        parent.appendChild(this.brace);
        parent.appendChild(this.text);

        //ac viewer
        if(config.ac){
            this.ac = document.createElement('div');
            this.ac.classList.add('p_input_ac','text_overlay');
            parent.appendChild(this.ac);
        }
    }

    focus() {
        if (this.getEditable()) {
            this.text.focus();
            return this;
        }
    }

    update() {
        if (this.mini) {
            this.resize();
        }
        this.highlight();
    }

    resize() {
        this.text.style.height = 'auto';
        let height = `${this.text.scrollHeight + 4}px`;
        this.text.style.height = height;
        this.parent.style.setProperty('min-height', height);
    }

    event(c, e) {
        if (this.handler != null) {
            return this.handler(this, c, e);
        }
    }

    getLength() {
        return this.text.value.length;
    }

    getText() {
        return this.text.value;
    }

    setText(text, save=true) {
        this.text.value = text;
        this.update();
        this.text.dispatchEvent(new Event('input', {bubbles:true}));
        if (save) {
            let raw = this.getText();
            let cur = this.getCursorPos();
            this.undoStack.push(raw, cur);
        }
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

    getSelection() {
        return [this.text.selectionStart, this.text.selectionEnd];
    }

    complete() {
        let raw = this.getText();
        let cur = this.getCursorPos();
        ccRefs(this.brace, raw, cur, config.cmd);
    }

    highlight() {
        let raw = this.text.value;
        let parsed = SyntaxHL(raw, this.lang);
        this.view.innerHTML = parsed;
    }

    correct() {
        this.clearCorrect();
        let cur = this.getSelection();
        cur = (cur[0] == cur[1]) ? cur[0] : false;
        if(!cur){
            return;
        }
        let raw = this.text.value;
        let last = raw.substring(0,cur).split(' ').pop();
        let correction = state.ac.correct(last);
        if(correction){
            let len = cur-last.length;
            let newtxt = raw.substring(0, len) + correction + raw.substring(cur);
            let newwrap = raw.substring(0, len) + `<span id="correction" revert="${last}">${correction}</span>` + raw.substring(cur);
            this.setText(newtxt);
            this.ac.innerHTML = newwrap;
            this.setCursorPos(len + correction.length);
            document.getElementById('correction').addEventListener('click', () => this.unCorrect(), false);
        }
    }

    unCorrect() {
        //this is texteditor, overide event
        let cur = this.getSelection();
        cur = (cur[0] == cur[1]) ? cur[0] : false;
        if(!cur){
            return;
        }
        let view = this.ac;
        let pre = view.innerHTML.split('<span')[0];
        let correction = view.querySelector('#correction');
        let revert = correction.getAttribute('revert');
        let cl = correction.textContent.length;
        let len = pre.length + cl;
        let post = this.getText().substring(len);
        this.setText(pre + revert + post);
        this.clearCorrect();
        cur += (revert.length - cl);
        this.focus().setCursorPos(cur);
    }

    clearCorrect() {
        this.ac.innerHTML = "";
    }

    async braceMatch() {
        if (this.timeout != null) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        let text = this.getText();
        let cpos = this.getCursorPos();
        let hled = braceMatch(text, cpos);
        this.brace.innerHTML = hled;
        this.timeout = setTimeout(function() {
            this.timeout = null;
            $('.brace').contents().unwrap();
        }, 800);
    }

    textWrap(wrap) {
        let [left, right, close] = wrap;
        close = close ?? false;

        // get editor state
        let raw = this.getText();
        let [beg, end] = this.getSelection();

        // ignore escaped
        if (raw.charAt(beg-1) == '\\') {
            return false;
        }

        // overwrite extant close bracket
        if (close && raw.charAt(beg) == right) {
            this.setCursorPos(beg+1);
            return true;
        }

        // dont match if closing open math
        if (left && close && unEscCharCount(raw.slice(0, beg), left) % 2 == 1) {
            return false;
        }

        // update text data
        raw = textWrapAbstract(raw, beg, end, left, right);
        this.setText(raw);

        // place cursor
        let off = Math.max(1, left.length);
        let c = (beg == end) ? beg + off : end + left.length + right.length;
        this.setCursorPos(c);

        return true;
    }

    textUnwrap(wrap) {

        // get editor state
        let raw = this.getText();
        let [beg, end] = this.getSelection();

        // ignore escaped
        if (raw.charAt(beg-2) == '\\') {
            return false;
        }

        // get cursor context
        let delChar = raw.charAt(beg-1) || null;
        let nextChar = raw.charAt(beg) || null;

        // kill off wrap
        if (delChar && nextChar && delChar in brac_wraps) {
            let [matchLeft, matchRight] = brac_wraps[delChar];
            if (nextChar == matchRight) {
                raw = raw.slice(0, beg-1) + raw.slice(end+1, raw.length);
                this.setText(raw);
                this.setCursorPos(beg-1);
                return true;
            }
        }

        return false;
    }
}

export { TextEditorNative };
