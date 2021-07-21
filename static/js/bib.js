/* bibtex library browswer */

export { initBib, createBibInfo, createBibEntry}

import { config, state, cache, updateConfig, updateState, updateCache } from './state.js'
import { connect, addHandler, sendCommand } from './client.js'
import { getCiteData } from './bib_search.js'
import { renderKatex } from './math.js'
import { KeyCache } from './utils.js'

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
        if (json) {
            json.entryTags.raw = src;
            sendCommand('create_cite', json);
        }
    });

    $(document).on('click', '#search', function() {
        let q = $('#bib_input').val();
        $('#search_results').find('.cite').remove();
        $('.nr').remove();""
        $('#search_results').show();
        getCiteData(q);
    });

    $(document).on('click', '#xsr', function() {
        $('#search_results').find('.cite').remove();
        $('.nr').remove()
        $('#search_results').hide();
    });

    $(document).on('click', '.cite', function() {
        $('.editable').removeClass('editable');
        copyCitekey(this);
        $(this).addClass('editable');
    });

    $(document).click(function(e) {
        if ($(e.target).closest('.cite').length == 0) {
            $('.editable').removeClass('editable');
        }
    });

    $(document).on('click', '#search_results > .cite', function() {
        editCite(this);
    });

    $(document).on('click', '.update', function(e) {
        editCite(this);
        $('.editable').removeClass('editable');
        e.stopPropagation();
    });

    $(document).on('click', '.delete', function() {
        let key = $(this).closest('.cite').attr('id');
        sendCommand('delete_cite', {key: key});
        $('.editable').removeClass('editable');
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
    holder.empty();
    Object.entries(data).forEach(([key, cite]) => {
        createBibEntry(key, cite, holder);
    });
    $('#bib_input').val('');
    sortCite('#para_holder');
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
        entry: `${author}${yr}${title}. <em>${journal}</em>${index} ${pub}`,
    }
}

function createBibEntry(key, cite, target, results=false) {
    target.find(`#${key}`).remove();

    let info = createBibInfo(cite);
    let raw = cite.raw || '';

    let buts = `<button class="update">Update</button>
                <button class="delete">Delete</button>`;

    if (results) {
        buts = `<button class="update">Edit</button>`;
    }

    target.append(
        `<div class="cite" id="${key}" citeType=cite raw="${raw}">
            ${info.entry}
            <span class="citekey">${key}</span>
            <div class="control">
                <div class="controlDots">&#9776;</div>
                <div class="controlButs">
                ${buts}
            </div>
        </div>`
    );
}

// editing and nav

function copyCitekey(cite) {
    let textArea = document.createElement("textarea");
    textArea.value = $(cite).attr('id');
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("Copy");
    textArea.remove();
}

function sortCite(id) {
    let divs = $(".cite");
    let alphabeticallyOrderedDivs = divs.sort(function(a, b) {
        return $(a).text() > $(b).text();
    });
    $(id).html(alphabeticallyOrderedDivs);
}

function editCite(el) {
    let src = $(el).closest('.cite').attr('raw');
    $('#bib_input').val(src);
    $('#search_results').find('.cite').remove();
    $('.nr').remove()
    $('#search_results').hide();
}
