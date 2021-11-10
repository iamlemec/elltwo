////// UI ///////

export {
    initEditor, stateEditor, eventEditor, resize, makeActive, lockParas,
    unlockParas, sendMakeEditable, sendUpdatePara, storeChange, placeCursor,
    fold, makeUnEditable, 
}

import { config, state, cache } from './state.js'
import {
    ensureVisible, cooks, setCookie, getPara, attrArray, noop, on_success, flash, smallable_butt
} from './utils.js'
import { sendCommand, schedTimeout } from './client.js'
import {
    rawToRender, rawToTextarea, envClasses, syntaxHL, getFoldLevel, renderFold
} from './render.js'
import {
    insertParaRaw, insertPara, deleteParas, updateRefs, toggleHistMap,
    toggleSidebar, ccNext, ccMake, textWrap
} from './article.js'
import { toggleHelp } from './help.js'

/// initialization

let s_butts = {
    '#r_text': 'Revert',
    '#e_text': 'Export',
    '#h_text': 'History',
}

function initEditor() {
    smallable_butt(s_butts);
}

function stateEditor() {
}

function eventEditor() {
    // resize text area on input (eliminate scroll)
    $(document).on('input focus', 'textarea', function() {
        resize(this);
    });

    window.onresize = () => {
        if (state.rawtext) {
            let inp = state.active_para.children('.p_input');
            resize(inp[0]);
        }
        smallable_butt(s_butts);
    };

    // keyboard interface
    $(document).keydown(function(e) {
        let key = e.key.toLowerCase();
        let ctrl = e.ctrlKey;
        let alt = e.altKey;
        let meta = e.metaKey;
        let shift = e.shiftKey;

        let wraps = {'i': ['*','*'],
                     'b': ['**','**'],
                     'm': ['$','$'],
                     '`': ['`','`'],
                     'n': ['^[', ']']};

        if (ctrl && key == 'enter') {
            toggleHistMap();
            return false;
        } else if (shift && ctrl && key == 'f') {
            unfold();
        } else if (ctrl && key == 's') {
            return false;
        } else if (key == '§' || (ctrl && key == '`')) {
            toggleSidebar();
            return false;
        } else if (key == 'f1') {
            toggleHelp();
            return false;
        } else if (key == 'escape') {
            if (state.help_show) {
                toggleHelp();
                return false;
            }
        }

        if (!(state.rawtext && state.writeable) && !meta && !ctrl) {
            if (key == '-') {
                $('#ssv_check').click();
                return false;
            } else if (!state.readonly && key == '=') { // permission to edit
                $('#edit_check').click();
                return false;
            }
        }

        if (!state.active_para) { // if we are inactive
            if (key == 'enter') {
                let foc_para = state.last_active || $('.para').first();
                makeActive(foc_para);
                return false;
            }
        } else if (state.active_para && !state.rawtext) {
            if (key == 'enter') {
                sendMakeEditable();
                return false;
            } else if (key == 'arrowup') {
                return !activePrevPara(shift);
            } else if (key == 'arrowdown') {
                return !activeNextPara(shift);
            } else if (ctrl && key == 'home') {
                activeFirstPara(); // keep native home scroll
            } else if (ctrl && key == 'end') {
                activeLastPara(); // keep native end scroll
            } else if (ctrl && key == 'c') {
                copyParas();
                return false;
            } else if (key == 'escape') {
                makeActive(null);
                return false;
            } else if (shift && key == 'f') {
                fold(state.active_para);
                return false;
            }
            if (state.writeable) { // if we are active but not in edit mode
                if (key == 'a') {
                    sendInsertPara(state.active_para, false);
                    return false;
                } else if (key == 'b') {
                    sendInsertPara(state.active_para, true);
                    return false;
                } else if (ctrl && key == 'v') {
                    pasteParas();
                    return false;
                } else if (shift && key == 'd') {
                    let sel = getSelection();
                    sendDeleteParas(sel);
                    return false;
                }
            }
        } else if (state.active_para && state.rawtext) { // we are active and rawtext
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
                return false;
            } else if (!shift && key == 'enter') {
                if (state.cc) {
                    ccMake();
                    return false;
                }
            } else if (shift && key == 'enter') {
                if (state.cc) {
                    ccMake(null,true);
                    return false;
                }
                makeUnEditable();
                sendInsertPara(state.active_para, true);
                return false;
            } else if ((ctrl || meta) && key in wraps) {
                let cur = [e.target.selectionStart, e.target.selectionEnd];
                textWrap(state.active_para, cur, wraps[key]);
                return false;
            } else if ((ctrl || meta) && key == '\\') {
                if (e.target.selectionStart == e.target.selectionEnd) {
                    splitParas(e.target.selectionStart);
                }
                return false;
            }
        }
    });

    /// mouse interface

    $(document).on('click', '.para', function(e) {
        // we should have a real event
        if (!(state.edit_mode || e.altKey || config.mobile)) {
            return;
        }

        // if link, follow it
        if (event.target.href !== undefined) {
            return;
        }

        // handle readonly selection
        let sel = window.getSelection();
        if (sel.baseNode != sel.extentNode || sel.baseOffset != sel.extentOffset) {
            return;
        }

        // handle textarea selection
        let cur = (event.target.selectionStart !== undefined)
            ? [event.target.selectionStart, event.target.selectionEnd]
            : 'end'; // returns undefined if not a textarea
        if (cur != 'end' && cur[0] != cur[1]) {
            return;
        }

        // get situation details
        let para = $(this);
        let act = para.hasClass('active');

        // step up one level
        if (state.ssv_mode) {
            if (!act) {
                makeActive(para);
            }
            if (!state.rawtext) {
                sendMakeEditable(cur);
            }
        } else {
            if (!act) {
                makeActive(para);
            } else if (!state.rawtext) {
                sendMakeEditable(cur);
            }
        }
    });

    $(document).on('mouseup', '#bg', function(e) {
        let targ = event.target.id;
        if (targ == 'bg' || targ == 'content') {
            makeActive(null);
        }
    });

    $(document).on('click', '.controlZone', function() {
        makeActive(null);
        return false;
    });

    $(document).on('click', '.before', function() {
        let para = $(this).parents('.para');
        console.log('before', para);
        sendInsertPara(para, false);
        return false;
    });

    $(document).on('click', '.after', function() {
        let para = $(this).parents('.para');
        sendInsertPara(para, true);
        return false;
    });

    $(document).on('click', '.delete', function() {
        let para = $(this).parents('.para');
        sendDeleteParas(para);
        return false;
    });

    $(document).on('click', '.cc_row', function() {
        let cctxt = $(this).attr('ref');
        let l = ccMake(cctxt);
        let input = state.active_para.children('.p_input');
        input.focus();
        input[0].setSelectionRange(l, l);
        return false
    });

    $('#content').focus();
}

/// textarea manage

function resize(textarea) {
    textarea.style.height = 'auto';
    let h = (textarea.scrollHeight) + 'px';
    textarea.style.height = h;
    let para = $(textarea).parent('.para');
    para.css('min-height', h);
    // para.children('.p_input_view').css('min-height', h);
}

/// rendering and storage

// store a change locally or server side, if no change also unlock server side
function storeChange(para, unlock=true) {
    // get old and new text
    let text = para.children('.p_input').val();
    let raw = para.attr('raw');

    // store old env and render
    rawToRender(para, false, true, text); // local changes only

    // update server as needed
    if (text != raw) {
        $(para).addClass('changed');
        sendUpdatePara(para, text);
    } else {
        // false in case of timeout (unlocked on server)
        if (unlock) {
            let pid = para.attr('pid');
            sendUnlockPara(pid);
        }
    }
}

// apply change locally (from server side)
function applyChange(para, raw) {
    para.attr('raw', raw);
    updateRefs(para);
    para.removeClass('changed');
}

/// server comms and callbacks

function sendUpdatePara(para, text) {
    let pid = para.attr('pid');
    let data = {aid: config.aid, pid: pid, text: text};
    sendCommand('update_para', data, on_success(() => {
        applyChange(para, text);
    }));
}

function sendInsertPara(para, after=true, edit=true, raw='', cur='end') {
    let fold_pid = para.attr('fold_pid');
    let head;
    if (fold_pid) {
        let env = $(`[env_pid=${fold_pid}]`);
        head = after ? env.last() : env.first();
    } else {
        head = para;
    }
    let pid = head.attr('pid');
    let data = {aid: config.aid, pid: pid, after: after, edit: edit, text: raw};
    sendCommand('insert_para', data, (new_pid) => {
        if (new_pid !== undefined) {
            let new_para = insertParaRaw(pid, new_pid, raw, after);
            makeActive(new_para);
            if (edit) {
                trueMakeEditable(true, cur);
            } else {
                rawToRender(new_para);
            }
        }
    });
}

function sendDeleteParas(paras) {
    let pids = attrArray(paras, 'pid');
    let data = {aid: config.aid, pids: pids};
    let next = getNextPara(paras.last());
    if (next.length == 0) {
        next = getPrevPara(paras.first());
    }
    sendCommand('delete_paras', data, on_success(() => {
        if (next) {
            makeActive(next);
        }
        deleteParas(pids);
    }));
}

// revertChange?

/// para rawtext

function placeCursor(loc) {
    if (state.active_para && state.writeable) {
        let text = state.active_para.children('.p_input');
        text.focus();
        if (loc == 'begin') {
            text[0].setSelectionRange(0, 0);
        } else if (loc == 'end') {
            let tlen = text[0].value.length;
            text[0].setSelectionRange(tlen, tlen);
        } else {
            text[0].setSelectionRange(loc[0], loc[1]);
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
    state.rawtext = true;
    state.active_para.addClass('rawtext');
    $('#bg').addClass('rawtext');

    let text = state.active_para.children('.p_input');
    resize(text[0]);

    if (rw) {
        text.prop('readonly', false);
        placeCursor(cursor);
        schedTimeout();
    }

    syntaxHL(state.active_para);
}

function sendMakeEditable(cursor='end') {
    $('.para').removeClass('rawtext');
    $('.para').removeClass('copy_sel');
    if (state.active_para) {
        if (state.active_para.hasClass('folder')) {
            fold(state.active_para);
        }
        if (state.writeable) {
            let pid = state.active_para.attr('pid');
            let data = {pid: pid, aid: config.aid};
            sendCommand('lock', data, function(response) {
                trueMakeEditable(response, cursor);
            });
        } else {
            trueMakeEditable(false);
        }
    }
}

function makeUnEditable(unlock=true) {
    let para = $('.para.rawtext');
    para.removeClass('rawtext')
        .children('.p_input')
        .prop('readonly', true);

    if (!state.ssv_mode) {
        para.css('min-height', '30px');
    }

    $('#bg').removeClass('rawtext');
    $('#content').focus();

    state.cc = false;
    $('#cc_pop').remove();

    if (state.active_para && state.rawtext) {
        state.rawtext = false;
        para.addClass('copy_sel');
        if (state.writeable) {
            storeChange(state.active_para, unlock);
        }
    }
}


/// para locking

function lockParas(pids) {
    pids.forEach(function(pid) {
        let para = getPara(pid);
        para.addClass('locked');
    });
}

function sendUnlockPara(pid) {
    let data = {aid: config.aid, pid: pid};
    sendCommand('unlock', data, function(response) {
        // console.log(response);
    });
}

function unlockParas(pids) {
    console.log(`unlockParas: ${pids}`);
    let act = state.active_para?.attr('pid');
    pids.forEach(function(pid) {
        let para = getPara(pid);
        if (para.hasClass('locked')) {
            para.removeClass('locked');
            if (pid == act && state.rawtext) {
                sendMakeEditable();
            }
        }
    });
}

/// active para tracking

function makeActive(para, scroll=true, select=false) {
    makeUnEditable();
    if (!para) {
        $('#bg').removeClass('active');
    }
    if (!select) {
        $('.para').removeClass('copy_sel');
    }
    $('.para.active').removeClass('active');
    if (state.active_para) {
        state.last_active = state.active_para;
    }
    state.active_para = para;
    if (state.active_para) {
        para.addClass('active');
        para.addClass('copy_sel');
        $('#bg').addClass('active');
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
function activeNextPara(select=false) {
    if (state.active_para) {
        let next = getNextPara();
        if (next.length > 0) {
            makeActive(next, true, select);
            return true;
        } else {
            return false;
        }
    }
}

function activePrevPara(select=false) {
    if (state.active_para) {
        let prev = getPrevPara();
        if (prev.length > 0) {
            makeActive(prev, true, select);
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
        let input = state.active_para.children('.p_input');
        if (input.prop('readonly')) {
            top = true;
            bot = true;
        } else {
            let cpos = input[0].selectionStart;
            let tlen = input[0].value.length;
            top = (cpos == 0);
            bot = (cpos == tlen);
        }
    } else {
        top = true;
        bot = true;
    }

    if (top && dir == 'up') {
        if (activePrevPara()) {
            sendMakeEditable('end');
            return false;
        }
    } else if (bot && dir == 'down') {
        if (activeNextPara()) {
            sendMakeEditable('begin');
            return false;
        }
    }
}

// copy cell

function getSelection() {
    return $('.para.copy_sel');
}

function copyParas() {
    let paras = getSelection();
    state.cb = attrArray(paras, 'raw');
    let cbstr = JSON.stringify(state.cb);
    setCookie('cb', cbstr, 60);
    flash('selection copied')
}

function pasteParas() {
    let pid = state.active_para.attr('pid');
    let ccb = cooks('cb') || state.cb;
    if (ccb && pid) {
        let data = {aid: config.aid, pid: pid, cb: ccb};
        sendCommand('paste_paras', data, function(response) {
            // console.log(response);
        });
    }
}

function splitParas(cur) {
    let para = state.active_para;
    let raw = para.children('.p_input').val();
    let [raw0, raw1] = [raw.substring(0, cur), raw.substring(cur)];
    para.children('.p_input').val(raw0);
    syntaxHL(para);
    makeUnEditable(para);
    sendInsertPara(para, true, true, raw1, 'begin');
}

// folding (editing)

function getFoldParas(pid) {
    let para = getPara(pid);
    let l = para.attr('head_level');
    if (para.attr('env') == 'heading') {
        let fps = [para];
        let nx = para.nextAll('.para:not(.folder)').toArray();
        nx.some(p => {
            if ($(p).attr('head_level') <= l) {
                return true;
             }
             else{
                fps.push(p);
             }
        });
        // what the fuck jquery, why (returns differnt object type in the two cases)
        return [$(fps), $(fps).first()[0]];
    } else {
        let fps = $(`[env_pid=${pid}]`);
        return [$(fps), $(fps).first()];
    }
}

function fold(para, init=false) {
    let env_pid = para.attr('env_pid');
    let fold_pid = para.attr('fold_pid');
    if (env_pid) {
        const foldParas = getFoldParas(env_pid);
        foldParas[0].each(function() {
            let para = $(this);
            const l = getFoldLevel(para);
            para.attr('fold_level', l+1);
        });
        const fold = $(`[fold_pid=${env_pid}]`).first();
        const l = getFoldLevel(fold);
        fold.attr('fold_level', l+1);
        para.attr('folder_level', l+1);
        makeActive(fold);
        if (!init) {
            state.folded.push(env_pid);
            const foldcookie = JSON.stringify(state.folded);
            setCookie('folded', foldcookie);
        }
    } else if (fold_pid) {
        const index = state.folded.indexOf(fold_pid);
        if (index > -1) {
            state.folded.splice(index, 1);
        }
        const foldParas = getFoldParas(fold_pid);
        foldParas[0].each(function() {
            let para = $(this);
            const l = getFoldLevel(para);
            para.attr('fold_level', l-1);
        });
        const fold = $(`[fold_pid=${fold_pid}]`).first();
        const l = getFoldLevel(fold);
        fold.attr('fold_level', l-1);
        fold.next('.para').attr('folder_level', l-1);
        makeActive(foldParas[1]);
        const foldcookie = JSON.stringify(state.folded);
        setCookie('folded', foldcookie, 604800);
    }
    renderFold();
}

function unfold() {
    $('.para').attr('fold_level', 0);
    state.folded = [];
    const foldcookie = JSON.stringify(state.folded);
    setCookie('folded', foldcookie, 604800);
    renderFold();
}

