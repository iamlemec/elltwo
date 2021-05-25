////// UI ///////

// global state
var active_para = null; // current active para
var last_active = null; // to keep track of where cursor was
var editable = false; // are we focused on the active para
var writeable = !readonly; // can we actually modify contents (depends on readonly and history mode)
var cb = []; // clipboard for cell copy

/// textarea manage

resize = function(textarea) {
    textarea.style.height = 'auto';
    let h = (textarea.scrollHeight) + 'px';
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
    var data = {aid: aid, pid: pid, text: text};
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
    let data = {aid: aid, pid: pid};
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
    let data = {aid: aid, pid: pid};
    client.sendCommand('insert_after', data, on_success(() => {
        // console.log(active_para)
        // activeNextPara()
        // sendMakeEditable();
    }));
};

sendDeletePara = function(para) {
    let pid = para.attr('pid');
    let data = {aid: aid, pid: pid};
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

    client.schedTimeout();
};

sendMakeEditable = function(cursor='end') {
    $('.para').removeClass('editable');
    $('.para').removeClass('copy_sel');
    if (active_para) {
        if (active_para.hasClass('folder')) {
            fold(active_para);
        }
        if (writeable) {
            let pid = active_para.attr('pid');
            let data = {pid: pid, aid: aid};
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
    var data = {aid: aid, pids: pids};
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

// copy cell

copyCells = function() {
    cb = [];
    $('.copy_sel, .active').each(function() {
        cb.push($(this).attr('pid'));
    })
    const cbcookie = JSON.stringify(cb);
    document.cookie = `cb=${cbcookie}; path=/; max-age=60; samesite=lax; secure`;
};

pasteCells = function() {
    let pid = active_para.attr('pid');
    let ccb = cooks('cb') || cb;
    if (ccb && pid) {
        let data = {aid: aid, pid: pid, cb: ccb};
        client.sendCommand('paste_cells', data, function(response) {
            console.log(response);
        });
    }
};

/// KEYBOARD NAV

$(document).keydown(function(e) {
    var key = e.key.toLowerCase();
    var ctrl = e.ctrlKey;
    var alt = e.altKey;
    var shift = e.shiftKey;

    if (ctrl && key == 'enter') {
        toggleHistMap();
        return false;
    } else if (shift && ctrl && key == 'f') {
        unfold();
    } else if (ctrl && key == 's') {
        return false;
    }
    if (key == '§') {
        toggleSidebar();
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
    var alt = e.altKey || mobile;
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
    var alt = e.altKey || mobile;
    if (targ == 'bg' || targ == 'content') {
        if (alt) {
            makeActive(null);
        } else {
            $('.para').removeClass('copy_sel')
        }
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
