export { initHelp, toggleHelp }

let spec = [
    ['key', 'Enter', 'Enter editing / navigation'],
    ['key', 'Escape', 'Exit editing / navigation'],
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
        } else if (type == 'key') {
            let combo = $('<span>', {class: 'key_cell key_combo', html: item[1]});
            let desc = $('<span>', {class: 'key_cell key_desc', html: item[2]});
            row.addClass('help_key');
            row.append([combo, desc]);
        }

        help.append(row);
    }
}

function toggleHelp() {
    let help = $('#help');
    if (help.is(':visible')) {
        help.hide();
    } else {
        help.show();
    }
}
