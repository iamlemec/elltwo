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
        json['entryTags']['raw'] = src;
        client.sendCommand('create_cite', json);
    };
});

renderBib = function(data){
    data.map(createBibEntry)
    $('#bib_input').val("");
    sortCite('#para_holder')
    if(data.length == 1){
        location.href = '#'+data[0]['citekey']
    }
}

deleteCite = function(key){
    $('#'+key).remove();
}

createBibEntry = function(cite){

$('#'+cite['citekey']).remove();

console.log(cite['entry_type'])

yr = cite['year'] ? ` ${cite['year']}. ` : "";
vol = cite['volume'] ? `, ${cite['volume']}` : "";
num = cite['number'] ? `, no. ${cite['number']}` : "";
pgs = cite['pages'] ? `, pp. ${cite['pages']}` : "";
title = cite['title'] ? `${cite['title']}` : "";
raw=cite['raw'];
pubs = ['book', 'incollection'];
jns = ['article', 'techreport', 'unpublished'];

if(pubs.includes(cite['entry_type'])){
    pub = cite['publisher'] || "";
    journal = (cite['booktitle']) ? `In ${cite['booktitle']}`: "";
}else if (jns.includes(cite['entry_type'])) {
    pub = ""
    journal = cite['journal'] || 'mimeo';
}

author = `<b>${cite['author']}</b>. ` || "";
index = (vol || num || pgs) ? `${vol + num + pgs}.` : "";

c = `<div class=cite id=${cite['citekey']} citeType=cite raw="${raw}">
${author}${yr}${title}. <em>${journal}</em>${index} ${pub}
<span class=citekey>${cite['citekey']}</span>
    <div class="control">
        <div class="controlDots">&#9776;</div>
        <div class="controlButs">
        <button class="update">Update</button>
        <button class="delete">Delete</button>
    </div>
</div>`;

$('#para_holder').append(c);
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
});

$(document).on('click', '.delete', function () {
    var key = $(this).closest('.cite').attr('id');
    data = {'key': key}
    client.sendCommand('delete_cite', data);
});
