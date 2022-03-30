import { updateConfig, updateState, state, config, cache } from './state.js';
import { sendCommand, connect, addHandler } from './client.js';
import { renderKatex } from './math.js';
import { hideConfirm, showConfirm } from './editor.js';
import { connectDrops, promptUpload, uploadImage } from './drop.js';
import { KeyCache, createButton, copyText, flash } from './utils.js';
import { SvgEditor, parseSVG } from './svg.js';

/* image library browser */


// config

let default_config = {
    readonly: true,
    max_size: 1024,
    max_imgs: 50,
    svg_key: null,
};

let default_state = {
    timeout: null,
    edit_mode: true,
    svg: null,
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

    // open editor if necessary
    state.svg = new SvgEditor();
    if (config.svg_key) {
        state.svg.open(config.svg_key);
    }
}

function cacheImage() {
    cache.img = new KeyCache('img', async function(key) {
        if (key == '__img') {
            console.log('cacheImage::__img');
            return await sendCommand('get_images', {});
        } else {
            let ret = await sendCommand('get_image', {key: key});
            if (ret == null) {
                return null;
            } else if (ret.mime == 'image/svg+gum') {
                return ret.data;
            } else {
                return new Blob([ret.data], {type: ret.mime});
            }
        }
    });
}

function connectImage() {
    let url = `//${document.domain}:${location.port}`;
    connect(url, async function() {
        sendCommand('join_room', {'room': '__img'});
    });

    addHandler('invalidateRef', function(data) {
        let [type, refkey] = data;
        if (type == 'img') {
            cache.img.del('__img');
            cache.img.del(refkey);
            imageQuery();
        }
    });
}

async function deleteImage(key) {
    if (await sendCommand('delete_image', {'key': key})) {
        let img = $(`#${key}`);
        cache.img.del('__img');
        img.parent('.img_cont').remove();
        hideDisplay();
        state.svg.close();
        $('#query').focus();
    }
}

function eventImage() {
    connectDrops(function(box, data) {
        let key = data.key;
        let mime = data.mime;
        let kws = '';
        let div = $('<div>', {class: 'img_cont img_src'});
        $('#dropzone').after(div);
        renderBox(div, key, kws, mime);
    });

    $(document).on('click', '.img_src', function(e) {
        let img = $(this);
        let key = img.attr('id');
        let kw = img.attr('kw') || '';

        if (img.hasClass('svg')) {
            state.key = key;
            let mime = img.attr('mime');
            let raw = img.attr('raw');
            mime.replace(/text\/svg\+(.+)/, '$1');
            state.svg.open(key, raw);
        } else {
            let ks = $(e.target).closest('.keyspan');
            if (ks.length > 0) {
                $('.keyspan').removeClass('copied');
                copyKey(ks);
                $(ks).addClass('copied');
            } else {
                let src = img.children('img').attr('src');
                state.key = key;
                state.keywords = kw;
                $('#display_image').attr('src', src);
                $('input#key').val(key);
                $('input#keywords').val(kw);
                $('#display').show();
            }
        }
    });

    $(document).on('click', '#bg', function(e) {
        let targ = $(e.target);
        if (targ.closest('.img_cont').length == 0
                && targ.closest('#display').length == 0
                && targ.closest('#svgEditorOuter').length == 0) {
            hideDisplay();
            $('#query').focus();
        }
    });

    $(document).on('click', '#open_svg_editor', function() {
        state.svg.open();
    });

    $(document).on('keyup', function(e) {
        let key = e.key.toLowerCase();
        if (key == 'escape') {
            if(state.confirm){
                hideConfirm();
            }else {
                hideDisplay();
                state.svg.close();
            }        }
    });

    $(document).on('click', '#img_update', async function() {
        let key = state.key;
        let kw = state.kw;
        let new_key = $('input#key').val();
        let new_kw = $('input#keywords').val();
        if (key != new_key || kw != new_kw) {
            if (await sendCommand('update_image_key', {key, new_key, new_kw})) {
                let img = $(`#${key}`);
                img.attr('id', new_key);
                img.attr('kw', new_kw);
                img.siblings('.keyspan').text(new_key);
                cache.img.del('__img');
                $('#display').hide();
                $('#query').focus();
                imageQuery();
            }
        }
    });

    $(document).on('click', '#img_delete', function() {
        let key = state.key;
        let txt = `Delete Image "${key}"?`;
        let del = createButton('ConfirmDelete', 'Delete', 'delete');
        let action = function(){
            deleteImage(key);
        };
        showConfirm(del, action, txt);
    });

    $(document).on('click', '#display_upload', function() {
        let key = state.key;
        $(`#${key}`);
        promptUpload(function(files) {
            let file = files[0];
            uploadImage(file, key, function(data) {
                cache.img.del(key);
                cache.img.get(key, function(ret) {
                    let url = URL.createObjectURL(ret);
                    $('#display_image').attr('src', url);
                    $(`#${key}`).attr('src', url);
                });
            });
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

async function imageQuery(query) {
    if (query == undefined) {
        query = $('#query').val();
    }
    let ret = await cache.img.get('__img');
    let img_sel;
    if (query.length > 0) {
        let terms = query.split(' ');
        img_sel = ret.filter(img => wordSearch(img, terms) > 0);
    } else {
        img_sel = ret;
    }
    renderImages(img_sel);
}

function renderImages(img_list) {
    $('.img_src').remove();
    let imgs_n = img_list.slice(0, config.max_imgs);
    imgs_n.forEach(img => {
        let [key, kws, mime] = img;
        let img_cont = $('<div>', {class: 'img_cont img_src'});
        $('#img_results').append(img_cont);
        renderBox(img_cont, key, kws, mime);
    });
}
async function renderBox(elem, key, kws, mime) {
    elem.attr('id', key);
    elem.attr('kw', kws);
    let keyspan = $('<div>', {class: 'keyspan', text: key});
    elem.append(keyspan);

    if (mime == 'image/svg+gum') {
        let ret = await cache.img.get(key);
        let size = elem.height();
        let svg = parseSVG(mime, ret, size);
        if (!svg.success) {
            elem.html(svg.message);
        } else {
            elem.html(svg.svg);
            elem.addClass('svg');
            elem.attr('mime', mime);
            elem.attr('raw', ret);
        }
    } else {
        let img = $('<img>');
        elem.append(img);
        let ret = await cache.img.get(key);
        let url = URL.createObjectURL(ret);
        img.attr('src', url);
    }
 }

function copyKey(keyspan) {
    let ks = $(keyspan).text();
    copyText(ks);
    flash(`ImageKey "${ks}" copied to clipboard`);
}
function hideDisplay() {
    let disp = $('#display');
    if (disp.is(':visible')) {
        state.key = null;
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
}

export { deleteImage, initImage };
