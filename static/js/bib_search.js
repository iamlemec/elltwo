// bibliography tools

export { getCiteData }

import { createBibInfo, createBibEntry} from './bib.js'

function getCiteData(q) {
    q = q.replace(' ', '+');
    let url = 'https://api.crossref.org/works?rows=5&query.bibliographic=';
    $.getJSON(url+q).then(function(data) {
        let cts = data.message.items;
        data = cts.map(createbtjs).filter(Boolean);
        console.log(data);
        if (data.length == 0) {
            let nr = $('<span>', {class: `nr`, html: "No Results Found"});
            $('#search_results').append(nr);
        } else {
            data.forEach(function(cite) {
                createBibEntry(cite.citekey, cite, $('#search_results'), true);
                //console.log(v)
            });
        }
    });
}

function createbtjs(bd) {
    let neededKeys = ['title', 'author', 'published-print'];
    let keys = Object.keys(bd);
    if (neededKeys.every(key => keys.includes(key))) {
        let btjs = {};
        btjs.title = bd.title[0];
        let authors = bd.author.map(a => a.family +", " + a.given);
        btjs.author = authors.join(' and ');
        btjs.year = bd['published-print']['date-parts'][0][0];
        if (bd.hasOwnProperty('volume')) {
            btjs.volume = bd.volume;
        }
        if (bd.hasOwnProperty('page')) {
            btjs.pages = bd.page;
        }
        if (bd.hasOwnProperty('publisher')) {
            btjs.publisher = bd.publisher;
        }
        if (bd.hasOwnProperty('DOI')) {
            btjs.DOI = bd.DOI;
        }
        if (bd.hasOwnProperty('type')) {
            btjs.entry_type = bibmap[bd.type];
        }
        if (bd.hasOwnProperty('container-title')) {
            if (btjs.entry_type == 'article') {
                btjs.journal = bd['container-title'][0];
            } else if (btjs.entry_type == 'incollection') {
                btjs.booktitle = bd['container-title'][0];
            }
        }
        let s = bd.author[0].family.toLowerCase().replace(' ', '') + btjs.year + btjs.title.split(' ')[0];
        s = s.replace(/[^\w\s]/g, "");
        btjs.citekey = s;
        btjs.raw = toBibtexStr(btjs);
        return btjs;
    } else {
        return false;
    }
}

function toBibtexStr(btjs) {
    let bibtex = `@${btjs.entry_type}{${btjs.citekey}`;
    let key;
    for (key in btjs) {
        if (key != 'entry_type' && key != 'citekey') {
            bibtex += `, ${key} = {${btjs[key]}}`;
        }
    }
    bibtex += "}";
    return bibtex;
}

let bibmap = {
    'journal-article': 'article',
    'book-chapter': 'incollection',
    'dataset': 'techreport',
};
