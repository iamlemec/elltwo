/* main article entry point */


export {
    initIndex
}

import { setCookie, cooks, getPara, on_success } from './utils.js'
import {
    stateRender, initRender, eventRender, innerPara, rawToRender, rawToTextarea,
    envClasses, createTOC, getTro, troFromKey, popText, syntaxHL, cacheBib, deleteCite,
    braceMatch, makePara
} from './render.js'
import { renderKatex } from './math.js'
import {
    initEditor, resize, makeActive, lockParas, unlockParas, sendMakeEditable,
    sendUpdatePara, placeCursor
} from './editor.js'



let default_config = {
    theme: 'classic', // theme to use
    font: 'default', // font to use
};


function initIndex() {
    renderKatex()
    $('.para').each(function() {
        let para = $(this);
        makePara(para);
    });
}
