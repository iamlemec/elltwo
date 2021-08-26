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
        tex.removeClass('latex_error');
        try {
            katex.render(src, tex[0], {
                macros: macros,
                throwOnError: false,
            });
        } catch (e) {
            let espan = $('<span>', {class: 'katex_inline_error', text: src});
            tex.append(espan);
            tex.addClass('latex_error');
        }
    });
    para.find('div.latex').each(function() {
        let tex = $(this);
        let src = tex.text();
        tex.empty();
        tex.removeClass('latex_error');
        katex.render(src, tex[0], {
            displayMode: true,
            macros: macros,
            throwOnError: false,
        });
        let err = tex.children('.katex-error');
        if (err.length > 0) {
            let msg = err.attr('title');
            let ddiv = $('<div>', {class: 'katex_display_error'});
            let odiv = $('<div>', {class: 'katex_error_outer'});
            let tdiv = $('<pre>', {class: 'katex_error_source', text: src});
            let ediv = $('<div>', {class: 'katex_error_message', text: msg});
            tex.empty();
            odiv.append(tdiv);
            ddiv.append(odiv);
            ddiv.append(ediv);
            tex.append(ddiv);
            tex.addClass('latex_error');
        }
    });
}
