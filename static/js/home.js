/* home page and search */

export { initHome }

import { state, updateState } from './state.js'
import { ensureVisible } from './utils.js'
import { connect, sendCommand } from './client.js'
import { renderKatex } from './math.js'

let default_state = {
    timeout: null,
}

function initHome(args) {
    updateState(default_state);
    connectHome();
    eventHome();
    renderKatex();
}

function connectHome() {
    let url = `http://${document.domain}:${location.port}`;
    connect(url, () => {
        sendCommand('join_room', {'room': '__home'}, (response) => {
            // console.log(response);
        });
    });
}

function eventHome() {
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

    $(document).on('keydown', function(e) {
        let key = e.key.toLowerCase();
        let real = String.fromCharCode(e.keyCode).match(/(\w|\s)/g);
        let andriod_is_fucking_stupid = e.keyCode == 229;

        let active = getActive();

        if (e.ctrlKey && (key == 'enter')) {
            createArt();
        } else if (e.ctrlKey && (key == '`')) {
            $('#full_text_check').click();
        } else if (key == 'enter') {
            if (active.length > 0) {
                let url = active.attr('href');
                window.location = url;
            }
        } else if (real || (key == 'backspace') || (key == 'delete') || andriod_is_fucking_stupid) {
            clearTimeout(state.timeout);
            state.timeout = setTimeout(runQuery, 200);
        } else if (key == 'arrowdown') {
            let next = active.next('.result');
            if (next.length > 0) {
                setActive(next);
            }
            return false;
        } else if (key == 'arrowup') {
            let prev = active.prev('.result');
            if (prev.length > 0) {
                setActive(prev);
            }
            return false;
        }
    });
}

function searchTitle(query, last_url) {
    sendCommand('search_title', query, function(response) {
        $('#results').empty();

        let nres = Object.keys(response).length;
        if (nres > 0) {
            for (let idx in response) {
                let art = response[idx];
                let url = `a/${art.url}`;
                let title = art.title;
                let btext = art.blurb || art.title;
                let art_div = $('<a>', {class: 'result art_link', href: url});
                let art_title = $('<div>', {class: 'blurb_name', text: title});
                let art_blurb = $('<div>', {class: 'blurb', html: btext});
                art_div.append([art_title, art_blurb]);
                $('#results').append(art_div);
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
}

function searchText(query, last_pid) {
    sendCommand('search_text', query, function(response) {
        $('#results').empty();
        let nres = Object.keys(response).length;
        if (nres > 0) {
            for (let idx in response) {
                let par = response[idx];
                let pid = par.pid;
                let title = par.title;
                let url = `a/${par.url}?pid=${pid}`;
                let raw = par.raw;
                query.split(' ').forEach(q => {
                    if (q.length > 0) {
                        let re = new RegExp(q, 'i');
                        raw = raw.replace(re, '<span class="hl">$&</span>');
                    }
                });
                let art_div = $('<a>', {class: 'result par_link', href: url, pid: pid});
                let art_blurb = $('<div>', {class: 'par_text', html: raw});
                let art_title = $('<div>', {class: 'blurb_name', text: title});
                art_div.append([art_title, art_blurb]);
                $('#results').append(art_div);
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
}

function runQuery() {
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
}

function createArt() {
    let query = $('#query').val();
    if (query.length > 0) {
        sendCommand('create_art', query, function(response) {
            window.location = response;
        });
    }
}

function getActive() {
    return $('.result.selected').first();
}

function setActive(res) {
    $('.result').removeClass('selected');
    res.addClass('selected');
    ensureVisible(res);
}
