////// UI ///////

// resize text area on input (eliminate scroll)
$(document).on('input', 'textarea', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// global state
active_para = null; // state variable --- takes a para
last_active = null; // state var, to keep track of where cursor was
editable = false; // state variable, are we focused on the active para
changed = {}; // state vara, list of paras that have been changed

makeActive = function(para) {
    makeUnEditable();
    $('.para').removeClass('active');
    if (active_para) {
        last_active = active_para;
    }
    active_para = para;
    if (active_para) {
        para.addClass('active');
    }
};

localChange = function(para) {
    var text = para.children('.p_input').val();
    var raw = para.attr('raw');
    if (text != raw) {
        var pid = para.attr('pid');
        changed[pid] = text;
        $(para).addClass('changed');
    }
    dataToText(para, text); // local changes only
};

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

// revertChange?

placeCursor = function(begin=true) {
    if (active_para) {
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
    if (active_para) {
        var text = active_para.children('.p_input');
        text.blur();
    }
};

editShift = function(para, up=true) {
    var input = para.children('.p_input')[0];
    var cpos = input.selectionStart;
    if (up == true) {
        if (cpos == 0) {
            activePrevPara();
            makeEditable();
            placeCursor(begin=false);
            return false;
        }
    } else {
        var tlen = input.value.length;
        if (cpos == tlen) {
            activeNextPara();
            makeEditable();
            placeCursor();
            return false;
        }
    }
};

makeEditable = function() {
    $('.para').removeClass('editable');
    editable = true;
    if (active_para) {
        active_para.addClass('editable');
    }
};

makeUnEditable = function() {
    $('.para').removeClass('editable');
    if (editable && active_para) {
        unPlaceCursor();
        editable = false;
        localChange(active_para);
    }
};

// click to make active // double click to make editable
$(document).on('click', '.para', function() {
    var para = $(this);
    if (!para.hasClass('active')) {
        makeActive($(this));
    } else {
        makeEditable();
    }
});

//click background to escape
$(document).on('click', '#bg', function() {
    if (event.target.id=='bg' || event.target.id=='content') {
        makeUnEditable();
        makeActive(null);
    }
});

// focus to make editable
$(document).on('focus', '.p_input', function() {
    makeEditable();
});

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

/// KEYBOARD NAV

keymap = {
    'enter': false,
    'shift': false,
    'ctrl': false,
    'esc': false,
    'left': false,
    'up': false,
    'right': false,
    'down': false,
    'a': false,
    'b': false,
    'd': false,
    's': false,
    'w': false,
};

keyname = {
    13: 'enter',
    16: 'shift',
    17: 'ctrl',
    27: 'esc',
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    65: 'a',
    66: 'b',
    68: 'd',
    83: 's',
    87: 'w',
}

$(document).keydown(function(e) {
    if (e.keyCode in keyname) {
        keymap[keyname[e.keyCode]] = true;
        if (keymap['ctrl'] && keymap['s']) {
            makeUnEditable();
            if (Object.keys(changed).length > 0) {
                client.sendCommand('update_bulk', changed, function(success) {
                    Object.keys(changed).map(function(pid) {
                        var para = getPara(pid);
                        storeChange(para);
                    });
                });
            }
            return false;
        }
        if (!active_para) { // if we are inactive
            if (keymap['enter']) {
                var foc_para = last_active || $('.para').first();
                makeActive(foc_para);
            }
        } else if (active_para && !editable) { // if we are active but not in edit mode
            if (keymap['enter'] || keymap['w']) {
                makeEditable();
                placeCursor();
                return false;
            } else if (keymap['up']) {
                activePrevPara();
            } else if (keymap['down']) {
                activeNextPara();
            } else if (keymap['esc']) {
                makeActive(null);
            } else if (keymap['a']) {
                var pid = active_para.attr('pid');
                client.sendCommand('insert_before', {'pid': pid}, function(success) {
                    if (success) {
                        activePrevPara();
                        makeEditable();
                        placeCursor();
                    }
                });
            } else if (keymap['b']) {
                var pid = active_para.attr('pid');
                client.sendCommand('insert_after', {'pid': pid}, function(success) {
                    if (success) {
                        activeNextPara();
                        makeEditable();
                        placeCursor();
                    }
                });
            } else if (keymap['shift'] && keymap['d']) {
                var pid = active_para.attr('pid');
                if (!activeNextPara()) {
                    if (!activePrevPara()) {
                        return false;
                    }
                }
                client.sendCommand('delete_para', {'pid': pid});
            }
        } else if (active_para && editable) { // we are active and editable
            if (keymap['esc']) {
                makeUnEditable();
            } else if (keymap['up'] || keymap['left']) {
                return editShift(active_para);
            } else if (keymap['down'] || keymap['right']) {
                return editShift(active_para, up=false);
            } else if (keymap['shift'] && keymap['enter']) {
                makeUnEditable();
                var para = active_para;
                var pid = para.attr('pid');
                var raw = para.children('.p_input').val();
                client.sendCommand('update_para', {'pid': pid, 'text': raw}, function(success) {
                    if (success) {
                        storeChange(para);
                    }
                });
                return false;
            }
        }
    }
})

$(document).keyup(function(e) {
    if (e.keyCode in keyname) {
        keymap[keyname[e.keyCode]] = false;
    }
});

/// Button Nav

$(document).on('click', '.update', function() {
    var para = $(this).parents('.para');
    updateFromTextArea(para);
});

$(document).on('click', '.before', function() {
    var pid = $(this).parents('.para').attr('pid');
    client.sendCommand('insert_before', {'pid': pid});
});

$(document).on('click', '.after', function() {
    var pid = $(this).parents('.para').attr('pid');
    client.sendCommand('insert_after', {'pid': pid});
});

$(document).on('click', '.delete', function() {
    var pid = $(this).parents('.para').attr('pid');
    if (!activeNextPara()) {
        if (!activePrevPara()) {
            return false;
            }
        }
    client.sendCommand('delete_para', {'pid': pid});
});
