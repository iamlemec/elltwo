// handle incoming commands from server
recvCommand = function(cmd, data) {
    msg = JSON.stringify(data);
    console.log("received [" + cmd + "]: " + msg);
    if(cmd=='updatePara'){
        updatePara(...data); //data must come in correct order or args
    }else if(cmd=='deletePara'){
        deletePara(...data)
    }else if(cmd=='insert'){
        insert(...data)
    }else if(cmd=='status'){
        console.log('status: ', data);
    }else{
        console.log('unknown cmd: ', cmd)
    }
}
client = Client(recvCommand);

// get raw text from data-raw attribute, parse, render
dataToText = function(para, raw="") {
    if (!raw){
        raw = para.data('raw');
    }
        html_text = markthree(raw);
        para.html(html_text);
 };

$(document).ready(function() {
    var url = "http://" + document.domain + ':' + location.port;
    client.connect(url);
    $('.para').each(function() {
        dataToText($(this));
    });
});

/// editing commands for paras (triggered by incoming socket commands)
/// local changes only --> to reflect server changes without full reload

updatePara = function(pid, raw){
    para = $('#para_' + pid);
    para.data('raw', raw);
    dataToText(para, raw);
};

deletePara = function(pid){
    para = $('#para_' + pid);
    para.remove()
};

insert = function(pid, new_pid, before=true){
    para = $('#para_' + pid);
    new_para = `<div class="para" id=para_`+new_pid+` data-raw="">...</div>`;
    if(before){
        para.before(new_para);
    }else{
        para.after(new_para);
    };
};
