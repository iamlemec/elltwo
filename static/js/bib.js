/* bibtex library browswer */

export { initBib, createBibInfo, createBibEntry}

import { config, state, cache, updateConfig, updateState, updateCache } from './state.js'
import { connect, addHandler, sendCommand } from './client.js'
import { getCiteData } from './bib_search.js'
import { renderKatex } from './math.js'
import { KeyCache, flash } from './utils.js'

function initBib() {
    cacheBib();
    connectBib();
    eventBib();
    renderKatex();
}

function cacheBib() {
    cache.cite = new KeyCache('cite', function(key, callback) {
        sendCommand('get_cite', {key: key}, function(ret) {
            let cite = (ret !== undefined) ? ret : null;
            callback(cite);
        });
    }, function(keys, callback) {
        sendCommand('get_bib', {keys: keys}, function(ret) {
            let cites = Object.fromEntries(keys.map(k =>
                [k, (k in ret) ? ret[k] : null]
            ));
            callback(cites);
        });
    });
    cache.list = new KeyCache('list', function(key, callback) {
        if (key == '__bib') {
            sendCommand('get_bibs', {}, callback);
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
            flash('invalid bibtex')
        }
    });

    $(document).on('change', '#local_search_check', function() {
        let web = $(this).is(':checked');
        let ph = web ? 'Search the web for references' : 'Search existing references'
        if(web){
            $('#search').show();
            $('#query').addClass('search');
            $('#local_search').addClass('search');
        } else {
            $('#search').hide();
            $('#query').removeClass('search');
            $('#local_search').removeClass('search');
        }
        $('#query').attr('placeholder', ph)
    });

    $(document).on('click', '#search', function() {
        let q = $('#query').val();
        $('#search_results').find('.cite').remove();
        $('.nr').remove();
        $('#search_results').show();
        getCiteData(q);
    });

    $(document).on('click', '#xsr', function() {
        $('#search_results').find('.cite').remove();
        $('.nr').remove()
        $('#search_results').hide();
    });

    $(document).on('dblclick', '.cite', function() {
        //$('.editable').removeClass('editable');
       //$(this).addClass('editable');
        editCite(this);
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
        let clk_cite = (targ.closest('.cite').length == 0);
        if (clk_cn && clk_cr && clk_cite) {
            $('#create_wrap').hide();
            console.log(targ)
        } else if (clk_cite) {
            $('#search_results').hide();
        }
    });

    $(document).on('click', '#search_results > .cite', function() {
        editCite(this, 'Create');
    });

    $(document).on('click', '.delete', function() {
        let key = $(this).closest('.cite').attr('id');
        sendCommand('delete_cite', {key: key});
        $('.editable').removeClass('editable');
    });

    $(document).on('click', '#create_new', function(e) {
        let cr = $('#create_wrap')
        let bi = cr.children('#bib_input')
        bi.val(''); 
        cr.show()
        bi.focus();
        bi[0].setSelectionRange(0, 0);
    });

    $(document).keydown(function(e) {
        let key = e.key.toLowerCase();
        let ctrl = e.ctrlKey;
        let meta = e.metaKey;
        if(!meta && !ctrl && key == '=') {
            $('#local_search_check').click();
            return false
        } else if(key == 'escape'){
            $('#create_wrap').hide()
            $('#search_results').hide()
        }
    });
}

function connectBib() {
    let url = `http://${document.domain}:${location.port}`;
    connect(url, () => { fetchBib([]); });

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
    let json = bibtexParse.toJSON(src);
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

/// editing

function renderBib(data) {
    let holder = $('#para_holder');
    $('#create_wrap').hide()
    holder.empty();
    Object.entries(data).forEach(([key, cite]) => {
        createBibEntry(key, cite, holder);
    });
    $('#bib_input').val('');
    sortCite('#para_holder');
    let create_new = $('<div>', {text: 'New BibTex Reference'});
    create_new.attr('id', 'create_new')
    $('#para_holder').prepend(create_new)
    if (data.length == 1) {
        location.href = '#' + data[0].citekey;
    }
}

function fetchBib(old_bib) {
    cache.list.get('__bib', function(bib) {
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
        cache.cite.bulk(bib, renderBib);
    });
}

function deleteCite(key) {
    $(`#${key}`).remove();
}

function createBibInfo(cite) {
    let yr = cite.year ? ` ${cite.year}. ` : '';
    let vol = cite.volume ? `, ${cite.volume}` : '';
    let num = cite.number ? `, no. ${cite.number}` : '';
    let pgs = cite.pages ? `, pp. ${cite.pages}` : '';
    let title = cite.title ? `${cite.title}` : '';
    let pubs = ['book', 'incollection'];
    let jns = ['article', 'techreport', 'unpublished'];
    let wild = [undefined];
    let doi = cite.DOI ? `<a target="_blank" href="https://www.doi.org/${cite.DOI}">[Go]</a>` : '';

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

    let author = `<b>${cite.author}</b>. ` || '';
    let index = (vol || num || pgs) ? `${vol + num + pgs}.` : '';

    return {
        author: cite.author,
        year: cite.year,
        doi: cite.DOI,
        entry: `${author}${yr}${title}. <em>${journal}</em>${index} ${pub}`,
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
            ${info.entry}
            <span class="citekey" title="copy citekey">${key}</span>
            ${buts}
        </div>`
    );
}

// editing and nav

function copyCitekey(cite) {
    let textArea = document.createElement("textarea");
    let ck = $(cite).text();
    textArea.value = ck
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("Copy");
    textArea.remove();
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
    console.log(src)
    $('#bib_input').val(src);
    $('#search_results').find('.cite').remove();
    $('.nr').remove()
    $('#search_results').hide();
    $('#create').text(text);
    $('#create_wrap').show()
}
