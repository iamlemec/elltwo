/* math rendering */

export { renderKatex }

function renderKatex(para, macros) {
    if (para == undefined) {
        para = $('body');
    }
    para.find('span.latex').each(function() {
        var tex = $(this);
        var src = tex.text();
        tex.empty();
        try {
            katex.render(src, tex[0], {macros: macros,
            throwOnError: false,
            });
        } catch (e) {
            console.log(para.text());
            console.log(src);
            console.log(e);
        }
    });
    para.find('div.latex').each(function() {
        var tex = $(this);
        var src = tex.text();
        $(this).empty();
        try {
            katex.render(src, tex[0], {displayMode: true,
                macros: macros,
                throwOnError: false,
            });
        } catch (e) {
            console.log(para.text());
            console.log(src);
            console.log(e);
        }
    });
}
