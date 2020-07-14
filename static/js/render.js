// handle incoming commands from server
client = Client(function(cmd, data) {
    msg = JSON.stringify(data);
    console.log("received [" + cmd + "]: " + msg);

    if (cmd == 'updatePara') {
        updatePara(...data); //data must come in correct order or args
    } else if (cmd == 'deletePara') {
        deletePara(...data);
    } else if (cmd == 'insert') {
        insert(...data);
    } else if (cmd == 'status') {
        console.log('status: ', data);
    } else {
        console.log('unknown: ', cmd);
    }
});

/// init commands

// inner HTML for para structure. Included here for updating paras
inner_para = `<div class='p_text'></div>
              <textarea class='p_input'></textarea>
              <div class='update'>Update</div>`;

getPara = function(pid) {
    return $(`[pid=${pid}]`);
};

// get raw text from data-raw attribute, parse, render
dataToText = function(para, raw="") {
    if (!raw) {
        raw = para.data('raw');
    }
    var html_text = markthree(raw);
    para.children('.p_text').html(html_text);
};

$(document).ready(function() {
    var url = "http://" + document.domain + ':' + location.port;
    client.connect(url);
    $('.para').each(function() {
        var para = $(this);
        para.html(inner_para);
        dataToText(para);
    });
});

/// editing commands for paras (triggered by incoming socket commands)
/// local changes only --> to reflect server changes without full reload

updatePara = function(pid, raw) {
    var para = getPara(pid);
    para.data('raw', raw);
    dataToText(para, raw);
};

deletePara = function(pid) {
    var para = getPara(pid);
    para.remove();
};

insert = function(pid, new_pid, before=true, raw="...") {
    var para = getPara(pid);
    var new_para = `<div class="para" pid="${new_pid}" data-raw="${raw}"></div>`;
    if (before) {
        para.before(new_para);
    } else {
        para.after(new_para);
    }
    new_para.html(inner_para);
    dataToText(new_para, raw);
};

/// env methods

checkEnv = function(text){
    var text = text.trim();

    var tag = {
        open: /^(\\begin\{)(.*?)\}/,
        close: /(\\end\{)(.*?)\}$/,
        heading: /^ *(#{1,6})(\*?)/
    };

    var open = false;
    var close = false;
    var heading = false;

    var match_open = text.match(tag.open);
    if (match_open) {
        open = match_open[2];
    }

    var match_close = text.match(tag.close);
    if (match_close) {
        close = match_close[2];
    }

    var match_heading = text.match(tag.heading);
    if (match_heading) {
        heading = true;
    }

    return {'open': open, 'close': close, 'heading': heading}
};

// creates classes for environs
envClasses = function() {
    // remove old section classes
    $(".para").removeClass(function(index, css) {
        return (css.match(/(^|\s)env_\S+/g) || []).join(' ');
    });

    var current_open_env = false;
    var env_paras = [];

    $('.para').each(function() {
        var para = $(this)
        var raw = para.data('raw');
        var flags = checkEnv(raw);
        if (flags.open && !current_open_env) { // cannot open an env if one is already open
            current_open_env = flags.open;
        }
        if (flags.heading) { // sections or headings break envs
            env_paras.forEach(para => para.addClass('env_err'));
            current_open_env = false;
            env_paras = [];
        }
        if (current_open_env) {
            env_paras.push(para);
        }
        if (flags.close && (current_open_env == flags.close)) { // closing tag = current open tag
            env_paras.forEach(para => para.addClass('env_'+current_open_env));
            current_open_env = false;
            env_paras = [];
        }
    });

    env_paras.forEach(para => para.addClass('env_err')); // add error for open envs left at the end
};

/// UI editing

rawToTextArea = function(pid) {
    var para = getPara(pid);
    var textArea = para.children('.p_input');
    textArea.val(para.data('raw'));
};

updateFromTextArea = function(pid) {
    var para = getPara(pid);
    var raw = para.children('.p_input').val();
    client.sendCommand('update_para', {'pid': pid, 'text': raw});
};

$(document).on('click', '.p_text', function() {
    var pid = $(this).parent().attr("pid");
    rawToTextArea(pid);
});

$(document).on('click', '.update', function() {
    var pid = $(this).parent().attr("pid");
    updateFromTextArea(pid);
});
