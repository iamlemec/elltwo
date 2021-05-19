// home page and search

searchTitle = function(query, last_url) {
    client.sendCommand('search_title', query, function(response) {
        $('#results').empty();

        let nres = Object.keys(response).length;
        if (nres > 0) {
            for (let title in response) {
                let art = response[title];
                let url = `a/${art.url}`;
                let artdiv = $('<a>', {class: 'art_result', href: url});
                let btext = art.blurb || art.title;
                let blurb = $('<div>', {class: 'blurb', html: btext});
                artdiv.append(blurb);
                $('#results').append(artdiv);
            }

            let sel;
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

searchText = function(query, last_pid) {
    client.sendCommand('search_text', query, function(response) {
        $('#results').empty();

        let nres = Object.keys(response).length;
        if (nres > 0) {
            for (let pid in response) {
                let par = response[pid];
                let url = `a/${par.url}`;
                let raw = par.raw;
                let artdiv = $('<a>', {class: 'art_result', href: url, pid: pid});
                let blurb = $('<div>', {class: 'blurb', text: raw});
                artdiv.append(blurb);
                $('#results').append(artdiv);
            }

            let sel;
            if (last_pid == undefined) {
                sel = $('.art_result').first();
            } else {
                sel = $(`.art_result[pid="${last_pid}"]`);
                if (sel.length == 0) {
                    sel = $('.art_result').first();
                }
            }
            sel.addClass('selected');
        }
    });
};

runQuery = function() {
    let active = $('.art_result.selected').first();
    let last_url = active.attr('href');
    let last_pid = active.attr('pid');

    let query = $('#query').val();
    if (query.length > 0) {
        let full_text = $('#full_text_check').is(':checked');
        if (full_text) {
            searchText(query, last_url);
        } else {
            searchTitle(query, last_pid);
        }
    } else {
        $('#results').empty();
    }
};

createArt = function() {
    query = $('#query').val();
    if (query.length > 0) {
        client.sendCommand('create_art', query, function(response) {
            window.location = response;
        });
    }
};

$(document).on('change', '#full_text_check', function() {
    runQuery();
});

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
        timeout = setTimeout(runQuery, 200);
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
