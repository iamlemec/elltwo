export { initHelp, toggleHelp }

import { state } from './state.js'

let spec = [
    ['header', 'Keyboard Shortcuts'],
    ['key', 'Enter', 'Enter editing / navigation'],
    ['key', 'Escape', 'Exit editing / navigation'],
    ['key', 'Alt + Click', 'Activate / edit specific cell'],
    ['key', '&#8657;', 'Move one cell up'],
    ['key', '&#8659;', 'Move one cell down'],
    ['key', 'Ctrl + Home', 'Move to first cell'],
    ['key', 'Ctrl + End', 'Move to last cell'],
    ['key', 'a', 'Create cell above'],
    ['key', 'b', 'Create cell below'],
    ['key', 'Shift + Enter', 'Save and create below'],
    ['key', 'Shift + D', 'Delete selected cell'],
    ['key', 'Ctrl + c', 'Copy selected cells'],
    ['key', 'Ctrl + v', 'Paste cells in clipboard'],
    ['key', 'Shift + &#8657;', 'Extend selection up'],
    ['key', 'Shift + &#8659;', 'Extend selection down'],
    ['key', 'Shift + F', 'Fold environment cells'],
    ['key', 'Ctrl + Shift + F', 'Unfold all cells'],
    ['key', 'Ctrl + `', 'Toggle sidebar options'],
    ['key', 'Ctrl + Enter', 'Toggle history explorer'],
    ['key', 'F1', 'Toggle help overlay'],
    ['header', 'Cell Syntax'],
    ['syntax', '#!', 'Article title'],
    ['syntax', '#\'s', 'Section/subsection title'],
    ['syntax', '$$', 'Display style equation'],
    ['syntax', '!', 'Image figure'],
    ['syntax', '!svg', 'SVG image'],
    ['syntax', '!!', 'Image uploader'],
    ['syntax', '>>', 'Begin environment'],
    ['syntax', '<<', 'End environment'],
    ['syntax', '``', 'Code block (verbatim)'],
    ['header', 'Inline Syntax'],
    ['syntax', '$...$', 'Inline math'],
    ['syntax', '*...*', 'Italic text'],
    ['syntax', '**...**', 'Bold text'],
    ['syntax', '`...`', 'Code text'],
    ['syntax', '^[...]', 'Footnote'],
    ['syntax', '[[...]]', 'Article link'],
    ['syntax', '@[...]', 'Reference internal/external'],
    ['empty'],
    ['empty'],
    ['empty'],
    ['empty'],
    ['empty'],
    ['empty'],
    ['empty'],
    ['empty'],
    ['empty'],
    ['empty'],
    ['empty'],
    ['empty'],
    ['empty'],
    ['empty'],
    ['empty'],
    ['empty'],
];

function initHelp() {
    let help = $('#help_inner');
    for (let i in spec) {
        let row = $('<div>', {class: 'help_row'});

        let item = spec[i];
        let type = item[0];

        if (type == 'empty') {
            row.addClass('help_empty');
        } else if (type == 'header') {
            row.addClass('help_header');
            let head = $('<span>', {html: item[1]});
            row.append(head);
        } else if (type == 'key') {
            let combo = $('<span>', {class: 'key_cell key_combo', html: item[1]});
            let desc = $('<span>', {class: 'key_cell key_desc', html: item[2]});
            row.addClass('help_key');
            row.append([combo, desc]);
        } else if (type == 'syntax') {
            let code = $('<span>', {class: 'syntax_cell syntax_code code', html: item[1]});
            let desc = $('<span>', {class: 'syntax_cell syntax_desc', html: item[2]});
            row.addClass('help_syntax');
            row.append([code, desc]);
        }

        help.append(row);
    }
}

function toggleHelp() {
    let help = $('#help');
    if (state.help_show) {
        help.hide();
        state.help_show = false;
    } else {
        help.show();
        state.help_show = true;
    }
}
