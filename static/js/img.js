// image and search

img_types = ['image/png', 'image/jpeg', 'image/svg+xml']
max_imgs = 50;


$(document).ready(function() {
    var url = `http://${document.domain}:${location.port}`;
    client.connect(url);
    client.sendCommand('room', {'room': '__img'}, function(response) {
        console.log(response);
    });
    renderKatex();
 });

imgCache = {};

uploadImg = function(file, name=null) {
    console.log('uploadImg:', file.name, file.type, file.size);
    if (!img_types.includes(file.type)) {
        return `Unsupported file type: ${file.type}`;
    }
    if (file.size > 1024*max_size) {
        var ksize = Math.floor(file.size/1024);
        return `File size too large (${ksize}kb > 1024kb)`;
    }
    let f_name = name || file.name;
    let form_data = new FormData();
    form_data.append('file', file);
    form_data.append('f_name', f_name);
    $.ajax({
        type: 'POST',
        url: '/uploadImg',
        data: form_data,
        contentType: false,
        cache: false,
        processData: false,
        success: function(data) {
            update_img(data.id);
        },
    });
    return null;
};

update_img = function(src){
    id = src.split('.')[0]
    $('#dropzone').after($('<div>', {class: 'img_cont img_src', id: id, src: src}));
    imgs.append([id, ""])
    image_from_key(src, $('#'+id))
}

image_from_key = function(key, el){
    if (key in imgCache) {
        let url = imgCache[key]['url'];
        const img = $('<img>', {id: key});
        img.attr('src', url);
        img.attr('kw', imgCache[key]['kw']);
        el.append(img);
        const keyspan = $('<div>', {class: 'keyspan'});
        keyspan.text(key);
        el.append(keyspan);
    }else{
        client.sendCommand('get_image', {'key': key}, (ret) => {
        if (ret.found) {
            const blob = new Blob([ret.data], {type: ret.mime});
            const url = URL.createObjectURL(blob);
            imgCache[key] = {'url': url, 'kw': ret.kw};
            const img = $('<img>', {id: key});
            img.attr('src', url);
            img.attr('kw', ret.kw);
            el.append(img);
            const keyspan = $('<div>', {class: 'keyspan'});
            keyspan.text(key);
            el.append(keyspan);
            }
        });
    }
};

$(document).ready(function() {
    render_imgs();
 });

render_imgs = function(img_list=imgs){
    $('.img_src').remove();
    imgs_n = img_list.slice(0, max_imgs);
    imgs_n.forEach(img => {
        img_cont = $('<div>', {class: 'img_cont img_src'});
        img_cont.attr('src', img[0])
        $('#img_results').append(img_cont)
    });
    $('.img_src').each(function(){
        key = $(this).attr('src')
        image_from_key(key, $(this))
    });
}

copy_key = function(keyspan) {
    var textArea = document.createElement("textarea");
    textArea.value = $(keyspan).text();
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("Copy");
    textArea.remove();
}

$(document).ready(function() {
    $(document).on('click', '.img_cont', function(e) {
        let img = $(this).children('img');
        let key = img.attr('id');
        ks = $(e.target).closest('.keyspan')
        if (ks.length > 0){
            $('.keyspan').removeClass('.copied')
            copy_key(ks);
            $(ks).addClass('copied')
        } else {
        let src = img.attr('src');
        let kw = img.attr('kw') || "";
        $('#display').attr('key', key)
               .attr('keywords', kw)
        $('#display_img').attr('src', src);
        $('input#key').val(key);
        $('input#keywords').val(kw);
        $('#display').show();
    };
    });
});

$(document).ready(function() {
    $(document).on('click', '#img_update', function() {
        let key = $('#display').attr('key');
        let kw = $('#display').attr('keywords');
        let new_key = $('input#key').val();
        let new_kw = $('input#keywords').val();
        if (key!=new_key || kw!=new_kw){
            client.sendCommand('update_img_key', 
                {'key': key,
                'new_key': new_key,
                'new_kw': new_kw,
                },(ret) => {
                if(ret.found){
                    const img = $(`#${key}`);
                    img.attr('id', new_key);
                    img.attr('kw', new_kw);
                    img.parent('.img_cont').attr('src', new_key);
                    img.siblings('.keyspan').text(new_key);
                $('#display').hide();
                };
            });
        };
    });
});

$(document).ready(function() {
    $(document).on('click', '#bg', function(e) {
        if ($(e.target).closest('.img_cont').length == 0 && $(e.target).closest('#display').length == 0){
            $('#display').hide();
        }
    });
});

$(document).ready(function() {
    $(document).on('dragover', '.dropzone', function(e) {
        $(this).addClass('dragover');
        return false;
    });

    $(document).on('dragleave', '.dropzone', function(e) {
        $(this).removeClass('dragover');
        return false;
    });

    $(document).on('drop', '.dropzone', function(e) {
        var files = e.originalEvent.dataTransfer.files;
        if (files.length == 1) {
            let file = files[0];
            let para = $(this).closest('.para');
            if ((ret = uploadImg(file)) == null) {
                $(this).removeClass('dragover');
            } else {
                $(this).text(ret);
            }
        } else if (files.length > 1) {
            $(this).text('Please upload a single image file');
        }
        return false;
    });

    $(document).on('click', '.dropzone', function(e) {
        var drop = $(this);
        var input = $('<input>', {type: 'file', style: 'display: none'});
        var box = this;
        input.on('change', function() {
            var files = this.files;
            if (files.length > 0) {
                var file = files[0];
                var para = $(box).closest('.para');
                if ((ret = uploadImg(file, para)) == null) {
                    drop.removeClass('dragover');
                } else {
                    drop.text(ret);
                }
            }
            input.remove();
        });
        $('body').append(input);
        input.trigger('click');
        return false;
    });
});

function m_search(img, list){
    let value = 0;
    target = img[0] + img[1];
    list.forEach(word => {
      value = value + target.includes(word);
    });
    return value
}

timeout = null;

$(document).on('keyup', '#img_search', function(e) {
    clearTimeout(timeout);
    timeout = setTimeout(function() {
    ss = $('#img_search').val()
    if(ss){
        s_terms = ss.split(' ')
        imgs_s = imgs.filter(img => m_search(img, s_terms) > 0)
        render_imgs(imgs_s);
    } else{
        render_imgs();
    };
    }, 300);
});

