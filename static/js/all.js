// general login stuff

var loginbox = false 


toggleBox = function(bool, button, box){


    $(document).ready(function() {
        $(button).click(function(){
            if(bool){
                $(box).hide()
                bool = false
            }else{
                $(box).show()
                bool = true
            };
        });
    });


    $(document).click(function(e) {
        if (bool) {
            if ($(e.target).closest('button').length == 0
              && $(e.target).closest('box').length == 0) {
                    $(box).hide()
                    bool = false
            };
        };
    });
};

$(document).ready(function() {
    toggleBox(loginbox, '#toggle_ll', '#locallogin')
});

