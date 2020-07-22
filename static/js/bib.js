
$(document).on('click', '#create', function () {
    var src = $('#bib_input').val();
    json = generateJson(src);
   client.sendCommand('create_cite', json);
});

generateJson = function(src){
 var json = bibtexParse.toJSON(src); 
 console.log(json)
 if(!(json[0])){
    return 'Err: bibtex entry incorrectly specified'
 } else {
    return json[0]; 
};
};

$(document).ready(function() {
    var url = `http://${document.domain}:${location.port}`;
    client.connect(url);
    client.sendCommand('get_bib', {'cites': ""});
});


/// editing

renderBib = function(data){
    $('#para_holder').empty();
    data.map(createBibEntry)
    sortCite('#para_holder')
}

createBibEntry = function(cite){

yr = cite['year'] ? ` ${cite['year']}. ` : "";
vol = cite['volume'] ? `, ${cite['volume']}` : "";
num = cite['number'] ? `, no. ${cite['number']}` : "";
pgs = cite['pages'] ? `, pp. ${cite['pages']}` : "";
title = cite['title'] ? `${cite['title']}` : "";
journal = cite['journal'] || 'mimeo';
journal = `<em>${journal}</em>`

author = `<b>${cite['author']}</b>. ` || "";


if(author&&yr){
    var author_list = cite['author'].split(" and ").map(auth => auth.split(',')[0]);
    if(author_list.length == 2){
        citeText = author_list[0] + " and " + author_list[1];
    } else if(author_list.length == 2){
        citeText = author_list[0];
    } else {
        citeText = author_list[0] + " et al.";
    };
    citeText += ` (${cite['year'] || 0})`;
}

c = `<div class=cite id=${cite['citekey']} citeText="${citeText}">
${author}${yr}${title}. <em>${journal}</em>
${vol + num + pgs}.
</div>`;

$('#para_holder').append(c);
}



sortCite = function(id){
  $divs = $(".cite")
  var alphabeticallyOrderedDivs = $divs.sort(function (a, b) {
        return $(a).text() > $(b).text();
    });
  $(id).html(alphabeticallyOrderedDivs)
};
