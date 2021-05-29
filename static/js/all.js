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
            //console.log(targ, close_butt,close_box)
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

// auto-render

renderKatex = function() {
    $('body').find('span.latex').each(function() {
        var tex = $(this);
        var src = tex.text();
        tex.empty();
        try {
          katex.render(src, tex[0],
            //{macros: config["macros"]}
            );
        } catch (e) {
          console.log($(this).text());
          console.log(src);
          console.log(e);
        }
    });
};

// scrolling

var scrollSpeed = 100;
var scrollFudge = 100;

ensureVisible = function(elem) {
    let cont = elem.parent();
    let scroll = cont.scrollTop();
    let height = cont.height();
    let cell_top = scroll + elem.position().top;
    let cell_bot = cell_top + elem.height();
    let page_top = scroll;
    let page_bot = page_top + height;

    if (cell_top < page_top + scrollFudge) {
        cont.stop();
        cont.animate({scrollTop: cell_top - scrollFudge}, scrollSpeed);
    } else if (cell_bot > page_bot - scrollFudge) {
        cont.stop();
        cont.animate({scrollTop: cell_bot - height + scrollFudge}, scrollSpeed);
    }
};

// get json cookies

cooks = function(name) {
    const cookies = `; ${document.cookie}`;
    const parts = cookies.split(`; ${name}=`);
    if (parts.length == 2) {
        const f = parts.pop().split(';').shift();
        return JSON.parse(f);
    }
};

// jquery malarkey

$.fn.ignore = function(sel) {
    return this.clone().find(sel || '>*').remove().end();
};
