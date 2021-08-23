/* math rendering */

export { renderKatex }

function renderKatex(para, macros) {
    if (para == undefined) {
        para = $('body');
    }
    para.find('span.latex').each(function() {
        let tex = $(this);
        let src = tex.text();
        tex.empty();
        try {
            katex.render(src, tex[0], {
                macros: macros,
                throwOnError: true,
            });
        } catch (e) {
            let espan = $('<span>', {class: 'katex_inline_error', text: src});
            tex.append(espan);
        }
    });
    para.find('div.latex').each(function() {
        let tex = $(this);
        let src = tex.text();
        tex.empty();
        try {
            katex.render(src, tex[0], {
                displayMode: true,
                macros: macros,
                throwOnError: true,
            });
        } catch (e) {
            let msg = e.message;
            let odiv = $('<div>', {class: 'katex_display_error'});
            let tdiv = $('<div>', {class: 'katex_error_source', text: src});
            let ediv = $('<div>', {class: 'katex_error_message', text: msg});
            odiv.append(tdiv);
            odiv.append(ediv);
            tex.append(odiv);
        }
    });
}
