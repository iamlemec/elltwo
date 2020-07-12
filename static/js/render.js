// handle incoming commands from server
recvCommand = function(cmd, data) {
    msg = JSON.stringify(data);
    console.log("received [" + cmd + "]: " + msg);
}
client = Client(recvCommand);

// get raw text from data-raw attribute, parse, render
dataToText = function() {
    $('.para').each(function() {
        raw = $(this).data('raw');
        html_text = markthree(raw);
        $(this).html(html_text)
    });
 };

$(document).ready(function() {
    var url = "http://" + document.domain + ':' + location.port;
    client.connect(url);
    dataToText();
});
