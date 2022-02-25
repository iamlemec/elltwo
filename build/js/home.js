/* home page and search */

export { initHome }

import { state, updateState } from './state.js'
import { ensureVisible } from './utils.js'
import { connect, sendCommand } from './client.js'
import { renderKatex } from './math.js'
import { initUser } from './user.js'

let default_state = {
    timeout: null,
}

function initHome(args) {
    updateState(default_state);
    connectHome();
    eventHome();
    renderKatex();
    initUser();
    searchRecent();
}

function connectHome() {
    let url = `//${document.domain}:${location.port}`;
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

let elltwo = `<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><msup><mi mathvariant="normal">ℓ</mi><mn>2</mn></msup></mrow><annotation encoding="application/x-tex">\ell^2</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height: 0.814108em; vertical-align: 0em;"></span><span class="mord"><span class="mord">ℓ</span><span class="msupsub"><span class="vlist-t"><span class="vlist-r"><span class="vlist" style="height: 0.814108em;"><span class="" style="top: -3.063em; margin-right: 0.05em;"><span class="pstrut" style="height: 2.7em;"></span><span class="sizing reset-size6 size3 mtight"><span class="mord mtight">2</span></span></span></span></span></span></span></span></span></span></span>`;
let blurb_img = `<div><div class="title">${elltwo} Image Library</div>Upload new images, or search and edit uploaded images.</div>`;
let blurb_bib = `<div><div class="title">${elltwo} Bibliography</div>Enter new bibliographic citations manually or via a web search; search and edit existing citations.</div>`;

function searchTitle(query, last_url) {
    sendCommand('search_title', query, function(response) {
       let title_text = "Search Results (Title)"
       let  q = query.toLowerCase();
        if ('image library'.startsWith(q) || 'img'.startsWith(q) || 'elltwo'.startsWith(q)) {
            response.push({
                short: 'img',
                blurb: blurb_img,
            });
        };
        if ('bibliography'.startsWith(q) || 'elltwo'.startsWith(q)) {
            response.push({
                short: 'bib',
                blurb: blurb_bib,
            });
        };
       buildBlurbs(response, last_url, title_text);
    });
}

function searchRecent(last_url) {
    sendCommand('recent_arts', null,  function(response, last_url) {
       if(response.length > 0){
            let title_text = "Recently Edited Articles"
            buildBlurbs(response, last_url, title_text);
        };
    });
}

function searchText(query, last_pid) {
    sendCommand('search_text', query, function(response) {
        $('#results').empty();
        let res_title = $('<div>', {class: 'res_title', text: 'Search Results (Full Text)'});
        $('#results').append(res_title);
        let nres = Object.keys(response).length;
        if (nres > 0) {
            for (let idx in response) {
                let par = response[idx];
                let pid = par.pid;
                let short = par.short;
                let url = `a/${short}?pid=${pid}`;
                let raw = par.raw;
                query.split(' ').forEach(q => {
                    if (q.length > 0) {
                        let re = new RegExp(q, 'i');
                        raw = raw.replace(re, '<span class="hl">$&</span>');
                    }
                });
                let art_div = $('<a>', {class: 'result par_link', href: url, pid: pid});
                let art_blurb = $('<div>', {class: 'par_text', html: raw});
                let art_title = $('<div>', {class: 'blurb_name', text: short});
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

function buildBlurbs(response, last_url, title_text){
     $('#results').empty();
        let res_title = $('<div>', {class: 'res_title', text: title_text});
        $('#results').append(res_title);

        let nres = Object.keys(response).length;
        if (nres > 0) {
            for (let idx in response) {
                let art = response[idx];
                let url = art.short;
                let short = url;
                if (short != 'img' && short != 'bib') {
                    short = url.slice(2).replace('_', ' ');
                }
                let btext = art.blurb || short;
                let art_div = $('<a>', {class: 'result art_link', href: url});
                let art_title = $('<div>', {class: 'blurb_name', text: short});
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
};

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
        searchRecent(last_url);
        //$('#results').empty();
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
