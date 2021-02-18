

$(document).on('click', '#toggle_ll', function() {
      $( "#locallogin" ).fadeToggle( "slow", function() {
        a = "LogIn to Edit"
        b = "Hide Login"
        el = $('#toggle_ll')
    el.html(el.html() == b ? a : b);
  });
});




