////// UI ///////

// global state
active_para = null; // current active para
last_active = null; // to keep track of where cursor was
editable = false; // are we focused on the active para
writeable = !readonly; // can we actually modify contents
changed = {}; // list of paras that have been changed

// hard coded options
scrollSpeed = 100;
scrollFudge = 100;

/// textarea manage

resize = function(textarea) {
    textarea.style.height = 'auto';
    h = (textarea.scrollHeight) + 'px'
    textarea.style.height = h;
    para = $(textarea).parent('.para');
    para.css('min-height', h);
};

// resize text area on input (eliminate scroll)
$(document).on('input focus', 'textarea', function() {
    resize(this);
});

/// scrolling

ensureVisible = function(para) {
    var cont = para.parent();
    var scroll = cont.scrollTop();
    var height = cont.height();

    var cell_top = scroll + para.position().top;
    var cell_bot = cell_top + para.height();

    var page_top = scroll;
    var page_bot = page_top + height;

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
    var text = para.children('.p_input').val();
    var raw = para.attr('raw');
    var pid = para.attr('pid');
    if (text != raw) {
        changed[pid] = text;
        $(para).addClass('changed');
    } else {
        if (send) {
            sendUnlockPara([pid]);
        }
    }
    rawToRender(para, false, text); // local changes only
};

// store change server side if any local changes
storeChange = function(para) {
    var pid = para.attr('pid');
    if (pid in changed) {
        var raw = changed[pid];
        para.attr('raw', raw);
        updateRefHTML(para);
        delete changed[pid];
        $(para).removeClass('changed')
               .removeAttr('old_id');
    }
};

/// server comms and callbacks

on_success = function(func) {
    return function(success) {
        if (success) {
            func();
        }
    };
};

sendUpdatePara = function(para) {
    var pid = para.attr('pid');
    var raw = para.children('.p_input').val();
    var data = {room: aid, pid: pid, text: raw};
    client.sendCommand('update_para', data, on_success(() => {
        storeChange(para);
    }));
};

sendUpdateBulk = function() {
    if (Object.keys(changed).length > 0) {
        var data = {room: aid, paras: changed};
        client.sendCommand('update_bulk', data, on_success(() => {
            Object.keys(changed).map(function(pid) {
                var para = getPara(pid);
                storeChange(para);
            });
        }));
    }
};

sendInsertBefore = function(para) {
    var pid = para.attr('pid');
    var data = {room: aid, pid: pid};
    client.sendCommand('insert_before', data, on_success(() => {
        activePrevPara();
        sendMakeEditable();
    }));
};

sendInsertAfter = function(para) {
    var pid = para.attr('pid');
    var data = {room: aid, pid: pid};
    client.sendCommand('insert_after', data, on_success(() => {
        activeNextPara();
        sendMakeEditable();
    }));
};

sendDeletePara = function(para) {
    var pid = para.attr('pid');
    var data = {room: aid, pid: pid};
    var next = para.next('.para');
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

placeCursor = function(begin=true) {
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

    if (active_para && editable) {
        editable = false;
        if (writeable) {
            localChange(active_para, send);
        }
        if(mobile){
            $('#foot').show();
        };
    }
};

/// para locking

let lockout = null;

/*
paraTimeOut = function(){
    clearTimeout(lockout)
    lockout = setTimeout(function () {
        makeUnEditable();
        data = {room: aid, paras: changed};
        client.sendCommand('update_bulk', data, function(success) {
            Object.keys(changed).map(function(pid) {
                var para = getPara(pid);
                storeChange(para);
            });
        });
    }, 1000*60*3); // 3 mins
};
*/

lockParas = function(pids) {
    pids.forEach(function(pid){
        var para = getPara(pid);
        para.addClass('locked');
    });
};

sendUnlockPara = function(pids) {
    var data = {};
    data.pids = pids;
    data.room = aid;
    client.sendCommand('unlock', data, function(response){
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

/// KEYBOARD NAV

keymap = {
    'enter': false,
    'shift': false,
    'control': false,
    'escape': false,
    'arrowleft': false,
    'arrowup': false,
    'arrowright': false,
    'arrowdown': false,
    'home': false,
    'end': false,
    'a': false,
    'b': false,
    'd': false,
    's': false,
    'w': false,
};

$(document).keydown(function(e) {
    var key = e.key.toLowerCase();
    console.log('keydown:', key, e.target);
    if (key in keymap) {
        keymap[key] = true;
        if (keymap['control'] && keymap['enter']) {
            toggle_hist_map();
            return false;
        } else if (keymap['control'] && keymap['s']) {
            if (writeable) {
                makeUnEditable();
                sendUpdateBulk();
            }
            return false;
        }
        if (!active_para) { // if we are inactive
            if (keymap['enter']) {
                var foc_para = last_active || $('.para').first();
                makeActive(foc_para);
            }
        } else if (active_para && !editable) {
            if (keymap['enter'] || keymap['w']) {
                sendMakeEditable();
                return false;
            } else if (keymap['arrowup']) {
                activePrevPara();
                return false;
            } else if (keymap['arrowdown']) {
                activeNextPara();
                return false;
            } else if (keymap['control'] && keymap['home']) {
                activeFirstPara();
            } else if (keymap['control'] && keymap['end']) {
                activeLastPara();
            } else if (keymap['escape']) {
                makeActive(null);
            }
            if (writeable) { // if we are active but not in edit mode
                if (keymap['a']) {
                    sendInsertBefore(active_para);
                } else if (keymap['b']) {
                    sendInsertAfter(active_para);
                } else if (keymap['shift'] && keymap['d']) {
                    sendDeletePara(active_para);
                }
            }
        } else if (active_para && editable) { // we are active and editable
            if (keymap['arrowup'] || keymap['arrowleft']) {
                return editShift(active_para);
            } else if (keymap['arrowdown'] || keymap['arrowright']) {
                return editShift(active_para, up=false);
            } else if (keymap['escape']) {
                makeUnEditable();
            } else if (keymap['shift'] && keymap['enter']) {
                makeUnEditable();
                if (writeable) {
                    sendUpdatePara(active_para);
                }
                return false;
            }
        }
    }
})

$(document).keyup(function(e) {
    var key = e.key.toLowerCase();
    console.log('keyup:', key);
    if (key in keymap) {
        keymap[key] = false;
    };
});

/// mouse interface

// click to make active // double click to make editable
$(document).on('click', '.para', function() {
    var para = $(this);
    if (!para.hasClass('active')) {
        makeActive($(this));
    } else if (!editable) {
        sendMakeEditable();
    };
});

// click background to escape
$(document).on('click', '#bg', function() {
    if (event.target.id=='bg' || event.target.id=='content') {
        makeUnEditable();
        makeActive(null);
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
