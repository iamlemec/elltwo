
getCiteData = function(q){

    q = q.replace(' ', '+')
    url = "https://api.crossref.org/works?rows=5&query.bibliographic="
    $.getJSON(url+q).then(function(data){
        cts = data.message.items
        data = cts.map(createbtjs).filter(Boolean);
        console.log(data)
        if(data.length == 0){
            nr = $('<span>', {class: `nr`, html: "No Results Found"});
            $('#search_results').append(nr)
        } else {
            data.forEach(function(cite){
            createBibEntry(cite, $('#search_results'), true);
            });
        };
    });
}

createbtjs = function(bd){
    neededKeys = ['title', 'author', 'published-print'];
    keys = Object.keys(bd);
    if(neededKeys.every(key => keys.includes(key))){
        btjs = {}
        btjs.title = bd.title[0]
        authors = bd.author.map(a => a.family +", " + a.given)
        btjs.author = authors.join(" and ")
        btjs.year = bd['published-print']['date-parts'][0][0]
        if(bd.hasOwnProperty('volume')){
            btjs.volume = bd.volume;
        };
        if(bd.hasOwnProperty('page')){
            btjs.pages = bd.page;
        };
        if(bd.hasOwnProperty('publisher')){
            btjs.publisher = bd.publisher;
        };  
        if(bd.hasOwnProperty('DOI')){
            btjs.DOI = bd.DOI;
        };
        if(bd.hasOwnProperty('type')){
            btjs.entry_type = bibmap[bd.type];
        };
        if(bd.hasOwnProperty('container-title')){
            if (btjs.entry_type == 'article'){
                btjs.journal = bd['container-title'][0];
            } else if (btjs.entry_type == 'incollection'){
                btjs.booktitle = bd['container-title'][0]
            };
        };
        s = bd.author[0].family.toLowerCase() + btjs.year + btjs.title.split(' ')[0];
        s = s.replace(/[^\w\s]/g, "");
        btjs.citekey = s;
        btjs.raw = toBibtexStr(btjs);
        return btjs;
    } else {
            return false;
    };
};

toBibtexStr = function(btjs){
        bibtex = `@${btjs.entry_type}{${btjs.citekey}`
        for (key in btjs){
            if(key!='entry_type'&&key!='citekey')
            bibtex += `, ${key} = {${btjs[key]}}`
        };
        bibtex += "}"        
        return bibtex
    };


bibmap = {
    'journal-article': 'article',
    'book-chapter': 'incollection',
    'dataset': 'techreport',
}


