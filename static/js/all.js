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
            var close_butt = targ.closest(button);
            var close_box = targ.closest(box);
            console.log(targ, close_butt,close_box)
            if ((close_butt.length == 0) && (close_box.length == 0)) {
                $(box).hide();
                bool = false;
            }
        }
    });
};

$(document).ready(function() {
    toggleBox(loginbox, '#toggle_ll', '#locallogin');
});
