import { DummyCache } from './utils.js';
import { updateState, updateCache, state, config } from './state.js';
import { stateRender, connectCallbacks, makePara, eventRender, rawToRender, envClasses, barePara } from './render.js';
import { SyntaxHL, braceMatch } from './hl.js';
import { renderKatex } from './math.js';
import { initEditor, eventEditor, makeActive, sendMakeEditable } from './editor.js';
import { ccRefs } from './article.js';

/* main article entry point */

let default_cache = {
    ext: new DummyCache('ext'), // external refs/blurbs
    link: new DummyCache('link'), // article links/blurbs
    cite: new DummyCache('cite'), // bibliography entries
    img: new DummyCache('img'), // local image cache
    list: new DummyCache('list'), // external reference completion
};

let default_state = {
    sidebar_show: false, // is sidebar shown
    help_show: false, // is help overlay on
    hist_show: false, // is history mode on
    ssv_mode: true, // sidebyside view for demo
    active_para: null, // current active para
    last_active: null, // to keep track of where cursor was
    rawtext: false, // are we showing the raw textarea
    writeable: false, // can we actually modify contents
    folded: [], // current folded pids
    cc: false, // is there a command completion window open
    cb: [], // clipboard for cell copy
    paus: 0, // when to paus video (must be global becuase fucking passing args to callbacks, amiright?)
};

let dummy_callbacks = {
    lock: data => {
        console.log('dummy lock:', data.pid);
        return true;
    },
    unlock: data => {
        console.log('dummy unlock:', data.pid);
        return true;
    },
    update_para: data => {
        console.log('dummy update_para:', data.pid);
        return true;
    },
    update_ref: data => {
        console.log('dummy update_ref:', data.key);
        return true;
    },
    timeout: data => {
        console.log('dummy timeout');
    },
    get_image: data => {
        console.log('dummy get_image:', data.key);
        return {found: false};
    },
    get_link: data => {
        console.log('dummy get_link:', data.title, data.blurb);
        return {found: false};
    },
    get_ref: data => {
        console.log('dummy get_ref:', data.title, data.key);
        return {cite_type: 'err', cite_err: 'art_not_found'};
    },
    get_cite: data => {
        console.log('dummy get_cite:', data.keys);
        return [];
    },
    get_arts: data => {
        console.log('dummy get_article:', data);
        return [];
    },
};

let examples = {
    'text': [
        "**elltwo** ($\\ell^2$) is a browser based platform for decentralized and collaborative technical documents.",
        "It has a wiki like structure with an emphasis on typesetting and intelligent referencing.",
        "elltwo articles are written in a simple markup language borrowing elements of [Markdown](https://en.wikipedia.org/wiki/Markdown) and [LaTeX](https://www.latex-project.org/)."
    ],
    'equations': [
        "$$ [eq_geo] \\sum_{n=1}^{\\infty} \\frac1{2^n} = 1",
        "Equation @[eq_geo] states a geometric sum and can be generalized for values $a > 1$ to",
        "$$* \\sum_{n=1}^{\\infty} \\frac{1}{a^n} = \\frac{1}{a-1}",
    ],
    'environments': [
        ">> theorem [thm_BC|name=rt=Borel Cantelli] If the sum of the probabilities of the events $\\{E_n\\}_{n\\in \\mathbb{N}}$ is finite, then",
        "$$ \\mu\\left(\\bigcap_{n=1}^{\\infty }\\bigcup_{k\\geq n}^{\\infty }E_{k}\\right) = 0",
        "<< that is, the probability that infinitely many of them occur is $0$.",
        "The @[thm_BC] theorem is an important result in establishing ...",
    ],
    'images': [
        `!svg [svg_figure|caption=It's a box|width=60]\n<rect x="5" y="5" width="90" height="90" stroke="black" fill="#5D9D68" />`,
        "Embed and reference images and SVG figures easily, as with @[svg_figure]."
    ],
};

function initIndex() {
    renderKatex();

    stateRender();

    updateState(default_state);
    updateCache(default_cache);
    state.writeable = true;

    // init dummy server commandss
    connectCallbacks(dummy_callbacks);

    // make empty paras
    $('.para').each(function() {
        let para = $(this);
        makePara(para, false);
    });

    //make editor work
    initEditor();

    //constuct examples
    initExamples(examples);
    genExample('text');
    //noSSV for mobile
    setSsvMode(!config.mobile);

    // events
    eventRender();
    eventEditor();
    eventIndex();

    //video
    controlVid();
}

function eventIndex() {
    $(document).on('input', '.p_input', function(e) {
        let para = $(this).parent('.para');
        let text = para.children('.p_input');
        let view = para.children('.p_input_view');
        let raw = text.val();
        let cur = e.target.selectionStart;
        ccRefs(view, raw, cur);
        let hl = SyntaxHL(raw, 'elltwo');
        view.html(hl);
        rawToRender(para, true, false, raw); // local changes only
        envClasses();
    });

    $(document).on('keyup', '.p_input', function(e) {
        let arrs = [37, 38, 39, 40, 48, 57, 219, 221];
        if (arrs.includes(e.keyCode)) {
            var para = $(this).parent('.para');
            braceMatch(this, para);
        }
    });

    $(document).on('click', '.ex_butt', function() {
        let ex = $(this).attr('id');
        $('.para').remove();
        genExample(ex);
    });

    $(document).on('click', '.para', function(event) {
        let para = $(this);
        para.hasClass('active');
        para.hasClass('rawtext');
        let targ = event.target.href; // if link, follow link
        if (!targ) {
                let para = $(this);
                let cur = (event.target.selectionStart !== undefined)
                    ? [event.target.selectionStart, event.target.selectionEnd]
                    : 'end'; // returns undefined if not a textarea
                let act = para.hasClass('active');
                if (state.ssv_mode) {
                    if (cur[0] == cur[1] || cur == 'end') {
                        if (!act) {
                            makeActive(para);
                        }
                        if (!state.rawtext) {
                            sendMakeEditable(cur);
                        }
                    }
                } else if (act) {
                    if (!state.rawtext) {
                        sendMakeEditable(cur);
                    }
                } else {
                    makeActive(para);
                }
            }
    });

    $(document).on('click', '#bg', function(e) {
        let targ = event.target.id;
        e.altKey || config.mobile;
        if (targ == 'bg' || targ == 'content') {
            makeActive(null);
        }
    });

    $(document).on('change', '#ssv_check', function() {
        let check = $(this);
        let val = check.is(':checked');
        let text = val ? 'Side-by-Side View' : 'Classic View';
        $('#ssv_text').text(text);
        setSsvMode(val);
    });
}

function genExample(example) {
    $(`.ex_butt`).removeClass('clicked');
    $(`#${example}.ex_butt`).addClass('clicked');

    examples[example].forEach((raw, i) => {
        let para = barePara(i, raw);
        $('#content').append(para);
        makePara(para);
        let input = para.children('.p_input');
        let view = para.children('.p_input_view');
        resize(input[0]);
        let hl = SyntaxHL(raw, 'elltwo');
        view.html(hl);
    });
    envClasses();
}

function initExamples(examples) {
    for (const example in examples) {
        let ex = $('<div>', {class: `ex_butt`, text: example});
        ex.attr('id', example);
        $('#example_options').append(ex);
    }}

/// video control

let vid_callback = function (es) {
    es.forEach(function (e) {
        // entry.isIntersecting true if in viewport
        if(e.isIntersecting){
            let f = $(e.target).attr('feature');
            $(e.target).attr('tb');
            $(e.target).attr('te');
            // let vid = document.getElementById('feature_gif')
            //playPause(vid, tb, te)
            playPause(f);
        }
    });
};

let vid_options = {
    root: null,
    rootMargin: '0px',
    threshold: .8,
};

let obVid = new IntersectionObserver(vid_callback, vid_options);

// const paus = function(){
//     if(this.currentTime >= state.vid) {
//         this.pause();
//         this.removeEventListener("timeupdate",paus);
//     }
// };

let playPause  = function(f){
    // vid.currentTime = tb;
    // vid.play();
    // state.vid = te;
    // vid.addEventListener("timeupdate", paus);
    f = f + ".gif";
    let gif = $('#feature_gif');
    let src = gif.attr('src').split('/');
    src.splice(-1,1,f);
    src = src.join('/');
    gif.attr('src', src);
};

function controlVid(timeStamps) {
    let features = document.querySelectorAll('.feature');
    features.forEach(feature => obVid.observe(feature));
}

function setSsvMode(val) {
    console.log('ssv', state.ssv_mode);
    state.ssv_mode = val;
    $('#content').toggleClass('ssv', val);
    $('.para:not(.folded)').each(function() {
        let input = $(this).children('.p_input');
        resize(input[0]);
    });
}

// making header smaller---mostly for testing

let head_callback = function (entries) {
    entries.forEach(function (entry) {
        // entry.isIntersecting true if in viewport
        $('#head_block').toggleClass('stuck',!entry.isIntersecting);
    });
};

var head_options = {
    root: null,
    rootMargin: '100px',
    threshold: 1,
};

let obHead = new IntersectionObserver(head_callback, head_options);

// the element to observe
let sen = document.querySelector('#sentinal');

// attach it to the observer
obHead.observe(sen);

export { controlVid, initIndex };
