// home page and search

searchTitle = function(query, last_url) {
    client.sendCommand('search_title', query, function(response) {
        $('#results').empty();

        let nres = Object.keys(response).length;
        if (nres > 0) {
            for (let title in response) {
                let art = response[title];
                let url = `a/${art.url}`;
                let artdiv = $('<a>', {class: 'result art_link', href: url});
                let btext = art.blurb || art.title;
                let blurb = $('<div>', {class: 'blurb', html: btext});
                artdiv.append(blurb);
                $('#results').append(artdiv);
            }

            let sel;
            if (last_url == undefined) {
                sel = $('.art_link').first();
            } else {
                sel = $(`.art_link[href="${last_url}"]`);
                if (sel.length == 0) {
                    sel = $('.art_link').first();
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
                let tit = par.url;
                let url = `a/${tit}?pid=${pid}`;
                let raw = par.raw;
                let artdiv = $('<a>', {class: 'result par_link', href: url, pid: pid});
                let title = $('<div>', {class: 'par_title', text: tit});
                let blurb = $('<div>', {class: 'par_text', text: raw});
                artdiv.append([title, blurb]);
                $('#results').append(artdiv);
            }

            let sel;
            if (last_pid == undefined) {
                sel = $('.par_link').first();
            } else {
                sel = $(`.par_link[pid="${last_pid}"]`);
                if (sel.length == 0) {
                    sel = $('.par_link').first();
                }
            }
            sel.addClass('selected');
        }
    });
};

runQuery = function() {
    let active = $('.result.selected').first();
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

getActive = function() {
    return $('.result.selected').first();
};

setActive = function(res) {
    $('.result').removeClass('selected');
    res.addClass('selected');
    ensureVisible(res);
};

$(document).on('change', '#full_text_check', function() {
    $('#query').focus();
    runQuery();
});

$(document).on('click', '#full_text_label', function() {
    $('#full_text_check').click();
});

$(document).on('click', '#submit', function() {
    createArt();
});

let timeout = null;

$(document).on('keydown', function(e) {
    var key = e.key.toLowerCase();
    var real = String.fromCharCode(e.keyCode).match(/(\w|\s)/g);
    var andriod_is_fucking_stupid = e.keyCode == 229;

    var active = getActive();

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
        var next = active.next('.result');
        if (next.length > 0) {
            setActive(next);
        }
        return false;
    } else if (key == 'arrowup') {
        var prev = active.prev('.result');
        if (prev.length > 0) {
            setActive(prev);
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
