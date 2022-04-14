/* random utilities */

export { SvgEditor, parseSVG }

import {
    on_success, createIcon, createToggle, createButton, smallable_butt,
    updateSliderValue, cur, flash
} from './utils.js'
import { cache, config, state } from './state.js'
import { sendCommand } from './client.js'
import { replace } from './marked3.js'
import { showConfirm, makeActive, sendUpdatePara } from './editor.js'
import { deleteImage } from './img.js'
import { TextEditorNative } from './text.js'
import { SVG, Element, InterActive, parseGum } from 'gum.js'

let prec0 = 2;
let size0 = 500;

class SvgEditor {
    constructor() {
        let edit = document.querySelector('#svgEditorTextGum');
        let view = document.querySelector('#svgEditorTextSvg');
        let divi = document.querySelector('#svgWidthDisplay');
        let tago = document.querySelector('#svgEditorTag');
        let nvup = document.querySelector('#svgEditorNavUp');
        let nvdn = document.querySelector('#svgEditorNavDown');

        // init text editors
        this.edit = new TextEditorNative(edit, {
            lang: 'gum', edit: true, mini: false, autocorrect: false,
            handler: (t, c, e) => { this.event(t, c, e); },
        });
        this.view = new TextEditorNative(view, {
            lang: 'svg', edit: false, mini: false
        });

        // state params
        this.prec = prec0;
        this.size = size0;
        this.show = false;
        this.butts = {};

        // custom buttons and toggles
        let btog = createToggle('svgShow', 'Show SVG');
        let bcom = createButton('svgEditorCommit', 'Commit', 'exp', this.butts);
        let bdel = createButton('svgEditorDelete', 'Delete', 'delete', this.butts);
        let bext = createButton('svgEditorExit', 'Exit', 'exit', this.butts);

        nvup.innerHTML = btog;
        nvdn.appendChild(bcom[0]);
        nvdn.appendChild(bdel[0]);
        nvdn.appendChild(bext[0]);
        smallable_butt(this.butts);

        let show = document.querySelector('#svgShow_check');
        let exit = document.querySelector('#svgEditorExit');
        let dele = document.querySelector('#svgEditorDelete');
        let comt = document.querySelector('#svgEditorCommit');

        let ahh = document.querySelector('#svgEditorTextGum');

        window.addEventListener('popstate', e => {
            this.close();
        });

        window.addEventListener('resize', e => {
            smallable_butt(this.butts);
        });

        exit.addEventListener('click', e => {
            let txt = 'Uncommited changes will be lost';
            let exit = createButton('confirmExit', 'Exit', 'exit');
            let action = () => { state.svg.close(); };
            showConfirm(exit, action, txt);
        });

        dele.addEventListener('click', e => {
            if (this.key != null) {
                let txt = `Delete Image "${this.key}"?`
                let del = createButton('confirmDelete', 'Delete', 'delete');
                let action = () => { deleteImage(key); };
                showConfirm(del, action, txt);
            }
        });

        show.addEventListener('change', e => {
            if (show.matches(':checked')) {
                view.style.display = 'block';
                edit.classList.remove('fullsize');
            } else {
                view.style.display = 'none';
                edit.classList.add('fullsize');
            }
        });

        let that = this;
        comt.addEventListener('click', async function(e) {
            let key = tago.value;
            if (key.length > 0) {
                let raw = that.edit.getText();
                let data = {key: key, mime: 'image/svg+gum', raw: raw};
                sendCommand('save_svg', data);
            } else {
                tago.classList.add('input_err');
            }
        });

        // center divider resize
        let control;
        divi.addEventListener('mousedown', e => {
            control = new AbortController();
            document.addEventListener('mousemove', u => {
                this.resize(u);
            }, {signal: control.signal});

            document.addEventListener('mouseup', function up() {
                control.abort();
                this.removeEventListener('mouseup', up)
            }, false);

        }, false);
    }

    async open(key, raw) {
        let hoot = document.querySelector('#hoot');
        let logo = document.querySelector('#logo');
        let outr = document.querySelector('#svgEditorOuter');
        let tago = document.querySelector('#svgEditorTag');

        // check permissions
        if (config.readonly) {
            flash('SVG editor not available in readonly mode');
            return;
        }

        // get raw text
        if (key == null) {
            key = '';
            raw = '';
        } else if (raw == null) {
            raw = await cache.img.get(key);
            if (raw == null) {
                flash(`gum image "${key}" does not exist`);
                raw = '';
            }
        }

        // handle back button
        let [url] = window.location.href.split('?');
        window.history.pushState({'svgEditor': true}, null, `${url}?svg_key=${key}`);

        // update text
        this.edit.setText(raw.data);
        this.view.setText('');
        tago.value = key;
        this.render();

        // show elements
        if(logo){
            logo.style.visibility = 'hidden';
        }
        hoot.innerHTML = '[201p // iamlemec] — gum.js';
        outr.style.visibility = 'unset';

        // update state
        this.show = true;
        this.key = key;
    }

    close() {
        if (!this.show) {
            return;
        }

        let hoot = document.querySelector('#hoot');
        let logo = document.querySelector('#logo');
        let outr = document.querySelector('#svgEditorOuter');

        // handle back button
        let [url] = window.location.href.split('?');
        window.history.pushState({'svgEditor': false}, null, url);

        // hide elements
        hoot.innerHTML = '[201p // iamlemec]';
        outr.style.visibility = 'hidden';
        if(logo){
            logo.style.visibility = 'unset';
        }


        // update state
        this.show = false;
        this.key = null;
    }

    resize(e) {
        let left = document.querySelector('#svgEditorBoxLeft');
        let right = document.querySelector('#svgEditorBoxRight');

        let x = e.clientX;
        let vw = window.innerWidth;
        x = Math.max(x, 100);
        x = Math.min(x, vw - 300);
        let perc = (x-2)*100/vw;

        left.style.width = `${perc}%`;
        right.style.width = `${100-perc}%`;
    }

    render() {
        let outp = document.querySelector('#svgEditorOutput');
        let iact = document.querySelector('#interActiveControl');

        let raw = this.edit.getText();
        let ret = renderGum(raw, this.size, outp);

        let msg;
        if (ret.success) {
            iact.innerHTML = '';
            outp.innerHTML = ret.svg;
            this.view.setText(ret.svg);
            if (ret.anchors) {
                iact.append(...ret.anchors);
                iact.querySelectorAll('.slider_input').forEach(updateSliderValue);
            }
        } else {
            this.view.setText(`parse error, line ${ret.line}: ${ret.message}`);
        }
    }

    event(t, c, e) {
        this.render();
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
