// general login stuff

$(document).on('click', '#toggle_ll', function() {
    $('#locallogin').fadeToggle('slow', function() {
        var a = 'LogIn to Edit';
        var b = 'Hide Login';
        var el = $('#toggle_ll');
        var msg = el.html() == b ? a : b;
        el.html(msg);
    });
});

// if(mobile){ //remove footer for mobile when keyboard is up

//     $(document).on('focus', 'input', function() {
//         $('#foot').hide();
//     });

//     $(document).on('focusout', 'input', function() {
//         $('#foot').show();
//     });

// }