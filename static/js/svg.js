/* random utilities */

export { initSVGEditor, hideSVGEditor, parseSVG }

import { on_success } from './utils.js'
import { state } from './state.js'
import { sendCommand } from './client.js'
import { Gum, SVG, Element } from '../gum.js/gum.js'

function createIcon(id) {
    return `<svg>
            <use xlink:href="/static/img/icons.svg#${id}"></use>
            </svg>`;
}

function initSVGEditor(el, raw='', key='', gum=true) {
    if (state.SVGEditor) {
        $('#SVGEditorInput').val(raw);
        $('#SVGEditorTag').val(key);
        $('#SVGEditorOuter').show();
        renderInput();
    } else {
        let outerBox = $('<div>', {id: 'SVGEditorOuter'});
        let editBox = $('<div>', {id: 'SVGEditorBox'});

        // editor panes
        let left = $('<div>', {id: 'SVGEditorBoxLeft'});
        let right = $('<div>', {id: 'SVGEditorBoxRight'});
        let input = $('<textarea>', {id: 'SVGEditorInput'});
        input.attr('placeholder',  'Add SVG code here.')
        let output = $('<div>', {id: 'SVGEditorOutput'});
        let tag = $('<input>', {id: 'SVGEditorTag'});
        tag.attr('placeholder',  'Image Tag (Required).');
        right.append(output);
        right.append(tag);
        left.append(input)
        editBox.append(left).append(right);

        // navbar
        let navBar = $('<div>', {id: 'SVGEditorNav'});
        let exit = $('<button>', {id: 'SVGEditorExit', text: 'Exit Editor', class: 'foot_butt'});
        let commit = $('<button>', {id: 'SVGEditorCommit', text: 'Commit', class: 'foot_butt'});
        exit.append(createIcon('hist'));
        commit.append(createIcon('exp'));
        navBar.append(commit).append(exit);

        // high level
        outerBox.append(editBox);
        outerBox.append(navBar);
        el.append(outerBox);

        // fill in data
        $('#SVGEditorInput').val(raw);
        $('#SVGEditorTag').val(key);
        renderInput();

        state.SVGEditor = true;
    }

    $(document).on('click', '#SVGEditorExit', function() {
        hideSVGEditor();
    });

    $(document).on('input', '#SVGEditorInput', function() {
        renderInput()
    });

    $(document).on('focus', '#SVGEditorTag', function(e) {
        $(this).removeClass('input_err');
    });

    $(document).on('click', '#SVGEditorCommit', function(e) {
        if (key = $('#SVGEditorTag').val()) {
            let raw = $('#SVGEditorInput').val();
            let data = {'key': key, 'mime': 'text/svg+gum', 'raw': raw};
            sendCommand('save_svg', data);
        } else {
            $('#SVGEditorTag').addClass('input_err');
        }
    });
}

function hideSVGEditor() {
    $('#SVGEditorOuter').hide();
}

// hard-coded options
let prec = 2;

// gum.js interface mapper
let gums = Gum.map(g => g.name);
let mako = Gum.map(g => function(...args) { return new g(...args); });

function renderInput(src) {
    if (src == null) {
        src = $('#SVGEditorInput').val();
    }

    let right = $('#SVGEditorOutput');
    let [vw, vh] = [right.innerHeight(), right.innerWidth()];
    let size = 0.8*Math.min(vw, vh);

    let svg = parseGum(src, size);
    if (svg == null) {
        return;
    }
    right.html(svg);
}

function parseGum(src, size) {
    let out;
    try {
        let e = new Function(gums, src);
        out = e(...mako);
    } catch {
        return;
    }

    let svg;
    if (out instanceof Element) {
        out = (out instanceof SVG) ? out : new SVG([out]);
        svg = out.svg({size: size, prec: prec});
    } else {
        return;
    }

    return svg;
}

function parseSVG(mime, src, size) {
    if (typeof(size) == 'number') {
        size = [size, size];
    }
    if (mime == 'text/svg+gum') {
        return parseGum(src, size);
    } else {
        if (raw.match(/ *<svg( |>)/) == null) {
            let [w, h] = size;
            return `<svg viewBox="0 0 ${w} ${h}">\n${src}\n</svg>`;
        } else {
            return src;
        }
    }
}
