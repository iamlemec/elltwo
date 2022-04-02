/* home page and search */

export { initTagged }

import { buildBlurbs } from './home.js'
// import { ensureVisible } from './utils.js'
import { renderKatex } from './math.js'

function initTagged(tagged) {

    $('#results_outer').addClass('tagged')

    tagged.forEach(tagGrp => {
        let tags = tagGrp['tagGrp']
        tags = tags.map(t => `<span class=tag_name>${t}</span>`)
        let heading = $('<div>', {class: 'tag_heading', html: tags});
        let grpDiv = $('<div>', {class: 'tag_group'});
        grpDiv.append(heading);
        $('#results').append(grpDiv);

        buildBlurbs(tagGrp['arts'], "", "", grpDiv)

    })
    renderKatex();
}

