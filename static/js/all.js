// general login stuff

var loginbox = false;

toggleBox = function(bool, button, box) {
    $(document).ready(function() {
        $(button).click(function() {
            if (bool) {
                $(box).hide();
                bool = false;
            } else {
                $(box).show();
                bool = true;
            };
        });
    });

    $(document).click(function(e) {
        if (bool) {
            var targ = $(e.target);
            var close_butt = targ.closest('button');
            var close_box = targ.closest('box');
            if ((close_butt.length == 0) && (close_box.lenght == 0)) {
                $(box).hide();
                bool = false;
            }
        }
    });
};

$(document).ready(function() {
    toggleBox(loginbox, '#toggle_ll', '#locallogin');
});
