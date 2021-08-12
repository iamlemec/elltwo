/* image library browser */

export { initImage }

import {
    config, state, cache, updateConfig, updateState, updateCache
} from './state.js'
import { connect, sendCommand } from './client.js'
import { renderKatex } from './math.js'
import { connectDrops, makeImageBlob } from './drop.js'
import { KeyCache } from './utils.js'

// config

let default_config = {
    readonly: true,
    max_size: 1024,
    max_imgs: 50,
};

let default_state = {
    timeout: null,
};

// initialize

function initImage(args) {
    updateConfig(default_config, args.config || {});
    updateState(default_state);
    cacheImage();

    connectImage();
    eventImage();

    renderKatex();
    imageQuery();
}

function cacheImage() {
    cache.img = new KeyCache('img', function(key, callback) {
        if (key == '__img') {
            console.log('cacheImage::__img');
            sendCommand('get_images', {}, callback);
        } else {
            sendCommand('get_image', {key: key}, function(ret) {
                let url = (ret !== undefined) ? makeImageBlob(ret.mime, ret.data) : undefined;
                callback(url);
            });
        }
    });
}

function connectImage() {
    let url = `http://${document.domain}:${location.port}`;
    connect(url, () => {
        sendCommand('join_room', {'room': '__img'});
    });
}

function eventImage() {
    connectDrops(function(box, data) {
        let key = data.key;
        let kws = '';
        let div = $('<div>', {class: 'img_cont img_src'});
        $('#dropzone').after(div);
        renderBox(div, key, kws);
    });

    $(document).on('click', '.img_src', function(e) {
        let img = $(this).children('img');
        let ks = $(e.target).closest('.keyspan');
        if (ks.length > 0) {
            $('.keyspan').removeClass('copied');
            copyKey(ks);
            $(ks).addClass('copied');
        } else {
            let key = img.attr('id');
            let src = img.attr('src');
            let kw = img.attr('kw') || '';
            state.key = key;
            state.keywords = kw;
            $('#display_img').attr('src', src);
            $('input#key').val(key);
            $('input#keywords').val(kw);
            $('#display').show();
        }
    });

    $(document).on('click', '#bg', function(e) {
        let targ = $(e.target);
        if (targ.closest('.img_cont').length == 0 && targ.closest('#display').length == 0) {
            hideDisplay();
            $('#query').focus();
        }
    });

    $(document).on('keyup', function(e) {
        let key = e.key.toLowerCase();
        if (key == 'escape') {
            hideDisplay();
        }
    });

    $(document).on('click', '#img_update', function() {
        let key = state.key;
        let kw = state.kw;
        let new_key = $('input#key').val();
        let new_kw = $('input#keywords').val();
        if (key != new_key || kw != new_kw) {
            let data = {'key': key, 'new_key': new_key, 'new_kw': new_kw};
            sendCommand('update_image_key', data, (ret) => {
                if (ret) {
                    let img = $(`#${key}`);
                    img.attr('id', new_key);
                    img.attr('kw', new_kw);
                    img.siblings('.keyspan').text(new_key);
                    cache.img.del('__img');
                    $('#display').hide();
                    $('#query').focus();
                    imageQuery();
                }
            });
        }
    });

    $(document).on('click', '#img_delete', function() {
        let key = state.key;
        sendCommand('delete_image', {'key': key}, (ret) => {
                if (ret) {
                    let img = $(`#${key}`);
                    cache.img.del('__img');
                    img.parent('.img_cont').remove();
                    $('#display').hide();
                    $('#query').focus();
                }
        });
    });

    $(document).on('keyup', '#query', function(e) {
        clearTimeout(state.timeout);
        state.timeout = setTimeout(imageQuery, 300);
    });

    $(document).on('keydown', 'input#key', function(e) {
        let illegal = /[^a-zA-Z\d\_\-]/;
        if (illegal.test(e.key)) {
            return false;
        }
    });
}

// rendering

function imageQuery(query) {
    if (query == undefined) {
        query = $('#query').val();
    }
    cache.img.get('__img', function(ret) {
        let img_sel;
        if (query.length > 0) {
            let terms = query.split(' ');
            img_sel = ret.filter(img => wordSearch(img, terms) > 0);
        } else {
            img_sel = ret;
        }
        renderImages(img_sel);
    });
}

function renderImages(img_list) {
    $('.img_src').remove();
    let imgs_n = img_list.slice(0, config.max_imgs);
    imgs_n.forEach(img => {
        let [key, kws] = img;
        let img_cont = $('<div>', {class: 'img_cont img_src'});
        $('#img_results').append(img_cont);
        renderBox(img_cont, key, kws);
    });
};

function renderBox(elem, key, kws) {
    let img = $('<img>', {id: key, kw: kws});
    elem.append(img);

    let keyspan = $('<div>', {class: 'keyspan', text: key});
    elem.append(keyspan);

    cache.img.get(key, function(ret) {
        img.attr('src', ret);
    });
 }

function copyKey(keyspan) {
    let textArea = document.createElement("textarea");
    textArea.value = $(keyspan).text();
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("Copy");
    textArea.remove();
};

function hideDisplay() {
    let disp = $('#display');
    if (disp.is(':visible')) {
        disp.hide();
    }
}

// search mechanism

function wordSearch(img, list) {
    let value = 0;
    let target = img[0] + img[1];
    list.forEach(word => {
      value = value + target.includes(word);
    });
    return value;
};
