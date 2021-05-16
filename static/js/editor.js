////// UI ///////

// global state
var active_para = null; // current active para
var last_active = null; // to keep track of where cursor was
var editable = false; // are we focused on the active para
var writeable = !readonly; // can we actually modify contents
var cb = []; // clipboard for cell copy

/// textarea manage

resize = function(textarea) {
    textarea.style.height = 'auto';
    let h = (textarea.scrollHeight) + 'px'
    textarea.style.height = h;
    let para = $(textarea).parent('.para');
    para.css('min-height', h);
};

// resize text area on input (eliminate scroll)
$(document).on('input focus', 'textarea', function() {
    resize(this);
});

/// rendering and storage

// store a change locally, if no change also unlock server side
localChange = function(para, send=true) {
    let text = para.children('.p_input').val();
    let raw = para.attr('raw');
    if (text != raw) {
        $(para).addClass('changed');
        sendUpdatePara(para);
    } else {
        if (send) {
            var pid = para.attr('pid');
            sendUnlockPara([pid]);
        }
    }
    rawToRender(para, false, text); // local changes only
};

// store change server side if any local changes
storeChange = function(para, raw) {
    para.attr('raw', raw);
    updateRefHTML(para);
    $(para).removeClass('changed')
           .removeAttr('old_id');
};

/// server comms and callbacks

on_success = function(func) {
    return function(success) {
        if (success) {
            func();
        }
    };
};

sendUpdatePara = function(para, force=false) {
    let text = para.children('.p_input').val();
    let raw = para.attr('raw');
    if (text == raw && !force) {
        return;
    }
    var pid = para.attr('pid');
    var data = {room: aid, pid: pid, text: text};
    client.sendCommand('update_para', data, on_success(() => {
        storeChange(para, text);
    }));
};

sendInsertBefore = function(para) {
    let fold_id = para.attr('fold_id');
    if (fold_id) {
        var env = $(`[env_id=${fold_id}]`);
        var pid = env.first().attr('pid');
    } else {
        var pid = para.attr('pid');
    };
    let data = {room: aid, pid: pid};
    client.sendCommand('insert_before', data, on_success(() => {
        // activePrevPara();
        // sendMakeEditable();
    }));
};

sendInsertAfter = function(para) {
    let fold_id = para.attr('fold_id');
    if (fold_id) {
        var env = $(`[env_id=${fold_id}]`);
        var pid = env.last().attr('pid')
    } else {
        var pid = para.attr('pid');
    };
    let data = {room: aid, pid: pid};
    client.sendCommand('insert_after', data, on_success(() => {
        // console.log(active_para)
        // activeNextPara()
        // sendMakeEditable();
    }));
};

sendDeletePara = function(para) {
    let pid = para.attr('pid');
    let data = {room: aid, pid: pid};
    let next = getNextPara(para);
    if (next.length == 0) {
        next = getPrevPara(para);
    }
    client.sendCommand('delete_para', data, on_success(() => {
        if (next) {
            makeActive(next);
        }
    }));
};

// revertChange?

/// para editable

placeCursor = function(loc) {
    console.log('placeCursor:', loc);
    if (active_para && writeable) {
        var text = active_para.children('.p_input');
        text.focus();
        if (loc == 'begin') {
            text[0].setSelectionRange(0, 0);
        } else if (loc == 'end') {
            var tlen = text[0].value.length;
            text[0].setSelectionRange(tlen, tlen);
        }
    }
};

unPlaceCursor = function() {
    if (active_para && writeable) {
        var text = active_para.children('.p_input');
        text.blur();
    }
};

trueMakeEditable = function(rw=true, cursor='end') {
    editable = true;
    active_para.addClass('editable');

    var text = active_para.children('.p_input');
    resize(text[0]);
    if (rw) {
        text.prop('readonly', false);
        placeCursor(cursor);
        if (mobile) {
            $('#foot').hide();
        };
    }
    syntaxHL(active_para);

    client.schedCanary();
};

sendMakeEditable = function(cursor='end') {
    $('.para').removeClass('editable');
    $('.para').removeClass('copy_sel');
    if (active_para) {
        if (active_para.hasClass('folder')) {
            fold(active_para);
        }
        if (writeable) {
            var pid = active_para.attr('pid');
            var data = {pid: pid, room: aid};
            client.sendCommand('lock', data, function(response) {
                if (response) {
                    trueMakeEditable(true, cursor);
                };
            });
        } else {
            trueMakeEditable(false);
        }
    }
};

makeUnEditable = function(send=true) {
    $('.para.editable')
        .removeClass('editable')
        .css('min-height', '30px')
        .children('.p_input')
        .prop('readonly', true);

    $('#content').focus();

    cc = false;
    $('#cc_pop').remove();

    if (active_para && editable) {
        editable = false;
        if (writeable) {
            localChange(active_para, send);
        }
        if (mobile) {
            $('#foot').show();
        };
    }
};

/// para locking

/*
let lockout = null;

paraTimeOut = function() {
    clearTimeout(lockout);
    lockout = setTimeout(function () {
        makeUnEditable();
    }, 1000*60*3); // 3 mins
};
*/

lockParas = function(pids) {
    pids.forEach(function(pid) {
        var para = getPara(pid);
        para.addClass('locked');
    });
};

sendUnlockPara = function(pids) {
    var data = {pids: pids, room: aid};
    client.sendCommand('unlock', data, function(response) {
        // console.log(response);
    });
};

unlockParas = function(pids) {
    console.log('unlockParas');
    pids.forEach(function(pid) {
        var para = getPara(pid);
        para.removeClass('locked');
        if (para.hasClass('editable')) {
            makeUnEditable(false);
        }
    });
};

/// active para tracking

makeActive = function(para, scroll=true) {
    if (!para) {
        $('.para').removeClass('copy_sel');
    }
    makeUnEditable();
    $('.para').removeClass('active');
    if (active_para) {
        last_active = active_para;
    }
    active_para = para;
    if (active_para) {
        para.addClass('active');
        if (scroll) {
            ensureVisible(active_para);
        }
    }
};

getNextPara = function(para) {
    return (para || active_para).nextAll('.para:not(.folded)').first();
};

getPrevPara = function(para) {
    return (para || active_para).prevAll('.para:not(.folded)').first();
};

// next para
activeNextPara = function() {
    if (active_para) {
        var next = getNextPara();
        if (next.length > 0) {
            makeActive(next);
            return true;
        } else {
            return false;
        }
    }
};

activePrevPara = function() {
    if (active_para) {
        var prev = getPrevPara();
        if (prev.length > 0) {
            makeActive(prev);
            return true;
        } else {
            return false;
        }
    }
};

activeFirstPara = function() {
    var first = $('.para').first();
    if (first.length > 0) {
        makeActive(first);
    }
};

activeLastPara = function() {
    var last = $('.para').last();
    if (last.length > 0) {
        makeActive(last);
    }
};

editShift = function(dir='up') {
    var top, bot;
    if (writeable) {
        var input = active_para.children('.p_input')[0];
        var cpos = input.selectionStart;
        var tlen = input.value.length;
        top = (cpos == 0);
        bot = (cpos == tlen);
    } else {
        top = true;
        bot = true;
    }

    if (dir == 'up') {
        if (top) {
            if (activePrevPara()) {
                sendMakeEditable(cursor='end');
                return false;
            }
        }
    } else if (dir == 'down') {
        if (bot) {
            if (activeNextPara()) {
                sendMakeEditable(cursor='begin');
                return false;
            }
        }
    }
};

next_cc = function(dir) {
    let ccpop = $('#cc_pop')[0];
    if (dir == 'up') {
        f = ccpop.firstElementChild;
        ccpop.appendChild(f); //apend first to end
    } else if (dir == 'down') {
        l = ccpop.lastElementChild;
        ccpop.prepend(l); //append last child before first
    }
}

make_cc = function() {
    var cctxt = $('.cc_row').first().text();
    var input = active_para.children('.p_input');
    var raw = input.val();
    let open_ref = /@\[?([\w-\|\=^]+)?(\:)?([\w-\|\=^]+)?(?!.*\])(?!\s)/;
    let open_i_link = /\[\[([\w-\|\=^]+)?(?!.*\])(?!.*\s)/;
    if (cap = open_ref.exec(raw)) {
        if (cap[2] && !cap[1]){ // searching for ext page
           raw = raw.replace(open_ref, function() {
                return `@[${cctxt}:`;
            });
        } else if (cap[1] && cap[2]) {
            raw = raw.replace(open_ref, function() {
                return `@[${cap[1]}:${cctxt}]`;
            });

        } else {
            raw = raw.replace(open_ref, function() {
                return `@[${cctxt}]`;
            });
        }
    } else if (cap = open_i_link.exec(raw)) {
        raw = raw.replace(open_i_link, function() {
                return `[[${cctxt}]]`;
            });
    };
    input.val(raw);
    resize(input[0]);
    syntaxHL(active_para);
    cc = false;
    $('#cc_pop').remove();
};

//

getFoldParas = function(pid){
    para = getPara(pid);
    l = para.attr('head_level');
    if(para.attr('env')=='heading'){

        let fps = [para]
        let nx = Object.entries(para.nextAll('.para'))
        for (const [k, p] of nx) {
            if($(p).attr('head_level') <= l){
                break
            }
            if(!$(p).hasClass('folder')){
                fps.push(p);
            }
        }
        //what the fuck jquery, why (returns differnt object type in the two cases)
        return [$(fps), $(fps).first()[0]]
    } else{
        let fps = $(`[env_id=${pid}]`)
        return [$(fps), $(fps).first()]
    }
}

renderFold = function(){
    $('.para').not('.folder').each(function(){
        fl = parseInt($(this).attr('fold_level'));
        if(fl > 0){
            $(this).addClass('folded');
        } else {
            $(this).removeClass('folded');
        }
    });
    $('.folder').each(function(){
        let fl = parseInt($(this).attr('fold_level'));
        let pid = $(this).attr('fold_id');
        let p = getPara(pid);
        let flp = parseInt(p.attr('fold_level'));
        if(fl > 0 && flp==1){
            $(this).removeClass('folded');
        } else {
            $(this).addClass('folded');
        }
    });
}

fold = function(para, init=false){
    env_id = para.attr('env_id');
    fold_id = para.attr('fold_id');
    if(env_id){
        const foldParas = getFoldParas(env_id)
        foldParas[0].each(function(){
            const l = parseInt($(this).attr('fold_level'));
            $(this).attr('fold_level', l+1)
        });
        const fold = $(`[fold_id=${env_id}]`).first()
        const l = parseInt(fold.attr('fold_level'));
        fold.attr('fold_level', l+1)
        makeActive(fold)
        if(!init){
            folded.push(env_id);
            const foldcookie = JSON.stringify(folded)
            document.cookie = `folded=${foldcookie}; path=/; samesite=lax; secure`;
        }
    }else if(fold_id){
        const index = folded.indexOf(fold_id);
        if (index > -1) {
            folded.splice(index, 1);
        };
        const foldParas = getFoldParas(fold_id);
        foldParas[0].each(function(){
            const l = parseInt($(this).attr('fold_level'));
            $(this).attr('fold_level', l-1)
        });
        const fold = $(`[fold_id=${fold_id}]`).first();
        const l = parseInt(fold.attr('fold_level'));
        fold.attr('fold_level', l-1);
        makeActive(foldParas[1]);
        const foldcookie = JSON.stringify(folded);
        document.cookie = `folded=${foldcookie}; path=/; max-age=604800; samesite=lax; secure`;
    };
    renderFold()
};

unfold = function(){
    $('.para').each(function(){
            $(this).attr('fold_level', 0)
    });
    folded = [];
    const foldcookie = JSON.stringify(folded);
    document.cookie = `folded=${foldcookie}; path=/; max-age=604800; samesite=lax; secure`;
    renderFold()
}

//copy cell

copyCells = function(){
    cb=[];
    let copy_sel = $('.copy_sel, .active')
    copy_sel.each(function(){
        cb.push($(this).attr('pid'))
    })
    const cbcookie = JSON.stringify(cb)
    document.cookie = `cb=${cbcookie}; path=/; max-age=60; samesite=lax; secure`;
}

pasteCells = function(){
    let pid = active_para.attr('pid')
    let ccb = cooks('cb') || cb
    if(ccb&&pid){
        let data = {room:aid, pid:pid, cb:ccb};
        client.sendCommand('paste_cells', data, function(response) {
            console.log(response)
        });
    }
}

/// KEYBOARD NAV

$(document).keydown(function(e) {
    var key = e.key.toLowerCase();
    var ctrl = e.ctrlKey;
    var alt = e.altKey;
    var shift = e.shiftKey;

    if (ctrl && key == 'enter') {
        toggle_hist_map();
        return false;
    } else if (shift && ctrl && key == 'f') {
            unfold();
    } else if (ctrl && key == 's') {
        return false;
    }
    if (!active_para) { // if we are inactive
        if (key == 'enter') {
            var foc_para = last_active || $('.para').first();
            makeActive(foc_para);
        }
    } else if (active_para && !editable) {
        if (key == 'enter' || key == 'w') {
            sendMakeEditable();
            return false;
        }else if (key == 'arrowup') {
            if(shift){
                active_para.addClass('copy_sel')
            } else {
                $('.para').removeClass('copy_sel')
            }
            activePrevPara();
            return false;
        } else if (key == 'arrowdown') {
            if(shift){
                active_para.addClass('copy_sel')
            } else {
                $('.para').removeClass('copy_sel')
            }
            activeNextPara();
            return false;
        } else if (ctrl && key == 'home') {
            activeFirstPara();
        } else if (ctrl && key == 'end') {
            activeLastPara();
        } else if (ctrl && key == 'c') {
            copyCells();
        } else if (ctrl && key == 'v') {
            pasteCells();
        } else if (key == 'escape') {
            makeActive(null);
        } else if (shift && ctrl && key == 'f') {
            unfold();
        } else if (shift && key == 'f') {
            fold(active_para);
        }
        if (writeable) { // if we are active but not in edit mode
            if (key == 'a') {
                sendInsertBefore(active_para);
            } else if (key == 'b') {
                sendInsertAfter(active_para);
            } else if (shift && key == 'd') {
                sendDeletePara(active_para);
            }
        }
    } else if (active_para && editable) { // we are active and editable
        if (key == 'arrowup' || key == 'arrowleft') {
            if (cc) { // if there is an open command completion window
                next_cc('down');
                return false;
            } else {
                return editShift('up');
            }
        } else if (key == 'arrowdown' || key == 'arrowright') {
            if (cc) {
                next_cc('up');
                return false;
            } else {
                return editShift('down');
            }
        } else if (key == 'escape') {
            if (cc) {
                cc = false;
                $('#cc_pop').remove();
            } else {
                makeUnEditable();
            }
        } else if (!shift && key == 'enter') {
            if (cc) {
                make_cc();
                return false;
            }
        } else if (shift && key == 'enter') {
            makeUnEditable();
            sendInsertAfter(active_para);
            return false;
        }
    }
});

/// mouse interface

$(document).on('click', '.para', function(e) {
    var alt = e.altKey;
    var cmd = e.metaKey;
    if (alt) {
        var para = $(this);
        if (!para.hasClass('active')) {
            makeActive($(this));
        } else if (!editable) {
            sendMakeEditable();
        }
        return false;
    } else if (active_para && cmd){
        $(this).addClass('copy_sel');
        return false;
    }
});

$(document).on('click', '#bg', function(e) {
    var targ = event.target.id;
    var alt = e.altKey;
    if (targ == 'bg' || targ == 'content'){
    if(alt){
        makeActive(null);
    } else {
        $('.para').removeClass('copy_sel')
    }
    //return false;
    }
});

$(document).on('click', '.update', function() {
    var para = $(this).parents('.para');
    sendUpdatePara(para);
});

$(document).on('click', '.before', function() {
    var para = $(this).parents('.para');
    sendInsertBefore(para);
});

$(document).on('click', '.after', function() {
    var para = $(this).parents('.para');
    sendInsertAfter(para);
});

$(document).on('click', '.delete', function() {
    var para = $(this).parents('.para');
    sendDeletePara(para);
});

$(document).ready(function() {
    $('#content').focus();
});
