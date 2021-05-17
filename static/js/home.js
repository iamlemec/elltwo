// home page and search

searchTitle = function(query, last_url) {
    client.sendCommand('search_title', query, function(response) {
        $('#results').empty();

        var nres = Object.keys(response).length;
        if (nres > 0) {
            for (var title in response) {
                var art = response[title];
                var url = `a/${art.url}`;
                var artdiv = $('<a>', {class: 'art_result', href: url});
                var btext = art.blurb || art.title;
                var blurb = $('<div>', {class: 'blurb', html: btext});
                artdiv.append(blurb);
                $('#results').append(artdiv);
            }

            var sel;
            if (last_url == undefined) {
                sel = $('.art_result').first();
            } else {
                sel = $(`.art_result[href="${last_url}"]`);
                if (sel.length == 0) {
                    sel = $('.art_result').first();
                }
            }
            sel.addClass('selected');
        }
    });
};

createArt = function() {
    query = $('#new_art_id').val();
    if (query.length > 0) {
        client.sendCommand('create_art', query, function(response) {
            window.location = response;
        });
    }
};

$(document).on('click', '#submit', function() {
    createArt();
});

let timeout = null;

$(document).on('keydown', function(e) {
    var key = e.key.toLowerCase();
    var real = String.fromCharCode(e.keyCode).match(/(\w|\s)/g);
    var andriod_is_fucking_stupid = e.keyCode == 229;
    var active = $('.art_result.selected').first();
    if (e.ctrlKey && (key == 'enter')) {
        createArt();
    } else if (key == 'enter') {
        if (active.length > 0) {
            var url = active.attr('href');
            window.location = url;
        }
    } else if (real || (key == 'backspace') || (key == 'delete') || andriod_is_fucking_stupid) {
        clearTimeout(timeout);
        var last_url = active.attr('href');
        timeout = setTimeout(function() {
            var query = $('#new_art_id').val();
            if (query.length > 0) {
                searchTitle(query, last_url);
            } else {
                $('#results').empty();
            }
        }, 200);
    } else if (key == 'arrowdown') {
        var next = active.next('.art_result');
        if (next.length > 0) {
            $('.art_result').removeClass('selected');
            next.addClass('selected');
            ensureVisible(next);
        }
        return false;
    } else if (key == 'arrowup') {
        var prev = active.prev('.art_result');
        if (prev.length > 0) {
            $('.art_result').removeClass('selected');
            prev.addClass('selected');
            ensureVisible(prev);
        }
        return false;
    }
});

$(document).ready(function() {
    var url = `http://${document.domain}:${location.port}`;
    client.connect(url, () => {
        client.sendCommand('join_room', {'room': '__home'}, (response) => {
            console.log(response);
        });
    });
    renderKatex();
});
