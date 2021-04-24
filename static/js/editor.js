////// UI ///////

// global state
var active_para = null; // current active para
var last_active = null; // to keep track of where cursor was
var editable = false; // are we focused on the active para
var writeable = !readonly; // can we actually modify contents

// hard coded options
var scrollSpeed = 100;
var scrollFudge = 100;

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

/// scrolling

ensureVisible = function(para) {
    let cont = para.parent();
    let scroll = cont.scrollTop();
    let height = cont.height();
    let cell_top = scroll + para.position().top;
    let cell_bot = cell_top + para.height();
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

/// rendering and storage

// store a change locally, if no change also unlock server side
localChange = function(para, send=true) {
    let text = para.children('.p_input').val();
    let raw = para.attr('raw');
    if (text != raw) {
        $(para).addClass('changed');
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
    let pid = para.attr('pid');
    let data = {room: aid, pid: pid};
    client.sendCommand('insert_before', data, on_success(() => {
        activePrevPara();
        sendMakeEditable();
    }));
};

sendInsertAfter = function(para) {
    let pid = para.attr('pid');
    let data = {room: aid, pid: pid};
    client.sendCommand('insert_after', data, on_success(() => {
        activeNextPara();
        sendMakeEditable();
    }));
};

sendDeletePara = function(para) {
    let pid = para.attr('pid');
    let data = {room: aid, pid: pid};
    let next = para.next('.para');
    if (next.length == 0) {
        next = para.prev('.para');
    }
    client.sendCommand('delete_para', data, on_success(() => {
        if (next) {
            makeActive(next);
        }
    }));
};

// revertChange?

/// para editable

placeCursor = function(begin=false) {
    if (active_para && writeable) {
        var text = active_para.children('.p_input');
        text.focus();
        if (begin) {
            text[0].setSelectionRange(0, 0);
        } else {
            var tlen = text[0].value.length
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

trueMakeEditable = function(rw=true) {
    editable = true;
    active_para.addClass('editable');

    var text = active_para.children('.p_input');
    resize(text[0]);
    if (rw) {
        text.prop('readonly', false);
        placeCursor();
        if(mobile){
            $('#foot').hide();
        };
    }
    syntaxHL(active_para);

    client.schedCanary();
};

sendMakeEditable = function() {
    $('.para').removeClass('editable');
    if (active_para) {
        if (writeable) {
            var pid = active_para.attr('pid');
            var data = {pid: pid, room: aid};
            client.sendCommand('lock', data, function(response) {
                if (response) {
                    trueMakeEditable();
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
        console.log(response);
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

// next para
activeNextPara = function() {
    if (active_para) {
        var next = active_para.next('.para');
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
        var prev = active_para.prev('.para');
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

editShift = function(para, up=true) {
    var top, bot;
    if (writeable) {
        var input = para.children('.p_input')[0];
        var cpos = input.selectionStart;
        var tlen = input.value.length;
        top = (cpos == 0);
        bot = (cpos == tlen);
    } else {
        top = true;
        bot = true;
    }

    if (up == true) {
        if (top) {
            if (activePrevPara()) {
                sendMakeEditable();
                placeCursor(begin=false);
                return false;
            }
        }
    } else {
        if (bot) {
            if (activeNextPara()) {
                sendMakeEditable();
                placeCursor();
                return false;
            }
        }
    }
};

next_cc = function(up=true) {
    let ccpop = $('#cc_pop')[0];
    if (up) {
        f = ccpop.firstElementChild;
        ccpop.appendChild(f); //apend first to end
    } else {
        l = ccpop.lastElementChild;
        ccpop.prepend(l); //append last child before first
    }
}

make_cc = function() {
    var cctxt = $('.cc_row').first().text();
    var input = active_para.children('.p_input');
    var raw = input.val();
    let open_ref = /@\[?([\w-\|\=^]+)?(\:)?([\w-\|\=^]+)?(?!.*\])(?!\s)/;
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
    }
    input.val(raw);
    resize(input[0]);
    syntaxHL(active_para);
    cc = false;
    $('#cc_pop').remove();
};

/// KEYBOARD NAV

$(document).keydown(function(e) {
    var key = e.key.toLowerCase();
    var ctrl = e.ctrlKey;
    var alt = e.altKey;
    var shift = e.shiftKey;

    if (ctrl && key == 'enter') {
        toggle_hist_map();
        return false;
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
        } else if (key == 'arrowup') {
            activePrevPara();
            return false;
        } else if (key == 'arrowdown') {
            activeNextPara();
            return false;
        } else if (ctrl && key == 'home') {
            activeFirstPara();
        } else if (ctrl && key == 'end') {
            activeLastPara();
        } else if (key == 'escape') {
            makeActive(null);
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
                next_cc(up=false);
                return false;
            } else {
                return editShift(active_para);
            }
        } else if (key == 'arrowdown' || key == 'arrowright') {
            if (cc) {
                next_cc(up=true);
                return false;
            } else {
                return editShift(active_para, up=false);
            }
        } else if (key == 'escape') {
            if (cc) {
                cc = false;
                $('#cc_pop').remove();
            } else {
                makeUnEditable();
                if (writeable) {
                    sendUpdatePara(active_para);
                }
            }
        } else if (!shift && key == 'enter') {
            if (cc) {
                make_cc();
                return false;
            }
        } else if (shift && key == 'enter') {
            makeUnEditable();
            if (writeable) {
                sendUpdatePara(active_para);
            }
            sendInsertAfter(active_para);
            return false;
        }
    }
});

/// mouse interface

$(document).on('click', '.para', function(e) {
    var alt = e.altKey;
    if (alt) {
        var para = $(this);
        if (!para.hasClass('active')) {
            makeActive($(this));
        } else if (!editable) {
            sendMakeEditable();
        }
        return false;
    }
});

$(document).on('click', '#bg', function(e) {
    var targ = event.target.id;
    var alt = e.altKey;
    if (alt && (targ == 'bg' || targ == 'content')) {
        makeUnEditable();
        makeActive(null);
        return false;
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
