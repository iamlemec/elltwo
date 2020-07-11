

//get raw text from data-raw attribute, parse, render
dataToText = function(){
    $('.para').each(function () {
        raw = $(this).data('raw');
        html_text = markthree(raw);
        $(this).html(html_text)
    });
 };

$(document).ready(dataToText);