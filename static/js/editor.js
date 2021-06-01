////// UI ///////

export {
    initEditor, resize, makeActive, lockParas, unlockParas,
    sendMakeEditable, sendUpdatePara
}

import { config, state } from './state.js'
import { ensureVisible, cooks } from './utils.js'
import { sendCommand, schedTimeout } from './client.js'
import { getPara, rawToRender, syntaxHL, fold } from './render.js'
import { updateRefHTML, toggleHistMap, ccNext, ccMake } from './article.js'

/// textarea manage

function resize(textarea) {
    textarea.style.height = 'auto';
    let h = (textarea.scrollHeight) + 'px';
    textarea.style.height = h;
    let para = $(textarea).parent('.para');
    para.css('min-height', h);
}

/// rendering and storage

// store a change locally, if no change also unlock server side
function localChange(para, send=true) {
    let text = para.children('.p_input').val();
    let raw = para.attr('raw');
    if (text != raw) {
        $(para).addClass('changed');
        sendUpdatePara(para);
    } else {
        if (send) {
            let pid = para.attr('pid');
            sendUnlockPara([pid]);
        }
    }
    rawToRender(para, false, text); // local changes only
}

// store change server side if any local changes
function storeChange(para, raw) {
    para.attr('raw', raw);
    updateRefHTML(para);
    $(para).removeClass('changed')
           .removeAttr('old_id');
}

/// server comms and callbacks

function on_success(func) {
    return function(success) {
        if (success) {
            func();
        }
    };
}

function sendUpdatePara(para, force=false) {
    let text = para.children('.p_input').val();
    let raw = para.attr('raw');
    if (text == raw && !force) {
        return;
    }
    let pid = para.attr('pid');
    let data = {aid: config.aid, pid: pid, text: text};
    sendCommand('update_para', data, on_success(() => {
        storeChange(para, text);
    }));
}

function sendInsertBefore(para) {
    let fold_pid = para.attr('fold_pid');
    let pid;
    if (fold_pid) {
        let env = $(`[env_pid=${fold_pid}]`);
        pid = env.first().attr('pid');
    } else {
        pid = para.attr('pid');
    };
    let data = {aid: config.aid, pid: pid};
    sendCommand('insert_before', data, on_success(() => {
        // activePrevPara();
        // sendMakeEditable();
    }));
}

function sendInsertAfter(para) {
    let fold_pid = para.attr('fold_pid');
    let pid;
    if (fold_pid) {
        let env = $(`[env_pid=${fold_pid}]`);
        pid = env.last().attr('pid')
    } else {
        pid = para.attr('pid');
    };
    let data = {aid: config.aid, pid: pid};
    sendCommand('insert_after', data, on_success(() => {
        // console.log(state.active_para);
        // activeNextPara();
        // sendMakeEditable();
    }));
}

function sendDeletePara(para) {
    let pid = para.attr('pid');
    let data = {aid: config.aid, pid: pid};
    let next = getNextPara(para);
    if (next.length == 0) {
        next = getPrevPara(para);
    }
    sendCommand('delete_para', data, on_success(() => {
        if (next) {
            makeActive(next);
        }
    }));
}

// revertChange?

/// para editable

function placeCursor(loc) {
    console.log('placeCursor:', loc);
    if (state.active_para && state.writeable) {
        let text = state.active_para.children('.p_input');
        text.focus();
        if (loc == 'begin') {
            text[0].setSelectionRange(0, 0);
        } else if (loc == 'end') {
            let tlen = text[0].value.length;
            text[0].setSelectionRange(tlen, tlen);
        }
    }
}

function unPlaceCursor() {
    if (state.active_para && state.writeable) {
        let text = state.active_para.children('.p_input');
        text.blur();
    }
}

function trueMakeEditable(rw=true, cursor='end') {
    state.editable = true;
    state.active_para.addClass('editable');

    let text = state.active_para.children('.p_input');
    resize(text[0]);

    if (rw) {
        text.prop('readonly', false);
        placeCursor(cursor);
        if (mobile) {
            $('#foot').hide();
        };
    }

    syntaxHL(state.active_para);

    schedTimeout();
}

function sendMakeEditable(cursor='end') {
    $('.para').removeClass('editable');
    $('.para').removeClass('copy_sel');
    if (state.active_para) {
        if (state.active_para.hasClass('folder')) {
            fold(state.active_para);
        }
        if (state.writeable) {
            let pid = state.active_para.attr('pid');
            let data = {pid: pid, aid: config.aid};
            sendCommand('lock', data, function(response) {
                if (response) {
                    trueMakeEditable(true, cursor);
                };
            });
        } else {
            trueMakeEditable(false);
        }
    }
}

function makeUnEditable(send=true) {
    $('.para.editable')
        .removeClass('editable')
        .css('min-height', '30px')
        .children('.p_input')
        .prop('readonly', true);

    $('#content').focus();

    state.cc = false;
    $('#cc_pop').remove();

    if (state.active_para && state.editable) {
        state.editable = false;
        if (state.writeable) {
            localChange(state.active_para, send);
        }
        if (mobile) {
            $('#foot').show();
        };
    }
}

/// para locking

function lockParas(pids) {
    pids.forEach(function(pid) {
        let para = getPara(pid);
        para.addClass('locked');
    });
}

function sendUnlockPara(pids) {
    let data = {aid: config.aid, pids: pids};
    sendCommand('unlock', data, function(response) {
        // console.log(response);
    });
}

function unlockParas(pids) {
    console.log('unlockParas');
    pids.forEach(function(pid) {
        let para = getPara(pid);
        para.removeClass('locked');
        if (para.hasClass('editable')) {
            makeUnEditable(false);
        }
    });
}

/// active para tracking

function makeActive(para, scroll=true) {
    if (!para) {
        $('.para').removeClass('copy_sel');
    }
    makeUnEditable();
    $('.para').removeClass('active');
    if (state.active_para) {
        state.last_active = state.active_para;
    }
    state.active_para = para;
    if (state.active_para) {
        para.addClass('active');
        if (scroll) {
            ensureVisible(state.active_para);
        }
    }
}

function getNextPara(para) {
    return (para || state.active_para).nextAll('.para:not(.folded)').first();
}

function getPrevPara(para) {
    return (para || state.active_para).prevAll('.para:not(.folded)').first();
}

// next para
function activeNextPara() {
    if (state.active_para) {
        let next = getNextPara();
        if (next.length > 0) {
            makeActive(next);
            return true;
        } else {
            return false;
        }
    }
}

function activePrevPara() {
    if (state.active_para) {
        let prev = getPrevPara();
        if (prev.length > 0) {
            makeActive(prev);
            return true;
        } else {
            return false;
        }
    }
}

function activeFirstPara() {
    let first = $('.para').first();
    if (first.length > 0) {
        makeActive(first);
    }
}

function activeLastPara() {
    let last = $('.para').last();
    if (last.length > 0) {
        makeActive(last);
    }
}

function editShift(dir='up') {
    let top, bot;
    if (state.writeable) {
        let input = state.active_para.children('.p_input')[0];
        let cpos = input.selectionStart;
        let tlen = input.value.length;
        top = (cpos == 0);
        bot = (cpos == tlen);
    } else {
        top = true;
        bot = true;
    }

    if (dir == 'up') {
        if (top) {
            if (activePrevPara()) {
                sendMakeEditable('end');
                return false;
            }
        }
    } else if (dir == 'down') {
        if (bot) {
            if (activeNextPara()) {
                sendMakeEditable('begin');
                return false;
            }
        }
    }
}

// copy cell

function copyCells() {
    state.cb = [];
    $('.copy_sel, .active').each(function() {
        let para = $(this);
        let pid = para.attr('pid');
        state.cb.push(pid);
    })
    const cbcookie = JSON.stringify(state.cb);
    document.cookie = `cb=${cbcookie}; path=/; max-age=60; samesite=lax; secure`;
}

function pasteCells() {
    let pid = state.active_para.attr('pid');
    let ccb = cooks('cb') || state.cb;
    if (ccb && pid) {
        let data = {aid: config.aid, pid: pid, cb: ccb};
        sendCommand('paste_cells', data, function(response) {
            console.log(response);
        });
    }
}

/// initialization

function initEditor() {
    // resize text area on input (eliminate scroll)
    $(document).on('input focus', 'textarea', function() {
        resize(this);
    });

    // keyboard interface

    $(document).keydown(function(e) {
        let key = e.key.toLowerCase();
        let ctrl = e.ctrlKey;
        let alt = e.altKey;
        let shift = e.shiftKey;

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
        if (!state.active_para) { // if we are inactive
            if (key == 'enter') {
                let foc_para = state.last_active || $('.para').first();
                makeActive(foc_para);
            }
        } else if (state.active_para && !state.editable) {
            if (key == 'enter' || key == 'w') {
                sendMakeEditable();
                return false;
            }else if (key == 'arrowup') {
                if(shift){
                    state.active_para.addClass('copy_sel')
                } else {
                    $('.para').removeClass('copy_sel')
                }
                activePrevPara();
                return false;
            } else if (key == 'arrowdown') {
                if(shift){
                    state.active_para.addClass('copy_sel')
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
                fold(state.active_para);
            }
            if (state.writeable) { // if we are active but not in edit mode
                if (key == 'a') {
                    sendInsertBefore(state.active_para);
                } else if (key == 'b') {
                    sendInsertAfter(state.active_para);
                } else if (shift && key == 'd') {
                    sendDeletePara(state.active_para);
                }
            }
        } else if (state.active_para && state.editable) { // we are active and editable
            if (key == 'arrowup' || key == 'arrowleft') {
                if (state.cc) { // if there is an open command completion window
                    ccNext('down');
                    return false;
                } else {
                    return editShift('up');
                }
            } else if (key == 'arrowdown' || key == 'arrowright') {
                if (state.cc) {
                    ccNext('up');
                    return false;
                } else {
                    return editShift('down');
                }
            } else if (key == 'escape') {
                if (state.cc) {
                    state.cc = false;
                    $('#cc_pop').remove();
                } else {
                    makeUnEditable();
                }
            } else if (!shift && key == 'enter') {
                if (state.cc) {
                    ccMake();
                    return false;
                }
            } else if (shift && key == 'enter') {
                makeUnEditable();
                sendInsertAfter(state.active_para);
                return false;
            }
        }
    });

    /// mouse interface

    $(document).on('click', '.para', function(e) {
        let alt = e.altKey || mobile;
        let cmd = e.metaKey;
        if (alt) {
            let para = $(this);
            if (!para.hasClass('active')) {
                makeActive($(this));
            } else if (!state.editable) {
                sendMakeEditable();
            }
            return false;
        } else if (state.active_para && cmd) {
            $(this).addClass('copy_sel');
            return false;
        }
    });

    $(document).on('click', '#bg', function(e) {
        let targ = event.target.id;
        let alt = e.altKey || mobile;
        if (targ == 'bg' || targ == 'content') {
            if (alt) {
                makeActive(null);
            } else {
                $('.para').removeClass('copy_sel')
            }
        }
    });

    $(document).on('click', '.update', function() {
        let para = $(this).parents('.para');
        sendUpdatePara(para);
    });

    $(document).on('click', '.before', function() {
        let para = $(this).parents('.para');
        sendInsertBefore(para);
    });

    $(document).on('click', '.after', function() {
        let para = $(this).parents('.para');
        sendInsertAfter(para);
    });

    $(document).on('click', '.delete', function() {
        let para = $(this).parents('.para');
        sendDeletePara(para);
    });

    $('#content').focus();
}
