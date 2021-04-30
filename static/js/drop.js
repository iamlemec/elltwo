// drop to upload — used in article and img

img_types = ['image/png', 'image/jpeg', 'image/svg+xml'];

uploadImg = function(file, key, callback) {
    console.log('uploadImg:', file.name, file.type, file.size);
    if (!img_types.includes(file.type)) {
        return `Unsupported file type: ${file.type}`;
    }
    if (file.size > 1024*max_size) {
        var ksize = Math.floor(file.size/1024);
        return `File size too large (${ksize}kb > 1024kb)`;
    }
    var fbase = file.name.split('.')[0];
    var key = name || fbase;
    var form_data = new FormData();
    form_data.append('file', file);
    form_data.append('key', key);
    $.ajax({
        type: 'POST',
        url: '/uploadImg',
        data: form_data,
        contentType: false,
        cache: false,
        processData: false,
        success: callback,
    });
    return null;
};

handleDrop = function(box, files, key, callback) {
    if (files.length == 1) {
        var file = files[0];
        var ret = uploadImg(file, key, function(data) {
            callback(box, data);
        });
        if (ret == null) {
            box.removeClass('dragover');
        } else {
            box.text(ret);
        }
    } else if (files.length > 1) {
        box.text('Please upload a single image file');
    }
};

connectDrops = function(callback) {
    $(document).on('dragover', '.dropzone', function(e) {
        $(this).addClass('dragover');
        return false;
    });

    $(document).on('dragleave', '.dropzone', function(e) {
        $(this).removeClass('dragover');
        return false;
    });

    $(document).on('drop', '.dropzone', function(e) {
        var box = $(this);
        var key = box.attr('key');
        var files = e.originalEvent.dataTransfer.files;
        handleDrop(box, files, key, callback);
        return false;
    });

    $(document).on('click', '.dropzone', function(e) {
        var box = $(this);
        var input = $('<input>', {type: 'file', style: 'display: none'});
        input.on('change', function() {
            var files = this.files;
            handleDrop(box, files, null, callback);
            input.remove();
        });
        $('body').append(input);
        input.trigger('click');
        return false;
    });
};

// image retrieval

imgCache = {};

renderImage = function(img, key) {
    if (key in imgCache) {
        var url = imgCache[key];
        img.attr('src', url);
    } else {
        client.sendCommand('get_image', {'key': key}, (ret) => {
            if (ret.found) {
                const blob = new Blob([ret.data], {type: ret.mime});
                var url = URL.createObjectURL(blob);
                imgCache[key] = url;
                img.attr('src', url);
            }
        });
    }
};
