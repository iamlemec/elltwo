// image library

max_imgs = 50;

// rendering

renderBox = function(elem, key) {
    var img = $('<img>', {id: key});
    elem.append(img);

    var keyspan = $('<div>', {class: 'keyspan', text: key});
    elem.append(keyspan);

    renderImage(img, key);
 };

render_imgs = function(img_list=imgs) {
    $('.img_src').remove();
    imgs_n = img_list.slice(0, max_imgs);
    imgs_n.forEach(img => {
        var [key, kws] = img;
        var img_cont = $('<div>', {class: 'img_cont img_src'});
        $('#img_results').append(img_cont);
        renderBox(img_cont, key);
    });
};

copy_key = function(keyspan) {
    var textArea = document.createElement("textarea");
    textArea.value = $(keyspan).text();
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("Copy");
    textArea.remove();
};

// interface

connectDrops(function(box, data) {
    var key = data.key;
    var div = $('<div>', {class: 'img_cont img_src', id: key});
    $('#dropzone').after(div);
    imgs.push([key, '']);
    renderBox(div, key);
});

$(document).on('click', '.img_src', function(e) {
    var img = $(this).children('img');
    var key = img.attr('id');
    var ks = $(e.target).closest('.keyspan');
    if (ks.length > 0) {
        $('.keyspan').removeClass('copied');
        copy_key(ks);
        $(ks).addClass('copied');
    } else {
        var src = img.attr('src');
        var kw = img.attr('kw') || '';
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
    var key = $('#display').attr('key');
    var kw = $('#display').attr('keywords');
    var new_key = $('input#key').val();
    var new_kw = $('input#keywords').val();
    if (key != new_key || kw != new_kw) {
        var data = {'key': key, 'new_key': new_key, 'new_kw': new_kw};
        client.sendCommand('update_image_key', data, (ret) => {
            if (ret.found) {
                var img = $(`#${key}`);
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

m_search = function(img, list) {
    var value = 0;
    target = img[0] + img[1];
    list.forEach(word => {
      value = value + target.includes(word);
    });
    return value;
};

timeout = null;

$(document).on('keyup', '#img_search', function(e) {
    clearTimeout(timeout);
    timeout = setTimeout(function() {
        var ss = $('#img_search').val();
        if (ss) {
            s_terms = ss.split(' ');
            imgs_s = imgs.filter(img => m_search(img, s_terms) > 0);
            render_imgs(imgs_s);
        } else {
            render_imgs();
        }
    }, 300);
});

// startup

$(document).ready(function() {
    var url = `http://${document.domain}:${location.port}`;
    client.connect(url, () => {
        client.sendCommand('join_room', {'room': '__img'}, (response) => {
            console.log(response);
        });
    });
    renderKatex();
    render_imgs();
});
