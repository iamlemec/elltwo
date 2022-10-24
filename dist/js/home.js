import { state, updateState } from './state.js';
import { ensureVisible } from './utils.js';
import { connect, sendCommand } from './client.js';
import { renderKatex } from './math.js';
import { initUser } from './user.js';
import { ccNext, ccSearch } from './article.js';

/* home page and search */

let default_state = {
    timeout: null,
};

function initHome(args) {
    state.tags = args.tags;
    updateState(default_state);
    connectHome();
    eventHome();
    renderKatex();
    initUser();
    searchRecent();
}

function connectHome() {
    let url = `//${document.domain}:${location.port}`;
    connect(url, async function() {
        sendCommand('join_room', {'room': '__home'});
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

    $(document).on('input', '#query', function(e) {
        dispTags();
        let cur = e.currentTarget.selectionStart;
        let raw = $(this).val();
        ccTags(raw, cur);
    });

    $(document).on('keydown', function(e) {
        let key = e.key.toLowerCase();
        let real = key.match(/^[\w\s\]\[\(\)\!\@\$\%\^\&\*\\\?\.\,\`]$/);
        let andriod_is_fucking_stupid = e.keyCode == 229;

        let active = getActive();

        if (e.ctrlKey && (key == 'enter')) {
            createArt();
        } else if (e.ctrlKey && (key == '`')) {
            $('#full_text_check').click();
        } else if (key == 'enter') {
            if (state.cc) { 
                    tagComplete();
                    return false;
            }            if (active.length > 0) {
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
        } else if (key == 'arrowleft') {
                if (state.cc) { // if there is an open command completion window
                    ccNext('down');
                    return false;
                }        } else if (key == 'arrowright') {
                if (state.cc) {
                    ccNext('up');
                    return false;
                }        } else if (key == 'escape') {
                if (state.cc) {
                    state.cc = false;
                    $('#cc_pop').remove();
                }
                return false;
            }    });
}

let elltwo = `<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><msup><mi mathvariant="normal">ℓ</mi><mn>2</mn></msup></mrow><annotation encoding="application/x-tex">\ell^2</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height: 0.814108em; vertical-align: 0em;"></span><span class="mord"><span class="mord">ℓ</span><span class="msupsub"><span class="vlist-t"><span class="vlist-r"><span class="vlist" style="height: 0.814108em;"><span class="" style="top: -3.063em; margin-right: 0.05em;"><span class="pstrut" style="height: 2.7em;"></span><span class="sizing reset-size6 size3 mtight"><span class="mord mtight">2</span></span></span></span></span></span></span></span></span></span></span>`;
let blurb_img = `<div><div class="title">${elltwo} Image Library</div>Upload new images, or search and edit uploaded images.</div>`;
let blurb_bib = `<div><div class="title">${elltwo} Bibliography</div>Enter new bibliographic citations manually or via a web search; search and edit existing citations.</div>`;

async function searchTitle(query, last_url, tags="") {
    let data = {query, tags};
    let ret = await sendCommand('search_title', data);
    let title_text = `Search Results, Title: ${query}`;
    let q = query.toLowerCase();
    if ('image library'.startsWith(q) || 'img'.startsWith(q) || 'elltwo'.startsWith(q)) {
        ret.push({
            short: 'img',
            blurb: blurb_img,
        });
    }
    if ('bibliography'.startsWith(q) || 'elltwo'.startsWith(q)) {
        ret.push({
            short: 'bib',
            blurb: blurb_bib,
        });
    }
    buildBlurbs(ret, last_url, title_text);
}

async function searchRecent(last_url) {
    let ret = await sendCommand('recent_arts', null);
    if (ret.length > 0) {
        let title_text = 'Recently Edited Articles';
        buildBlurbs(ret, last_url, title_text);
    }
}

async function searchText(query, last_pid) {
    let ret = await sendCommand('search_text', query);

    $('#results').empty();
    let res_title = $('<div>', {class: 'res_title', text: 'Search Results (Full Text)'});
    $('#results').append(res_title);

    if (Object.keys(ret).length == 0) return;
    for (let idx in ret) {
        let par = ret[idx];
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

function buildBlurbs(response, last_url, title_text, target=null){
     
     if(!target){

     $('#results').empty();
        let res_title = $('<div>', {class: 'res_title', text: title_text});
        $('#results').append(res_title);
        target = $('#results');
    }

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
                let art_div = $('<a>', {class: 'result art_link', href: window.location.origin + '/' + url});
                let art_title = $('<div>', {class: 'blurb_name', text: short});
                if(art.tags){
                    art.tags.forEach(t => {
                        let tag = $('<span>', {class: 'blurb_tag', text: t});
                        art_title.append(tag);
                    });
                }
                let art_blurb = $('<div>', {class: 'blurb', html: btext});
                art_div.append([art_title, art_blurb]);
                target.append(art_div);
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
}
function runQuery() {
    let active = $('.result.selected').first();
    let last_url = active.attr('href');
    let last_pid = active.attr('pid');

    let query = $('#query').val();
    let tags = getTags();
    if (query.length > 0) {
        let full_text = $('#full_text_check').is(':checked');
        if (full_text) {
            searchText(query, last_url);
        } else {
            searchTitle(query, last_pid, tags);
        }
    } else {
        searchRecent(last_url);
        //$('#results').empty();
    }
}

async function createArt() {
    let query = $('#query').val();
    if (query.length > 0) {
        let ret = await sendCommand('create_art', query);
        window.location = ret;
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

async function ccTags(raw, cur) {
    state.cc = false;
    $('#cc_pop').remove();

    let before = raw.substring(0,cur);
    let hash = before.lastIndexOf('#');
    if(hash < 0){ //no hash
        return false;
    }
    before = before.substring(hash);
    if (before.lastIndexOf(']') > 0){ //no open hash
        return false;
    }
    if (before.charAt(1) == '[' || before.lastIndexOf(' ') < 0){ //open hash brack or no space
        before = before.replace('#', "").replace('[', "");
    } else {
        return false
    }

    let selchars = [cur - before.length, cur];

    //only display new suggestions
    let alltags = state.tags;
    let curtags = getTags();

    alltags = alltags.filter(t => !curtags.includes(t));

    ccSearch(alltags, before, false, selchars, false, $('#tags'));

    }

function dispTags(){
    $('#tagdisp').remove();
    let tagdisp = $('<div>', {id: 'tagdisp'});
    let tags = getTags();
    if(tags){
        tags.forEach(t => {
            let tag_row = $('<div>', {class: 'tag_row'});
            tag_row.text(t);
            tagdisp.append(tag_row);
        });
    $('#tags').prepend(tagdisp);
    }
}

function getTags(){
    let raw = $('#query').val();
    let tagexp = /#(\[[\w| ]+\]|\w+)/g;
    let tags = [...raw.matchAll(tagexp)];
    return tags.map(t => t[1].replace(']',"")
        .replace('[',"")
        .replace('#',""))
    .filter((v, i, a) => a.indexOf(v) === i);//unique els
}

function tagComplete(){
    let q = $('#query');
    let cctxt = $('.cc_row').first().attr('ref');
    if (cctxt.lastIndexOf(' ') > 0){ //space
        cctxt = `[${cctxt}]`;
    }
    let raw = q.val();
    let [l,u] = state.cc;
    raw = raw.substring(0, l) + cctxt + raw.substring(u);
    l = l + cctxt.length;
    q.val(raw).trigger('input');
    q[0].setSelectionRange(l, l);
    runQuery();
    }

export { buildBlurbs, initHome };
