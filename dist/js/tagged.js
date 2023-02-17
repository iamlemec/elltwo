import { buildBlurbs } from './home.js';
import { renderKatex } from './math.js';

/* home page and search */

function initTagged(tagged, empty=false) {
    $('#results_outer').addClass('tagged');

    if (empty) {
        tagged.forEach(tag => {
            let heading = $('<a>', {class: 'tag_name', html: tag, href: `/tag/${tag}`});
            $('#results').append(heading);
        });
    } else {
        Object.entries(tagged).forEach(([tag, arts]) => {
            let title = `<span class=tag_name>${tag}</span>`;
            let heading = $('<div>', {class: 'tag_heading', html: title});
            let grpDiv = $('<div>', {class: 'tag_group'});
            grpDiv.append(heading);
            $('#results').append(grpDiv);
            buildBlurbs(arts, '', '', grpDiv);
        });
    }

    renderKatex();
}

export { initTagged };
