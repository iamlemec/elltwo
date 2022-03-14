/* random utilities */

// js tricks

function merge() {
    return Object.assign({}, ...arguments);
}

function attrArray(elems, attr) {
    return elems.map((i, x) => $(x).attr(attr)).toArray();
}

function noop() {
}

// messages

function flash(msg) {
    let flash = $('<div>', {text: msg, id: 'flash'});
    $('#bg').append(flash);
    flash.fadeIn(400, function() {
        setTimeout(function() {
            flash.fadeOut(400, function() {
                flash.remove();
            });
        }, 800);
    });
}

// copy text to clipboard

function copyText(txt) {
    let textArea = document.createElement("textarea");
    textArea.value = txt;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("Copy");
    textArea.remove();
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

    async get(key,callback=null) {
        let kc = this;
        let val;
        if (this.data.has(key)) {
            val = this.data.get(key);
        } else {
            val = await this.getter(key);
            if (val !== undefined) {
                kc.data.set(key, val);
            }
        }
        if(callback){
            return callback(val)
        }
        return val;
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

    async bulk(keys) {
        if (this.bulker === undefined) {
            console.log(`KeyCache ${this.name} is not bulked`);
            return;
        }

        let rest = keys.filter(k => !this.has(k));
        if (rest.length > 0) {
            let vals = await this.bulker(rest);
            for (const [k, v] of Object.entries(vals)) {
                if (v !== undefined) {
                    this.data.set(k, v);
                }
            }
        }

        return this.many(keys);
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

    get(key) {
        return null;
    }

    del(key) {
        return false;
    }

    flush() {
    }

    many(keys) {
        return Object.fromEntries(keys.map(k => [k, null]));
    }

    bulk(keys) {
        return {};
    }

    keys() {
        return [];
    }

    values() {
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

// html constructors

function createIcon(id) {
    return `
<svg>
<use xlink:href="/dist/img/icons.svg#${id}"></use>
</svg>
`.trim();
}

function createToggle(id, text, checked=true){
    checked = checked ? 'checked' : '';
    return `
<label class="toggle" for="${id}_check" id="${id}_label">
<span> ${text} </span>
<input type="checkbox" class="toggle__input" id="${id}_check" ${checked}/>
<span class="toggle-track"><span class="toggle-indicator"><span class="checkMark">
${createIcon('svg-check')}
</span></span></span>
</label>
`.trim();
}

function createButton(id, text, iconName, smallable=false) {
    // set smallable=true to include class,
    // set as dict to add to dict also to pass later to some function

    let s = smallable ? 'smallable_butt' : '';
    let but = $('<button>', {id: id, class: `foot_butt ${s}`});
    let t = $('<span>', {id: `${id}_text`});
    but.append(t);
    but.append(createIcon(iconName));

    if (typeof(smallable) === 'object') {
        smallable[`#${id}_text`] = text;
    } else {
        t.text(text);
    }

    return but;
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
}
// slider shit

function updateSliderValue(slider) {
    let pos = (slider.value - slider.min) / (slider.max - slider.min);
    let len = slider.getBoundingClientRect().width;
    let lab = slider.parentNode.querySelector('.slider_label');
    let lef = (100*pos*(len-30))/len;
    lab.innerHTML = slider.value;
    lab.style.left = `${lef}%`; //in prec for window resize events
}

// button smalling

function smallable_butt(butts, threshold=1000) {
    let small = $(window).width() < threshold;

    for (const [id, text] of Object.entries(butts)) {
        let txt = small ? '' : text;
        let tit = small ? text : '';
        $(id).text(txt).parent().attr('title', tit);
    }}
// count unescaped chars in text

function unEscCharCount(str, char){
    let regex = new RegExp(`(\\\\*)\\${char}`, 'g');
    let all = [...str.matchAll(regex)] || []; //match char
    all=all.filter(x => (x[0].length%2==1)); //filter out escaped
    return all.length
}

// cursor position

function cur(e, full=false){
    if(full){
        return [e.target.selectionStart, e.target.selectionEnd];
    }
    return e.target.selectionStart;
}
let scrollFudge = 25;

function scrollTo(elem, pos) {
    {
        elem.scrollTop(pos);
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
}
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
}
// detect mobile

function isMobile() {
    try {
        return window.matchMedia('(max-width: 600px) and (max-device-width: 800px)').matches;
    } catch {
        return null;
    }
}

export { DummyCache, KeyCache, RefCount, attrArray, cooks, copyText, createButton, createIcon, createToggle, cur, ensureVisible, flash, getEnvParas, getPara, initToggleBox, isMobile, merge, noop, setCookie, smallable_butt, toggleBox, unEscCharCount, updateSliderValue };
