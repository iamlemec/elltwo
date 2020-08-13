$(document).ready(function() {
    var url = `http://${document.domain}:${location.port}`;
    client.connect(url);
    client.sendCommand('room', {'room': '__home'}, function(response) {
        console.log(response);
        });
});


$(document).on('click', '#submit', function() {
    createArt();
});

let timeout = null;

$(document).keyup(function(e) {
    if (e.keyCode==13){
        createArt();
    } else if (String.fromCharCode(e.keyCode).match(/(\w|\s)/g)||e.keyCode==8||e.keyCode==46) {
        clearTimeout(timeout);
        timeout = setTimeout(function () {
            query = $('#new_art_id').val()
            if (query.length > 2) {
                searchTitle(query);
            } else {
                $('#results').empty();
            };
        }, 200);
    }
});

searchTitle = function(query){
    client.sendCommand('search_title', query, function(response) {
        $('#results').empty();
        if(response){
            for (var title in response) {
                art = response[title];
                url = 'a/'+art.url;
                var artdiv = $('<a>', {class: 'art_result', href: url, html: title});
                if(art.blurb){
                    var b = $('<div>', {class: 'blurb', html: art.blurb});
                    artdiv.append(b);
                }
                $('#results').append(artdiv);
            };
        };
    });
};

createArt = function(){
    query = $('#new_art_id').val()
    if (query.length > 2) {
        client.sendCommand('create_art', query, function(response) {
            window.location = response;
        });
    };
}


