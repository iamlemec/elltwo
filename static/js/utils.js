/* random utilities */

export {
    merge, mapObject, initToggleBox, toggleBox, ensureVisible, setCookie,
    cooks, getPara, isMobile, noop, on_success, KeyCache, DummyCache
}

// js tricks

function merge() {
    return Object.assign({}, ...arguments);
}

function mapObject(obj, func) {
    return Object.fromEntries(Object.entries(obj).map(([x, y]) => func(x, y)));
}

function noop() {
}

function on_success(func) {
    return function(success) {
        if (success) {
            func();
        }
    };
}

// key cache

class KeyCache {
    constructor(name, getter, bulker) {
        this.name = name;
        this.getter = getter;
        this.bulker = bulker;
        this.data = new Map();
    }

    has(key) {
        return this.data.has(key);
    }

    get(key, callback) {
        let kc = this;
        if (this.data.has(key)) {
            let val = this.data.get(key);
            callback(val);
        } else {
            this.getter(key, function(val) {
                if (val !== undefined) {
                    kc.data.set(key, val);
                }
                callback(val);
            });
        }
    }

    del() {
        return this.data.delete(key);
    }

    many(keys) {
        return Object.fromEntries(keys.map(k => [k, this.data.get(k)]));
    }

    bulk(keys, callback) {
        if (this.bulker === undefined) {
            console.log(`KeyCache ${this.name} is not bulked`);
            return;
        }

        let kc = this;
        let rest = keys.filter(k => !this.has(k));
        if (rest.length > 0) {
            this.bulker(rest, function(vals) {
                for (const [k, v] of Object.entries(vals)) {
                    if (v !== undefined) {
                        kc.data.set(k, v);
                    }
                }
                let ret = kc.many(keys);
                callback(ret);
            });
        } else {
            let ret = this.many(keys);
            callback(ret);
        }
    }

    keys() {
        return [...this.data.keys()];
    }
}

class DummyCache {
    constructor(name) {
        this.name = name;
    }

    has(key) {
        return false;
    }

    get(key, callback) {
        callback(undefined);
    }

    del(key) {
        return false;
    }

    many(keys) {
        return Object.fromEntries(keys.map(k => [k, undefined]));
    }

    bulk(keys, callback) {
        callback(this.many(keys));
    }

    keys() {
        return [];
    }
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

let scrollSpeed = 0;
let scrollFudge = 25;

function scrollTo(elem, pos) {
    if (scrollSpeed == 0) {
        elem.scrollTop(pos);
    } else {
        elem.stop();
        elem.animate({scrollTop: pos}, scrollSpeed);
    }
}

function ensureVisible(elem) {
    let cont = elem.parent();
    let scroll = cont.scrollTop();
    let height = cont.height();

    let cell_top = scroll + elem.position().top;
    let cell_bot = cell_top + elem.height();

    let page_top = scroll;
    let page_bot = page_top + height;

    let targ;
    if (cell_top < page_top + scrollFudge) {
        targ = cell_top - scrollFudge;
    } else if (cell_bot > page_bot - scrollFudge) {
        targ = cell_bot - height + scrollFudge;
    }

    scrollTo(cont, targ);
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
    return window.matchMedia('(max-width: 600px) and (max-device-width: 800px)').matches;
}
