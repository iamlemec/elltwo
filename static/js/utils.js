/* random utilities */

export {
    merge, initToggleBox, toggleBox, ensureVisible, setCookie, cooks, getPara,
    isMobile
}

// js tricks

function merge() {
    return Object.assign({}, ...arguments);
}

// para tools

function getPara(pid) {
    return $(`#content [pid=${pid}]`);
}

// toggle boxen

function isVisible(elem) {
    return elem.is(':visible');
}

function toggleBox(box) {
    if (isVisible(box)) {
        box.hide();
    } else {
        box.show();
    }
}

function initToggleBox(button, box) {
    button = $(button);
    box = $(box);

    button.click(function() {
        toggleBox(box);
    });

    $(document).click(function(e) {
        if (isVisible(box)) {
            let targ = $(e.target);
            let close_butt = targ.closest(button);
            let close_box = targ.closest(box);
            if ((close_butt.length == 0) && (close_box.length == 0)) {
                box.hide();
            }
        }
    });
};

// scrolling

let scrollSpeed = 100;
let scrollFudge = 100;

function ensureVisible(elem) {
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

function setCookie(key, value) {
    document.cookie = `${key}=${value}; path=/; samesite=lax; secure`;
}

function cooks(name) {
    const cookies = `; ${document.cookie}`;
    const parts = cookies.split(`; ${name}=`);
    if (parts.length == 2) {
        const f = parts.pop().split(';').shift();
        return JSON.parse(f);
    }
};

// detect mobile

function isMobile() {
    return window.matchMedia('(max-width: 815px)').matches;
}
