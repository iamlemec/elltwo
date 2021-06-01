/* bibtex library browswer */

export { initBib, createBibEntry }

import { connect, addHandler, sendCommand } from './client.js'
import { getCiteData } from './bib_search.js'

function initBib() {
    connectBib();
    eventBib();
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
        editcite(this);
    });

    $(document).on('click', '.update', function(e) {
        editcite(this);
        $('.editable').removeClass('editable');
        e.stopPropagation();
    });

    $(document).on('click', '.delete', function() {
        let key = $(this).closest('.cite').attr('id');
        let data = {'key': key};
        sendCommand('delete_cite', data);
        $('.editable').removeClass('editable');
    });
}

function connectBib() {
    let url = `http://${document.domain}:${location.port}`;
    connect(url, () => {
        sendCommand('join_room', {'room': '__bib'}, (response) => {
            // console.log(response);
        });
        sendCommand('get_bib', {});
    });

    addHandler('renderBib', function(refs) {
        renderBib(refs);
    });

    addHandler('deleteCite', function(key) {
        deleteCite(key);
    });
}

function generateJson(src) {
    let json = bibtexParse.toJSON(src);
    if (!json[0]) {
        return 'Err: bibtex entry incorrectly specified';
    } else {
        if (!(json[0]['entryTags']['title'])) {
            console.log('Err: Title Required');
            return false;
        } else if (!json[0]['entryTags']['author']) {
            console.log('Err: Author Required');
            return false;
        } else if (!json[0]['entryTags']['year']) {
            console.log('Err: Year Required');
            return false;
        } else {
            return json[0];
        }
    }
}

/// editing

function renderBib(data) {
    //data.map(createBibEntry);
    data.forEach(function(cite) {
        createBibEntry(cite, $('#para_holder'));
    });
    $('#bib_input').val('');
    sortCite('#para_holder');
    if (data.length == 1) {
        location.href = '#' + data[0]['citekey'];
    }
}

function deleteCite(key) {
    $(`#${key}`).remove();
}

function createBibEntry(cite, target, results=false) {
    console.log(cite.title);

    target.find('#'+cite['citekey']).remove();

    let yr = cite['year'] ? ` ${cite['year']}. ` : '';
    let vol = cite['volume'] ? `, ${cite['volume']}` : '';
    let num = cite['number'] ? `, no. ${cite['number']}` : '';
    let pgs = cite['pages'] ? `, pp. ${cite['pages']}` : '';
    let title = cite['title'] ? `${cite['title']}` : '';
    let raw = cite['raw'];
    let pubs = ['book', 'incollection'];
    let jns = ['article', 'techreport', 'unpublished'];
    let wild = [undefined];
    let doi = cite['DOI'] ? `<a target='_blank' href=https://www.doi.org/${cite['DOI']}>[Go]</a>` : '';

    let pub;
    let journal;
    if (pubs.includes(cite['entry_type'])) {
        pub = cite['publisher'] || '';
        journal = (cite['booktitle']) ? `In ${cite['booktitle']}`: '';
    } else if (jns.includes(cite['entry_type'])) {
        pub = '';
        journal = cite['journal'] || 'mimeo';
    } else if (wild.includes(cite['entry_type'])) {
        pub = pub = cite['publisher'] || '';
        journal = cite['journal'] || cite['booktitle'] || '';
    }

    let author = `<b>${cite['author']}</b> ` || '';
    let index = (vol || num || pgs) ? `${vol + num + pgs}.` : '';

    let buts = `<button class="update">Update</button>
                <button class="delete">Delete</button>`;

    if (results) {
        buts = `<button class="update">Edit</button>`;
    }

    target.append(
        `<div class=cite id=${cite['citekey']} citeType=cite raw="${raw}">
            ${author}${yr}${title}. <em>${journal}</em>${index} ${pub} ${doi}
            <span class=citekey>${cite['citekey']}</span>
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

function editcite(el) {
    let src = $(el).closest('.cite').attr('raw');
    $('#bib_input').val(src);
    $('#search_results').find('.cite').remove();
    $('.nr').remove()
    $('#search_results').hide();
}
