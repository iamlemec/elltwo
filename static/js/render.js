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
        para.children('.p_text').html(html_text);
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

insert = function(pid, new_pid, before=true, raw="..."){
    para = $('#para_' + pid);
    new_para = `<div class="para" id=para_`+new_pid+` data-raw="`+raw+`">
                    <div class='p_text'></div>
                    <textarea class='p_input'></textarea>
                    <div class='update'>Update</div>
                </div>`;
    if(before){
        para.before(new_para);
    }else{
        para.after(new_para);
    };
    dataToText($('#para_' + new_pid), raw);
};

/// env methods

checkEnv = function(text){
    text = text.trim()
    open_tag = /^(\\begin\{)(.*?)\}/ 
    close_tag = /(\\end\{)(.*?)\}$/
    heading_tag = /^ *(#{1,6})(\*?) *(?:refid)? *([^\n]+?) *#* *(?:\n+|$)/

    open = false
    close = false
    heading = false

    if (text.match(open_tag)){
        open = text.match(open_tag)[2]
    };
    if (text.match(close_tag)){
        close = text.match(close_tag)[2]
    };
    if (text.match(heading_tag)){
        heading = true;
    }
    
    return {'open': open, 'close': close, 'heading': heading}
};

//creates classes for environs 
envClasses = function(){
    //remove old section classes
    $(".para").removeClass (function (index, css) {
        return (css.match (/(^|\s)env_\S+/g) || []).join(' ');
    });

    current_open_env = false
    env_paras = []
    $('.para').each(function(){
        raw = $(this).data('raw')
        flags = checkEnv(raw)
        if (flags.open && !(current_open_env)){ //cannot open an env if one is already open
            current_open_env = flags.open;
        };
        if (flags.heading){ //sections or headings break envs
            env_paras.forEach(para => para.addClass('env_err'))
            current_open_env = false;
            env_paras = [] 
        }
        if (current_open_env){
            env_paras.push($(this))
        };
        if (flags.close && ((current_open_env)==(flags.close))){ //closing tag = current open tag
            env_paras.forEach(para => para.addClass('env_'+current_open_env))
            current_open_env = false;
            env_paras = [] 
        };
    });
    env_paras.forEach(para => para.addClass('env_err')) //add error for open envs left at the end
}
>>>>>>> env
