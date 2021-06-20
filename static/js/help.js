export { initHelp, toggleHelp }

let spec = [
    ['key', 'Enter', 'Enter editing / navigation'],
    ['key', 'Escape', 'Exit editing / navigation'],
    ['key', '🡡', 'Move one cell up'],
    ['key', '🡣', 'Move one cell down'],
    ['key', 'Ctrl + Home', 'Move to first cell'],
    ['key', 'Ctrl + End', 'Move to last cell'],
    ['key', 'a', 'Create cell above'],
    ['key', 'b', 'Create cell below'],
    ['key', 'Shift + Enter', 'Save and create below'],
    ['key', 'D', 'Delete selected cell'],
    ['key', 'c', 'Copy selected cells'],
    ['key', 'v', 'Paste cells in clipboard'],
    ['key', 'Shift + 🡡', 'Extend selection up'],
    ['key', 'Shift + 🡣', 'Extend selection down'],
    ['key', 'f', 'Fold environment cells'],
    ['key', 'Ctrl + Shift + f', 'Unfold all cells'],
    ['key', 'Ctrl + `', 'Toggle sidebar options'],
    ['key', 'Ctrl + Enter', 'Toggle history explorer'],
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
        } else if (type == 'key') {
            let combo = $('<span>', {class: 'key_cell key_combo', text: item[1]});
            let desc = $('<span>', {class: 'key_cell key_desc', text: item[2]});
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
