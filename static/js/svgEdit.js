/* random utilities */

export {
    initSVGEditor, parseSVG
}

import {
    state
} from './state.js'
import { sendCommand } from './client.js'


function createIcon(id){
    let icon = `<svg>
                <use xlink:href="/static/img/icons.svg#${id}"></use>
                </svg>`
    return icon;
}

function initSVGEditor(el, raw="", key=""){
    //el = element to append editor
    if(state.SVGEditor){
        $('#SVGEditorInput').val(raw)
        $('#SVGEditorTag').val(key)
        inputToParse();
        $('#SVGEditorBox').show();
    } else {
        let editBox = $('<div>', {id: 'SVGEditorBox'});
        //I/O
        let left = $('<div>', {id: 'SVGEditorBoxLeft'});
        let right = $('<div>', {id: 'SVGEditorBoxRight'});
        let input = $('<textarea>', {id: 'SVGEditorInput'});
        input.attr('placeholder',  'Add SVG code here.')
        let output = $('<div>', {id: 'SVGEditorOutput'});
        let tag = $('<input>', {id: 'SVGEditorTag'});
        tag.attr('placeholder',  'Image Tag (Required).');
        let view = $('<svg>', {id: 'SVGview'});
        view.attr('viewBox', '0 0 100 100');
        right.append(output);
        right.append(tag);
        left.append(input)
        editBox.append(left).append(right);
        //nav
        let nav = $('<div>', {id: 'SVGEditorNav'});
        let exit = $('<button>', {id: 'SVGEditorExit', text: "Exit Editor", class: "foot_butt"});
        let commit = $('<button>', {id: 'SVGEditorCommit', text: "Commit", class: "foot_butt"});
        exit.append(createIcon('hist'));
        commit.append(createIcon('exp'));
        nav.append(commit).append(exit);
        editBox.append(nav);


        el.append(editBox);

        if(raw){
            $('#SVGEditorInput').val(raw)
            $('#SVGEditorTag').val(key)
        }

        inputToParse();


        if(!state.SVGEditor){
            state.SVGEditor = true;  
        }
    }

    $(document).on('click', '#SVGEditorExit', function() {
        $('#SVGEditorBox').hide();
    });

    $(document).on('input', '#SVGEditorInput', function(e) {
        inputToParse();

    });

    $(document).on('focus', '#SVGEditorTag', function(e) {
        $(this).removeClass('input_err')
    });

    $(document).on('click', '#SVGEditorCommit', function(e) {
        if(key = $('#SVGEditorTag').val()){
            let raw = $('#SVGEditorInput').val()
            let data = {'key': key, 'raw': raw};
            sendCommand('saveSVG', data, (ret) => {
                if (ret) {
                    console.log(ret)
                };
            });
        } else {
            $('#SVGEditorTag').addClass('input_err')
        };
    });
};


function inputToParse(raw=null){
        if(raw===null){
            raw = $('#SVGEditorInput').val();
        }

        let out = parseSVG(raw);
        
        $('#SVGEditorOutput').html(out);
}

function parseSVG(raw){

        if(!raw.startsWith('<svg ')){
            raw = `<svg viewBox="0 0 100 100">\n${raw}\n</svg>`;
        };
        
        return raw
}

