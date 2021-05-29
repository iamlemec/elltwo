/* image library browser */

import { connect, sendCommand } from './client.js'
import { renderKatex } from './math.js'
import { connectDrops, renderImage } from './drop.js'

// hard coded options

let max_imgs = 50;

// rendering

function renderBox(elem, key) {
    let img = $('<img>', {id: key});
    elem.append(img);

    let keyspan = $('<div>', {class: 'keyspan', text: key});
    elem.append(keyspan);

    renderImage(img, key);
 }

function renderImgs(img_list=imgs) {
    $('.img_src').remove();
    let imgs_n = img_list.slice(0, max_imgs);
    imgs_n.forEach(img => {
        let [key, kws] = img;
        let img_cont = $('<div>', {class: 'img_cont img_src'});
        $('#img_results').append(img_cont);
        renderBox(img_cont, key);
    });
};

function copyKey(keyspan) {
    let textArea = document.createElement("textarea");
    textArea.value = $(keyspan).text();
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("Copy");
    textArea.remove();
};

// interface

connectDrops(function(box, data) {
    let key = data.key;
    let div = $('<div>', {class: 'img_cont img_src', id: key});
    $('#dropzone').after(div);
    imgs.push([key, '']);
    renderBox(div, key);
});

$(document).on('click', '.img_src', function(e) {
    let img = $(this).children('img');
    let key = img.attr('id');
    let ks = $(e.target).closest('.keyspan');
    if (ks.length > 0) {
        $('.keyspan').removeClass('copied');
        copyKey(ks);
        $(ks).addClass('copied');
    } else {
        let src = img.attr('src');
        let kw = img.attr('kw') || '';
        $('#display').attr('key', key)
                     .attr('keywords', kw);
        $('#display_img').attr('src', src);
        $('input#key').val(key);
        $('input#keywords').val(kw);
        $('#display').show();
    }
});

$(document).on('click', '#bg', function(e) {
    if ($(e.target).closest('.img_cont').length == 0 && $(e.target).closest('#display').length == 0){
        $('#display').hide();
    }
});

$(document).on('click', '#img_update', function() {
    let key = $('#display').attr('key');
    let kw = $('#display').attr('keywords');
    let new_key = $('input#key').val();
    let new_kw = $('input#keywords').val();
    if (key != new_key || kw != new_kw) {
        let data = {'key': key, 'new_key': new_key, 'new_kw': new_kw};
        sendCommand('update_image_key', data, (ret) => {
            if (ret.found) {
                let img = $(`#${key}`);
                img.attr('id', new_key);
                img.attr('kw', new_kw);
                img.parent('.img_cont').attr('key', new_key);
                img.siblings('.keyspan').text(new_key);
                $('#display').hide();
            }
        });
    }
});

// search mechanism

function mSearch(img, list) {
    let value = 0;
    let target = img[0] + img[1];
    list.forEach(word => {
      value = value + target.includes(word);
    });
    return value;
};

let timeout = null;

$(document).on('keyup', '#img_search', function(e) {
    clearTimeout(timeout);
    timeout = setTimeout(function() {
        let ss = $('#img_search').val();
        if (ss) {
            let s_terms = ss.split(' ');
            let imgs_s = imgs.filter(img => mSearch(img, s_terms) > 0);
            renderImgs(imgs_s);
        } else {
            renderImgs();
        }
    }, 300);
});

// startup

$(document).ready(function() {
    let url = `http://${document.domain}:${location.port}`;
    connect(url, () => {
        sendCommand('join_room', {'room': '__img'}, (response) => {
            console.log(response);
        });
    });
    renderKatex();
    renderImgs();
});
