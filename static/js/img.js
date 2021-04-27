// image and search

img_types = ['image/png', 'image/jpeg', 'image/svg+xml']


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
    image_from_key(src, $('#'+id))
}

image_from_key = function(key, el){
    client.sendCommand('get_image', {'key': key}, (ret) => {
            if (ret.found) {
                const blob = new Blob([ret.data], {type: ret.mime});
                var url = URL.createObjectURL(blob);
                imgCache[key] = url;
                img = $('<img>', {id: key});
                img.attr('src', url);
                el.append(img);
            }
        });
}

$(document).ready(function() {
    $('.img_cont').each(function(){
        key = $(this).attr('src')
        image_from_key(key, $(this))
    });
 });

$(document).ready(function() {
    $(document).on('click', '.img_cont', function(e) {
        src = $(this).children('img').attr('src')
        $('#display_img').attr('src', src)
        console.log(src)
        $('#display').show();
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

// let timeout = null;

// $(document).on('keydown', function(e) {
//     var key = e.key.toLowerCase();
//     var real = String.fromCharCode(e.keyCode).match(/(\w|\s)/g);
//     var andriod_is_fucking_stupid = e.keyCode == 229;
//     var active = getActiveArt();
//     if (e.ctrlKey && (key == 'enter')) {
//         createArt();
//     } else if (key == 'enter') {
//         if (active.length > 0) {
//             var url = active.attr('href');
//             window.location = url;
//         }
//     } else if (real || (key == 'backspace') || (key == 'delete') || andriod_is_fucking_stupid) {
//         clearTimeout(timeout);
//         var last_url = active.attr('href');
//         timeout = setTimeout(function() {
//             var query = $('#new_art_id').val();
//             if (query.length > 2) {
//                 searchTitle(query, last_url);
//             } else {
//                 $('#results').empty();
//             }
//         }, 200);
//     } else if (key == 'arrowdown') {
//         var next = active.next('.art_result');
//         if (next.length > 0) {
//             $('.art_result').removeClass('selected');
//             next.addClass('selected');
//         }
//         return false;
//     } else if (key == 'arrowup') {
//         var prev = active.prev('.art_result');
//         if (prev.length > 0) {
//             $('.art_result').removeClass('selected');
//             prev.addClass('selected');
//         }
//         return false;
//     }
// });

// getActiveArt = function() {
//     return $('.art_result.selected').first();
// };

// searchTitle = function(query, last_url) {
//     client.sendCommand('search_title', query, function(response) {
//         $('#results').empty();

//         if (response) {
//             for (var title in response) {
//                 var art = response[title];
//                 var url = `a/${art.url}`;
//                 var artdiv = $('<a>', {class: 'art_result', href: url});
//                 if (art.blurb) {
//                     var b = $('<div>', {class: 'blurb', html: art.blurb});
//                     artdiv.append(b);
//                 }
//                 $('#results').append(artdiv);
//             }

//             var sel;
//             if (last_url == undefined) {
//                 sel = $('.art_result').first();
//             } else {
//                 sel = $(`.art_result[href="${last_url}"]`);
//                 if (sel.length == 0) {
//                     sel = $('.art_result').first();
//                 }
//             }
//             sel.addClass('selected');
//         }
//     });
// };

