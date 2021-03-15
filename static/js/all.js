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
