$(document).ready(function() {
    var url = `http://${document.domain}:${location.port}`;
    client.connect(url);
    client.sendCommand('get_bib', {'keys': ""});
});

generateJson = function(src){
    var json = bibtexParse.toJSON(src); 
    if(!(json[0])){
        return 'Err: bibtex entry incorrectly specified'
    } else {
        if(!(json[0]['entryTags']['title'])){
        console.log('Err: Title Required');
        return false
        }else if (!(json[0]['entryTags']['author'])){
        console.log('Err: Author Required');
        return false
        }else if (!(json[0]['entryTags']['year'])){
        console.log('Err: Year Required');
        return false
        }else{
        return json[0]; 
        };
    };
};


/// editing

$(document).on('click', '#create', function () {
    var src = $('#bib_input').val();
    json = generateJson(src);
    if(json){
        json.entryTags.raw = src;
        client.sendCommand('create_cite', json);
    };
});

$(document).on('click', '#search', function () {
    var q = $('#bib_input').val();
    $('#search_results').find('.cite').remove();
    $('.nr').remove()
    $('#search_results').show();
    getCiteData(q);
});


$(document).on('click', '#xsr', function () {
    $('#search_results').find('.cite').remove();
    $('.nr').remove()
    $('#search_results').hide();
});

renderBib = function(data){
    //data.map(createBibEntry)
    data.forEach(function(cite){
        createBibEntry(cite, $('#para_holder'));

    });
    $('#bib_input').val("");
    sortCite('#para_holder')
    if(data.length == 1){
        location.href = '#'+data[0]['citekey']
    }
}

deleteCite = function(key){
    $('#'+key).remove();
}


createBibEntry = function(cite, target, results=false){

target.find('#'+cite['citekey']).remove();

yr = cite['year'] ? ` ${cite['year']}. ` : "";
vol = cite['volume'] ? `, ${cite['volume']}` : "";
num = cite['number'] ? `, no. ${cite['number']}` : "";
pgs = cite['pages'] ? `, pp. ${cite['pages']}` : "";
title = cite['title'] ? `${cite['title']}` : "";
raw=cite['raw'];
pubs = ['book', 'incollection'];
jns = ['article', 'techreport', 'unpublished'];
wild = ['undefined'];

DOI = cite['DOI'] ? `<a target='_blank' href=https://www.doi.org/${cite['DOI']}>[Go]</a>` : "";

if(pubs.includes(cite['entry_type'])){
    pub = cite['publisher'] || "";
    journal = (cite['booktitle']) ? `In ${cite['booktitle']}`: "";
}else if (jns.includes(cite['entry_type'])) {
    pub = ""
    journal = cite['journal'] || 'mimeo';
}else if (wild.includes(cite['entry_type'])) {
    pub = pub = cite['publisher'] || "";
    journal = cite['journal'] || cite['booktitle'] || "";
}

author = `<b>${cite['author']}</b>. ` || "";
index = (vol || num || pgs) ? `${vol + num + pgs}.` : "";

buts = `<button class="update">Update</button>
        <button class="delete">Delete</button>`;

if(results){
    buts = `<button class="update">Edit</button>`;
}


c = `<div class=cite id=${cite['citekey']} citeType=cite raw="${raw}">
${author}${yr}${title}. <em>${journal}</em>${index} ${pub} ${DOI}
<span class=citekey>${cite['citekey']}</span>
    <div class="control">
        <div class="controlDots">&#9776;</div>
        <div class="controlButs">
        ${buts}
    </div>
</div>`;

target.append(c);
}

//editing and nav

copy_citekey = function(cite) {
    var textArea = document.createElement("textarea");
    textArea.value = $(cite).attr('id');
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("Copy");
    textArea.remove();
}

$(document).on('click', '.cite', function(){
    copy_citekey(this)
});


sortCite = function(id){
  $divs = $(".cite")
  var alphabeticallyOrderedDivs = $divs.sort(function (a, b) {
        return $(a).text() > $(b).text();
    });
  $(id).html(alphabeticallyOrderedDivs)
};


$(document).on('click', '.update', function () {
    var src = $(this).closest('.cite').attr('raw');
    $('#bib_input').val(src);
    $('#search_results').find('.cite').remove();
    $('.nr').remove()
    $('#search_results').hide();
});

$(document).on('click', '.delete', function () {
    var key = $(this).closest('.cite').attr('id');
    data = {'key': key}
    client.sendCommand('delete_cite', data);
});
