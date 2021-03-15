// home page and search

$(document).ready(function() {
    var url = `http://${document.domain}:${location.port}`;
    client.connect(url);
    client.sendCommand('room', {'room': '__home'}, function(response) {
        console.log(response);
        });
    renderKatex();
});

$(document).on('click', '#submit', function() {
    createArt();
});

let timeout = null;

$(document).on('keydown', function(e) {
    var key = e.key.toLowerCase();
    var real = String.fromCharCode(e.keyCode).match(/(\w|\s)/g);
    var andriod_is_fucking_stupid = e.keyCode == 229;
    var active = getActiveArt();
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
            if (query.length > 2) {
                searchTitle(query, last_url);
            } else {
                $('#results').empty();
            };
        }, 200);
    } else if (key == 'arrowdown') {
        var next = active.next('.art_result');
        if (next.length > 0) {
            $('.art_result').removeClass('selected');
            next.addClass('selected');
        }
        return false;
    } else if (key == 'arrowup') {
        var prev = active.prev('.art_result');
        if (prev.length > 0) {
            $('.art_result').removeClass('selected');
            prev.addClass('selected');
        }
        return false;
    }
});

getActiveArt = function() {
    return $('.art_result.selected').first();
};

searchTitle = function(query, last_url) {
    client.sendCommand('search_title', query, function(response) {
        $('#results').empty();

        if (response) {
            for (var title in response) {
                var art = response[title];
                var url = `a/${art.url}`;
                var artdiv = $('<a>', {class: 'art_result', href: url, html: title});
                if (art.blurb) {
                    var b = $('<div>', {class: 'blurb', html: art.blurb});
                    artdiv.append(b);
                }
                $('#results').append(artdiv);
            };

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
        };
    });
};

createArt = function() {
    query = $('#new_art_id').val();
    if (query.length > 0) {
        client.sendCommand('create_art', query, function(response) {
            window.location = response;
        });
    };
};

renderKatex = function() {
    $('body').find('span.latex').each(function() {
        var tex = $(this);
        var src = tex.text();
        tex.empty();
        try {
          katex.render(src, tex[0],
            //{macros: config["macros"]}
            );
        } catch (e) {
          console.log($(this).text());
          console.log(src);
          console.log(e);
        }
    });
};



