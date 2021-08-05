/* random utilities */

export {
    merge, mapObject, mapValues, attrArray, initToggleBox, toggleBox,
    ensureVisible, setCookie, cooks, getPara, getEnvParas, isMobile, noop,
    on_success, KeyCache, DummyCache, RefCount, flash
}

// js tricks

function merge() {
    return Object.assign({}, ...arguments);
}

function mapObject(obj, func) {
    return Object.fromEntries(Object.entries(obj).map(([x, y]) => func(x, y)));
}

function mapValues(obj, func) {
    return Object.fromEntries(Object.entries(obj).map(([x, y]) => [x, func(y)]));
}

function attrArray(elems, attr) {
    return elems.map((i, x) => $(x).attr(attr)).toArray();
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

// messages

function flash(msg) {
    let flash = $('<div>', {text: msg});
    flash.attr('id', 'flash')
    $('#bg').append(flash)
    $('#flash').fadeIn(400, function(){
        setTimeout(function(){
            $('#flash').fadeOut(400, function(){
                $(this).remove();
            });
        }, 800);
    });
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

    see(key) {
        return this.data.get(key);
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

    del(key) {
        return this.data.delete(key);
    }

    flush() {
        this.data.clear();
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

    values() {
        return [...this.data.values()];
    }
}

class DummyCache {
    constructor(name) {
        this.name = name;
    }

    has(key) {
        return false;
    }

    see(key) {
        return;
    }

    get(key, callback) {
        callback(null);
    }

    del(key) {
        return false;
    }

    flush() {
    }

    many(keys) {
        return Object.fromEntries(keys.map(k => [k, null]));
    }

    bulk(keys, callback) {
        callback(this.many(keys));
    }

    keys() {
        return [];
    }
}

// reference counting

class RefCount {
    constructor(create=noop, destroy=noop) {
        this.count = new Object();
        this.create = create;
        this.destroy = destroy;
    }

    inc(key) {
        if (key in this.count) {
            this.count[key] += 1;
        } else {
            this.count[key] = 1;
            this.create(key);
        }
    }

    dec(key) {
        if (key in this.count) {
            this.count[key] -= 1;
            if (this.count[key] == 0) {
                this.destroy(key);
                delete this.count[key];
            }
        }
    }

    get(key) {
        if (key in this.count) {
            return this.count[key];
        } else {
            return 0;
        }
    }
}

// para tools

function getPara(pid) {
    return $(`#content > .para[pid=${pid}]`);
}

function getEnvParas(env_pid) {
    return $(`#content > .para[env_pid=${env_pid}]`);
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

function setCookie(key, val, age) {
    let agestr = (age === undefined) ? '' : `age=${age}; `;
    let valstr = encodeURIComponent(val);
    document.cookie = `${key}=${valstr}; path=/; ${agestr}SameSite=Lax`;
}

function cooks(name) {
    let parts = document.cookie.split(';');
    let pairs = parts.map(x => x.trim().split('='));
    let select = pairs.filter(x => x[0] == name).shift();
    if (select !== undefined) {
        let value = decodeURIComponent(select[1]);
        return JSON.parse(value);
    }
};

// detect mobile

function isMobile() {
    return window.matchMedia('(max-width: 600px) and (max-device-width: 800px)').matches;
}
