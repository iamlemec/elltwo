import { config, state } from './state.js';

// drop to upload — used in article and img

/// handle images

let img_types = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/gif'];

function uploadImage(file, key, callback) {
    console.log('uploadImage:', file.name, file.type, file.size);
    if (!img_types.includes(file.type)) {
        return `Unsupported file type: ${file.type}`;
    }
    if (file.size > 1024*config.max_size) {
        let ksize = Math.floor(file.size/1024);
        return `File size too large (${ksize}kb > 1024kb)`;
    }
    let fbase = file.name.split('.')[0];
    key = key || fbase;
    let form_data = new FormData();
    form_data.append('file', file);
    form_data.append('key', key);
    $.ajax({
        type: 'POST',
        url: '/uploadImage',
        data: form_data,
        contentType: false,
        cache: false,
        processData: false,
        success: callback,
    });
    return null;
}

function handleDrop(box, files, key, callback) {
    if (files.length == 1) {
        let file = files[0];
        let ret = uploadImage(file, key, function(data) {
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
}

function promptUpload(callback) {
    let input = $('<input>', {type: 'file', style: 'display: none'});
    input.on('change', function() {
        let files = this.files;
        callback(files);
        input.remove();
    });
    $('body').append(input);
    input.trigger('click');
}

function checkLocked(box) {
    let para = box.closest('.para');
    if (para.length == 0) {
        return false; // in img lib
    }
    return !state.edit_mode || para.hasClass('locked');
}

function connectDrops(callback) {
    $(document).on('dragover', '.dropzone', function(e) {
        $(this).addClass('dragover');
        return false;
    });

    $(document).on('dragleave', '.dropzone', function(e) {
        $(this).removeClass('dragover');
        return false;
    });

    $(document).on('drop', '.dropzone', function(e) {
        let box = $(this);
        let key = box.attr('key');
        let files = e.originalEvent.dataTransfer.files;
        if (checkLocked(box)) {
            return false;
        }
        handleDrop(box, files, key, callback);
        return false;
    });

    $(document).on('click', '.dropzone', function(e) {
        let box = $(this);
        let key = box.attr('key');
        if (checkLocked(box)) {
            return false;
        }
        promptUpload(function(files) {
            handleDrop(box, files, key, callback);
        });
        return false;
    });
}

export { connectDrops, promptUpload, uploadImage };
