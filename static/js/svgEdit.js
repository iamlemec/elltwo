/* random utilities */

export { initSVGEditor, parseSVG }

import { state } from './state.js'
import { sendCommand } from './client.js'
import { Gum, SVG, Element } from '../gum.js/gum.js'

function createIcon(id) {
    return `<svg>
            <use xlink:href="/static/img/icons.svg#${id}"></use>
            </svg>`;
}

function initSVGEditor(el, raw='', key='') {
    if (state.SVGEditor) {
        $('#SVGEditorInput').val(raw);
        $('#SVGEditorTag').val(key);
        inputToParse();
        $('#SVGEditorOuter').show();
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

        if (raw) {
            $('#SVGEditorInput').val(raw);
            $('#SVGEditorTag').val(key);
        }

        inputToParse();

        if (!state.SVGEditor) {
            state.SVGEditor = true;
        }
    }

    $(document).on('click', '#SVGEditorExit', function() {
        $('#SVGEditorOuter').hide();
    });

    $(document).on('input', '#SVGEditorInput', function(e) {
        inputToParse();
    });

    $(document).on('focus', '#SVGEditorTag', function(e) {
        $(this).removeClass('input_err');
    });

    $(document).on('click', '#SVGEditorCommit', function(e) {
        if (key = $('#SVGEditorTag').val()) {
            let raw = $('#SVGEditorInput').val();
            let data = {'key': key, 'raw': raw};
            sendCommand('saveSVG', data, (ret) => {
                if (ret) {
                    console.log(ret);
                };
            });
        } else {
            $('#SVGEditorTag').addClass('input_err');
        }
    });
}

let prec = 2;
let gums = Gum.map(g => g.name);

function inputToParse(src=null) {
        if (src === null) {
            src = $('#SVGEditorInput').val();
        }

        let out;
        try {
            let e = new Function(gums, src);
            out = e(...Gum);
        } catch (e) {
            return;
        }

        let right = $('#SVGEditorOutput');
        let [vw, vh] = [right.innerHeight(), right.innerWidth()];
        let size;

        let svg;
        if (out instanceof Element) {
            out = (out instanceof SVG) ? out : new SVG([out]);
            size = 0.8*Math.min(vw, vh);
            svg = out.svg({size: size, prec: prec});
        } else {
            return;
        }
        right.html(svg);

        let view = right.children('svg');
        view.css('margin-left', 0.5*(vw-size));
        view.css('margin-top', 0.5*(vh-size));
}

function parseSVG(raw) {
        if (!raw.startsWith('<svg ')) {
            raw = `<svg viewBox="0 0 100 100">\n${raw}\n</svg>`;
        }
        return raw;
}
