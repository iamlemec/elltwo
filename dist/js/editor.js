import { state, config } from './state.js';
import { createButton, copyText, flash, attrArray, ensureVisible, setCookie, cooks, smallable_butt, getPara } from './utils.js';
import { sendCommand, schedTimeout } from './client.js';
import { getEditor, getFoldLevel, renderFold, rawToRender, rawToTextarea } from './render.js';
import './hl.js';
import { toggleHistMap, toggleSidebar, ccNext, ccMake, insertParaRaw, deleteParas, updateRefs } from './article.js';
import { toggleHelp } from './help.js';

////// UI ///////

/// initialization

let s_butts = {
    '#r_text': 'Revert',
    '#e_text': 'Export',
    '#h_text': 'History',
};

function initEditor() {
    smallable_butt(s_butts);
}

function eventEditor() {
    // keyboard interface
    $(document).keydown(function(e) {
        let key = e.key.toLowerCase();
        let ctrl = e.ctrlKey;
        e.altKey;
        let meta = e.metaKey;
        let shift = e.shiftKey;

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
            state.svg.close();
        }

        if (!(state.rawtext && state.writeable) && !meta && !ctrl && !state.svg.show) {
            if (key == '-') {
                $('#ssv_check').click();
                return false;
            } else if (!state.readonly && key == '=') { // permission to edit
                $('#edit_check').click();
                return false;
            }
        }

        if (!state.active_para && !state.svg.show) { // if we are inactive
            if (key == 'enter' && state.writeable) {
                let foc_para = state.last_active || $('.para').first();
                makeActive(foc_para);
                return false;
            }
        } else if (state.active_para && !state.rawtext && !state.svg.show) {
            if (shift && key == 'enter' && state.active_para.attr('env')=='imagelocal') {
                state.active_para.find('.img_update').click();
            } else if (key == 'enter') {
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
                state.svg.close();
                makeActive(null);
                return false;
            } else if (shift && key == 'f') {
                fold(state.active_para);
                return false;
            }
            if (state.writeable && !state.svg.show) { // if we are active but not in edit mode
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

        } else if (state.active_para && state.rawtext && !state.svg.show) { // we are active and rawtext
            if (key == 'arrowup') {
                if (state.cc) { // if there is an open command completion window
                    ccNext('down');
                    return false;
                } else if (!state.writeable) {
                    if (activePrevPara()) {
                        sendMakeEditable();
                        return false;
                    }
                }
            } else if (key == 'arrowdown') {
                if (state.cc) {
                    ccNext('up');
                    return false;
                } else if (!state.writeable) {
                    if (activeNextPara()) {
                        sendMakeEditable();
                        return false;
                    }
                }
            } else if (key == 'escape') {
                state.svg.close();
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
                    ccMake(null, true);
                    return false;
                }
                makeUnEditable();
                if (state.writeable) {
                    sendInsertPara(state.active_para, true);
                }
                return false;
            } else if ((ctrl || meta) && key == '\\') {
                splitParas();
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

        // clicking interactive does not open para
        let targ = $(e.target);
        if (targ.closest('.fig_iac').length > 0 || targ.closest('.img_update').length > 0){
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
        let txt = 'Delete Cell?';
        let del = createButton('ConfirmDelete', 'Delete', 'delete');
        let para = $(this).parents('.para');
        let action = function(){
            sendDeleteParas(para);
        };
        showConfirm(del, action, txt);
        return false;
    });

    $(document).on('click', '.copylink', function() {
        let para = $(this).parents('.para');
        let link = para.attr('id') || `pid-${para.attr('pid')}`;
        link = location.protocol + '//' + location.host + location.pathname + '#' + link;
        copyText(link);
        flash(`"${link}" copied to clipboard`);

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

    $(document).on('click', '.iac_tog', function() {
        let iac = $(this).siblings('.fig_iac');
        let wrap = $(this).parent();
        $(this).toggleClass('closed');
        if (!$(this).hasClass('closed')) {
            wrap.toggleClass('closed');
            iac.slideDown();
        } else {
            iac.slideUp(() => {
                wrap.toggleClass('closed');
            });
        }
        return false;
    });

    $(document).on('click', '.fig_iac_wrap.closed', function() {
        $(this).children('.iac_tog').click();
        return false;
    });

    $('#content').focus();
}

/// rendering and storage

// store a change locally or server side, if no change also unlock server side
function storeChange(para, unlock=true, force=false) {
    // get old and new text
    let editor = getEditor(para);
    let text = editor.getText();
    let raw = para.attr('raw');

    // store old env and render
    rawToRender(para, false, true, text); // local changes only

    // update server as needed
    if (force || text != raw) {
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

/// server comms

async function sendUpdatePara(para, text, rerender=false) {
    let pid = para.attr('pid');
    let data = {aid: config.aid, pid: pid, text: text};
    if (await sendCommand('update_para', data)) {
        applyChange(para, text);
        if (rerender) {
            rawToRender(para);
            rawToTextarea(para);
        }
    }
}

async function sendInsertPara(para, after=true, text="") {
    let fold_pid = para.attr('fold_pid');
    let head;
    if (fold_pid) {
        let env = $(`[env_pid=${fold_pid}]`);
        head = after ? env.last() : env.first();
    } else {
        head = para;
    }
    let pid = head.attr('pid');

    let data = {aid: config.aid, pid: pid, after: after, edit: true, text: text};
    let new_pid = await sendCommand('insert_para', data);
    if (new_pid !== undefined) {
        let new_para = insertParaRaw(pid, new_pid, text, after);
        initDrag();
        makeActive(new_para);
        state.rawtext = true;
        trueMakeEditable();
    }
}

async function sendDeleteParas(paras) {
    let pids = attrArray(paras, 'pid');
    let data = {aid: config.aid, pids: pids};
    let next = getNextPara(paras.last());
    if (next.length == 0) {
        next = getPrevPara(paras.first());
    }
    if (await sendCommand('delete_paras', data)) {
        if (next) {
            makeActive(next);
        }
        deleteParas(pids);
    }
}

function splitParas() {
    let para = state.active_para;
    let editor = getEditor(para);
    let raw = editor.getText();
    let cur = editor.getCursorPos();
    let [raw0, raw1] = [raw.substring(0, cur), raw.substring(cur)];
    editor.setText(raw0);
    makeUnEditable(para);
    sendInsertPara(para, true, raw1);
}

// revertChange?

/// para rawtext

function placeCursor(loc) {
    if (state.active_para && state.writeable) {
        let editor = getEditor(state.active_para);
        editor.focus();
        if (loc == 'begin') {
            editor.setCursorPos(0);
        } else if (loc == 'end') {
            let tlen = editor.getLength();
            editor.setCursorPos(tlen);
        } else {
            editor.setCursorPos(...loc);
        }
    }
}

function detectLanguage(para) {
    let raw = para.attr('raw');
    if (raw.startsWith('!gum')) {
        return 'gum';
    } else {
        return 'elltwo';
    }
}

function trueMakeEditable(rw=true, cursor='end') {
    state.active_para.addClass('rawtext');
    $('#bg').addClass('rawtext');

    let editor = getEditor(state.active_para);
    let lang = detectLanguage(state.active_para);
    editor.setEditable(rw);
    editor.setLanguage(lang);
    editor.active = true;

    if (rw) {
        placeCursor(cursor);
        schedTimeout();
    }

    editor.update();
}

async function sendMakeEditable(cursor='end') {
    state.rawtext = true;
    $('.para').removeClass('rawtext');
    $('.para').removeClass('copy_sel');

    if (state.active_para) {
        if (state.active_para.hasClass('folder')) {
            fold(state.active_para);
        }

        if (state.writeable) {
            let pid = state.active_para.attr('pid');
            let data = {pid: pid, aid: config.aid};
            let rw = await sendCommand('lock', data);
            trueMakeEditable(rw, cursor);
        } else {
            trueMakeEditable(false);
        }
    }
}

function makeUnEditable(unlock=true) {
    let para = $('.para.rawtext');
    para.removeClass('rawtext');

    if (!state.ssv_mode) {
        para.css('min-height', '30px');
    }

    $('#bg').removeClass('rawtext');
    $('#content').focus();

    //remove cmd complete and autocomplete
    state.cc = false;
    $('#cc_pop').remove();
    if (para.length > 0) {
        let editor = getEditor(para);
        editor.clearCorrect();
        editor.active = false;
    }

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
    sendCommand('unlock', data);
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

function editorHandler(editor, key, event) {
    let up = key == 'left' || key == 'up';
    let down = key == 'right' || key == 'down';

    let top, bot;
    if (state.writeable) {
        if (!editor.getEditable()) {
            top = true;
            bot = true;
        } else {
            let cpos = editor.getCursorPos();
            let tlen = editor.getLength();
            top = (cpos == 0);
            bot = (cpos == tlen);
        }
    } else {
        top = true;
        bot = true;
    }

    if (top && up) {
        if (activePrevPara()) {
            sendMakeEditable('end');
            return true;
        }
    } else if (bot && down) {
        if (activeNextPara()) {
            sendMakeEditable('begin');
            return true;
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
    flash('selection copied');
}

function pasteParas() {
    let pid = state.active_para.attr('pid');
    let ccb = cooks('cb') || state.cb;
    if (ccb && pid) {
        sendCommand('paste_paras', {aid: config.aid, pid: pid, cb: ccb});
    }
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
             else {
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

// confirm dialog

function showConfirm(button, action, text) {
    state.confirm = true;
    // let del = createButton('ConfirmDelete', 'Delete', 'delete');
    let exit = createButton('ConfirmCancel', 'Cancel', 'cancel');
    $('#bg').addClass('blur');
    let txt = $('<div>', {text: text});
    $('#cp_inner').append(txt).append(button).append(exit);
    $('#confirm_popup').show();
    $('#ConfirmCancel').on('click', (e) => {hideConfirm();});

    button.on('click', function() {
        action();
        hideConfirm(button);
    });

    $('#confirm_popup').on('click', function(e) {
        let targ = $(e.target);
        if (targ.closest('#cp_inner').length == 0) {
            hideConfirm();
        }
    });
}

function hideConfirm(unbind=false) {
        state.confirm = false;
        $('#bg').removeClass('blur');
        $('#cp_inner').empty();
        $('#confirm_popup').hide();
        //unbind click events
        $('#ConfirmCancel').off('click');
        $('#confirm_popup').off('click');
        if (unbind) {
            unbind.off('click');
        }
}

/// DRAG

function initDrag(){
    console.log('dragInit');

    // remove old event listers, to prevent pileup
    $('.controlZone').off('mousedown');
    $('.controlZone').off('mouseup');
    $(document).off('dragover');
    $('.para').off('dragover');
    $('.para').off('drop');

    $('.controlZone').on('mousedown', (e) => {
        if (state.writeable) {
            let dragger = e.target;
            let para = $(dragger.closest('.para'));

            // let data = {pid: para.attr('pid'), aid: config.aid};
            // let rw = sendCommand('lock', data);

            para.attr('draggable', true);
            para.addClass('dragging');
            state.dragPara = para;
            $(dragger).css('cursor', 'grabbing');
        }
    });

    $('.controlZone').on('mouseup', (e) => {
        let dragger = e.target;
        let para = dragger.closest('.para');
        state.dragPara = null;
        $(para).attr('draggable', false);
        $(para).removeClass('dragging');
        $(dragger).css('cursor', '');
    });

    //to prevent default drag behavior
    $(document).on('dragover', (e) => {
        e.preventDefault();
    });

    $('.para').on('dragover', (e) => {
        e.preventDefault();
        let targ = $(e.target.closest('.para'));
        let targPID = targ.attr('pid');
        let nextPID = getNextPara(targ).attr('pid') || null;
        let drag = state.dragPara;
        let dragPID = drag.attr('pid');
        if(targPID == dragPID || nextPID == dragPID){
            return false;
        }else {
            targ.addClass('dropTarg');
        }
    });

    $('.para').on('dragleave', (e) => {
        e.preventDefault();
        let para = e.target.closest('.para');
        $(para).removeClass('dropTarg');
    });


    $('.para').on('drop', (e,t) => {

        let targ = $(e.target.closest('.para'));
        let targPID = targ.attr('pid');
        let nextPID = getNextPara(targ).attr('pid') || null;

        let drag = state.dragPara;
        let dragPID = drag.attr('pid');
        e.stopPropagation();
        $('.para').attr('draggable', false)
        .removeClass('dragging')
        .removeClass('dropTarg');
        $('.controlZone').css('cursor', 'grab');
        state.dragPara = null;

        if(targPID == dragPID || nextPID == dragPID){
            console.log('no change');
        }else {
            let data = {aid: config.aid, drag_pid: dragPID, targ_pid: targPID};
            sendCommand('move_para', data);
            }
    });






}

export { editorHandler, eventEditor, fold, hideConfirm, initDrag, initEditor, lockParas, makeActive, makeUnEditable, placeCursor, sendMakeEditable, sendUpdatePara, showConfirm, storeChange, unlockParas };
