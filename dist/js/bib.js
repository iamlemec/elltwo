import { cache, state } from './state.js';
import { sendCommand, connect, addHandler } from './client.js';
import { getCiteData } from './bib_search.js';
import { renderKatex } from './math.js';
import { KeyCache, flash, createIcon, copyText } from './utils.js';
import { divInlineParser } from './marked3.js';
import { bibTextoJSON } from './bibtexParse.js';

/* bibtex library browswer */

function initBib() {
    cacheBib();
    connectBib();
    eventBib();
    renderKatex();
}

function cacheBib() {
    cache.cite = new KeyCache('cite', async function(key) {
        let ret = await sendCommand('get_cite', {key: key});
        return (ret !== undefined) ? ret : null;
    }, async function(keys) {
        let ret = await sendCommand('get_bib', {keys: keys});
        return Object.fromEntries(keys.map(k =>
            [k, (k in ret) ? ret[k] : null]
        ));
    });
    cache.list = new KeyCache('list', async function(key) {
        if (key == '__bib') {
            return await sendCommand('get_bibs', {});
        }
    });
}

function eventBib() {
    $(document).on('click', '#create', function() {
        let src = $('#bib_input').val();
        let json = generateJson(src);
        if (json.entryTags) {
            json.entryTags.raw = src;
            sendCommand('create_cite', json);
        } else {
            flash('invalid bibtex');
        }
    });

    $(document).on('click', '#search', function() {
        let q = $('#query').val();
        $('#search_results').find('.cite').remove();
        $('.nr').remove();
        $('#search_results').show();
        getCiteData(q);
        return false;
    });

    $(document).on('click', '#xsr', function() {
        $('#search_results').find('.cite').remove();
        $('.nr').remove();
        $('#search_results').hide();
    });

    $(document).on('dblclick', '.cite', function() {
        editCite(this);
        return false;
    });

    $(document).on('click', '.citekey', function(e) {
        copyCitekey(this);
        e.stopPropagation();
    });

    //close open windows
    $(document).click(function(e) {
        let targ = $(e.target);
        let clk_cr = (targ.closest('#create_wrap').length == 0);
        let clk_cn = (targ.closest('#create_new').length == 0);
        let clk_cite = (targ.closest('#search_results').length == 0);
        if (clk_cn && clk_cr && clk_cite) {
            $('#create_wrap').hide();
            $('#search_results').hide();
        }
    });

    $(document).on('click', '#search_results > .cite', function() {
        editCite(this, 'Create');
        return false;
    });

    $(document).on('click', '.update', function() {
        editCite(this);
        return false;
    });

    $(document).on('click', '.delete', function() {
        let key = $(this).closest('.cite').attr('id');
        sendCommand('delete_cite', {key: key});
    });

    $(document).on('click', '#create_new', function(e) {
        let cr = $('#create_wrap');
        let bi = cr.children('#bib_input');
        bi.val('');
        cr.show();
        bi.focus();
        bi[0].setSelectionRange(0, 0);
    });

    $(document).keydown(function(e) {
        let key = e.key.toLowerCase();
        e.ctrlKey;
        e.metaKey;
        let web_s = $('#query').is(":focus");
        let real = String.fromCharCode(e.keyCode).match(/(\w|\s)/g);
        let andriod_is_fucking_stupid = e.keyCode == 229;
        if(key == 'escape'){
            $('#create_wrap').hide();
            $('#search_results').hide();
        } else if(key == 'escape'){
            $('#create_wrap').hide();
            $('#search_results').hide();
        } else if (key=='enter' && web_s){
            $('#search').click();
        } else if ((real || (key == 'backspace') || (key == 'delete') || andriod_is_fucking_stupid)) {
            clearTimeout(state.timeout);
            state.timeout = setTimeout(runQuery, 200);
        }    });
}

function runQuery() {
    let query = $('#query').val();
    $('.cite').removeClass('dull');
    $('.hl').contents().unwrap();
    if (query.length > 2) {
        let bibs = $('.cite').toArray();
        let terms = query.toLowerCase().split(' ');
        let bib_sel = bibs.filter(bib => wordSearch(bib, terms) == 0);
        $(bib_sel).each(function(){
            $(this).addClass('dull');
        });
    } else {
        $('.cite').removeClass('dull');
    }}

function wordSearch(bib, list) {
    let value = 0;
    let text = $(bib).children('.cite_text');
    let target = text.text().toLowerCase();
    let raw = text.html();
    list.forEach(word => {
      value = value + target.includes(word);
      if (word.length > 2){
        let re = new RegExp(word, 'i');
        raw = raw.replace(re, '<span class="hl">$&</span>');
      }
    });
    text.html(raw);
    return value;
}

function connectBib() {
    let url = `//${document.domain}:${location.port}`;
    connect(url, () => {
        fetchBib([]);
    });

    addHandler('invalidateRef', function(data) {
        let [type, key] = data;
        if (type == 'list' && key == '__bib') {
            let old_bib = cache.list.see('__bib');
            cache.list.del('__bib');
            fetchBib(old_bib);
        } else if (type == 'cite') {
            cache.cite.del(key);
            fetchBib();
        }
    });
}

function generateJson(src) {
    let json = bibTextoJSON(src);
    if (!json[0]) {
        return 'Err: bibtex entry incorrectly specified';
    } else {
        if (!(json[0].entryTags.title)) {
            console.log('Err: Title Required');
            return false;
        } else if (!json[0].entryTags.author) {
            console.log('Err: Author Required');
            return false;
        } else if (!json[0].entryTags.year) {
            console.log('Err: Year Required');
            return false;
        } else {
            return json[0];
        }
    }
}

function clearQuery() {
    $('#query').val('');
}

/// editing

function renderBib(data) {
    let holder = $('#para_holder');
    $('#create_wrap').hide();
    holder.empty();
    Object.entries(data).forEach(([key, cite]) => {
        createBibEntry(key, cite, holder);
    });
    $('#bib_input').val('');
    sortCite('#para_holder');
    let create_new = $('<div>', {text: 'New BibTex Reference'});
    create_new.attr('id', 'create_new');
    $('#para_holder').prepend(create_new);
    renderKatex($('#para_holder'));
    if (data.length == 1) {
        location.href = '#' + data[0].citekey;
    }
}

async function fetchBib(old_bib) {
    let bib = await cache.list.get('__bib');
    if (old_bib !== undefined) {
        let net_add = bib.filter(x => !old_bib.includes(x));
        let net_del = old_bib.filter(x => !bib.includes(x));
        net_add.forEach(key => {
            sendCommand('track_ref', {key: `@@[${key}]`});
        });
        net_del.forEach(key => {
            sendCommand('untrack_ref', {key: `@@[${key}]`});
        });
    }
    let ret = await cache.cite.bulk(bib);
    renderBib(ret);
}

function createBibInfo(cite) {
    let yr = cite.year ? ` ${cite.year}. ` : '';
    let vol = cite.volume ? `, ${cite.volume}` : '';
    let num = cite.number ? `, no. ${cite.number}` : '';
    let pgs = cite.pages ? `, pp. ${cite.pages}` : '';
    let title = cite.title ? `${divInlineParser.output(cite.title)}` : '';
    let pubs = ['book', 'incollection'];
    let jns = ['article', 'techreport', 'unpublished'];
    let wild = [undefined];
    let link = cite.DOI || cite.link;
    link = link.match(/^\d/) ? `https://www.doi.org/${link}` : link;
    link = !link.match(/^ht/) ? `https://${link}` : link;
    let doi = cite.DOI || cite.link ? ` <a class=DOI_link target="_blank" href="${link}">${createIcon('ext_link')}</a>` : '';

    let pub;
    let journal;
    if (pubs.includes(cite.entry_type)) {
        pub = cite.publisher || '';
        journal = (cite.booktitle) ? `In ${cite.booktitle}`: '';
    } else if (jns.includes(cite.entry_type)) {
        pub = '';
        journal = cite.journal || 'mimeo';
    } else if (wild.includes(cite.entry_type)) {
        pub = pub = cite.publisher || '';
        journal = cite.journal || cite.booktitle || '';
    }

    let author = `<b>${divInlineParser.output(cite.author)}</b>. ` || '';
    let index = (vol || num || pgs) ? `${vol + num + pgs}.` : '';

    return {
        author: cite.author,
        year: cite.year,
        doi: cite.DOI,
        entry: `${author}${yr}${title}. <em>${journal}</em>${index} ${pub}${doi}`,
        raw: cite.raw,
    }
}

function createBibEntry(key, cite, target, results=false) {
    target.find(`#${key}`).remove();

    let info = createBibInfo(cite);
    let raw = cite.raw || '';

    let buts = `<div class="control">
                <div class="controlDots">&#9776;</div>
                <div class="controlButs">
                    <button class="update">Update</button>
                    <button class="delete">Delete</button>
                </div>`;

    if (results) {
        buts = "";
    }

    target.append(
        `<div class="cite" id="${key}" citeType=cite raw="${raw}">
            <span class='cite_text'>
            ${info.entry}
            </span>
            <span class="citekey" title="copy citekey">${key}</span>
            ${buts}
        </div>`
    );
}

// editing and nav

function copyCitekey(cite) {
    let ck = $(cite).text();
    copyText(ck);
    flash(`CiteKey "${ck}" copied to clipboard`);
}

function sortCite(id) {
    let divs = $(".cite");
    let alphabeticallyOrderedDivs = divs.sort(function(a, b) {
        return $(a).text() > $(b).text();
    });
    $(id).html(alphabeticallyOrderedDivs);
}

function editCite(el, text='Update') {
    let src = $(el).closest('.cite').attr('raw');
    console.log(src);
    $('#bib_input').val(src);
    $('#search_results').find('.cite').remove();
    $('.nr').remove();
    $('#search_results').hide();
    $('#create').text(text);
    $('#create_wrap').show();
    clearQuery();
}

export { createBibEntry, createBibInfo, initBib };
