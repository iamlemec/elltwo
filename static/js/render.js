
// move this to backend when we have user genereted envs

env_format = {
    'thm': {'b': 'Theorem', 'e':""},
    'proof': {'b': 'Proof', 'e':"QED"},
    'err': {'b': 'ERR: env not closed. ', 'e':""},
    'undefined': {'b': 'ERR: env undefined. ', 'e':""}
}


// handle incoming commands from server
client = Client(function(cmd, data) {
    msg = JSON.stringify(data);
    console.log("received [" + cmd + "]: " + msg);

    if (cmd == 'updatePara') {
        updatePara(...data); //data must come in correct order or args
    } else if (cmd == 'deletePara') {
        deletePara(...data);
    } else if (cmd == 'insert') {
        insertPara(...data);
    } else if (cmd == 'status') {
        console.log('status: ', data);
    } else {
        console.log('unknown: ', cmd);
    }
});

/// init commands

// inner HTML for para structure. Included here for updating paras
inner_para = `<div class="p_text"></div>
              <textarea class="p_input"></textarea>
              <div class="control">
              <button class="update">Update</button>
              <button class="before">Before</button>
              <button class="after">After</button>
              <button class="delete">Delete</button>
              </div>`;

getPara = function(pid) {
    return $(`[pid=${pid}]`);
};

// get raw text from data-raw attribute, parse, render
dataToText = function(para, raw) {
    if (raw == undefined) {
        raw = para.data('raw');
    }
    var html_text = markthree(raw);
    para.children('.p_text').html(html_text);
};

$(document).ready(function() {
    var url = `http://${document.domain}:${location.port}`;
    client.connect(url);
    $('.para').each(function() {
        var para = $(this);
        para.html(inner_para);
        dataToText(para);
        rawToTextArea(para);
    });

    // goofy debugging
    $('#head').append('<button id="env_update" style="margin-left: 10px;">Environ</button>');
    $('#env_update').click(envClasses);
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

insertPara = function(pid, new_pid, before=true, raw="...") {
    var para = getPara(pid);
    var new_para = $(`<div class="para" pid="${new_pid}" data-raw="${raw}"></div>`);
    if (before) {
        para.before(new_para);
    } else {
        para.after(new_para);
    }
    new_para.html(inner_para);
    dataToText(new_para, raw);
    rawToTextArea(new_para);
};

/// env methods

checkEnv = function(para){
    para = $(para);
    var flags = {};

    flags.open = false;
    var open = para.find('.env_beg');
    if(open.length){
        envspan = open[0]
        envcls = $(envspan).attr("class").match(/(^|\s)env__\S+/g);
        if(envcls){
            env = envcls[0].substr(6);
            flags.open = env;
        }
    }


    flags.close = para.find('.env_end').length !== 0;
    flags.heading = para.find('.heading').length !== 0;
    return flags
};

// creates classes for environs
envClasses = function() {
    // remove old section classes
    $(".para").removeClass(function(index, css) {
        return (css.match(/(^|\s)env__\S+/g) || []).join(' ');
    });

    var current_open_env = false;
    var env_paras = [];

    $('.para').each(function() {
        var flags = checkEnv(this);
        if (flags.open && !current_open_env) { // cannot open an env if one is already open
            current_open_env = flags.open;
            $(this).addClass('env_beg');
        }
        if (flags.heading) { // sections or headings break envs
            env_paras.forEach(para => para.addClass('env_err'));
            current_open_env = false;
            env_paras = [];
        }
        if (current_open_env) {
            env_paras.push($(this));
        }
        if (flags.close) { // closing tag = current open tag
            env_paras.forEach(para => para.addClass('env__'+current_open_env));
            $(this).addClass('env_end');
            current_open_env = false;
            env_paras = [];
        }
    });

    env_paras.forEach(para => para.addClass('env_err')); // add error for open envs left at the end
};

/// UI editing

rawToTextArea = function(para) {
    var textArea = para.children('.p_input');
    textArea.val(para.data('raw'));
};

updateFromTextArea = function(para) {
    var raw = para.children('.p_input').val();
    var pid = para.attr('pid');
    client.sendCommand('update_para', {'pid': pid, 'text': raw});
};

$(document).on('click', '.p_text', function() {
    var para = $(this).parent();
    rawToTextArea(para);
});

$(document).on('click', '.update', function() {
    var para = $(this).parent().parent();
    updateFromTextArea(para);
});

$(document).on('click', '.before', function() {
    var pid = $(this).parent().parent().attr('pid');
    client.sendCommand('insert_before', {'pid': pid});
});

$(document).on('click', '.after', function() {
    var pid = $(this).parent().parent().attr('pid');
    client.sendCommand('insert_after', {'pid': pid});
});

$(document).on('click', '.delete', function() {
    var pid = $(this).parent().parent().attr('pid');
    client.sendCommand('delete_para', {'pid': pid});
});
