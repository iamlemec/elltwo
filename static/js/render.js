//// SERVER INTERACTION ////

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

/// init commands ///

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

/////////////////// EDITING /////////

/// editing commands for paras (triggered by incoming socket commands)
/// local changes only --> to reflect server changes without full reload

// get raw text from data-raw attribute, parse, render
dataToText = function(para, raw) {
    if (raw == undefined) {
        raw = para.data('raw');
    }

    var mark_out = markthree(raw);
    var html_text = mark_out['src'];
    var env_info = mark_out['env'];

    para.children('.p_text').html(html_text);

    //must remove old classes, to prevent pileup / artifacts
    para.removeClass('env_end')
            .removeClass('env_beg')
            .removeAttr('env', "");

    if (env_info != null) {
        if (env_info.type == 'begin') {
            para.addClass('env_beg');
            para.attr('env', env_info.env);
            para.data('args', env_info.args);
            if (env_info.single) {
                para.addClass('env_end');
            }
        } else if (env_info.type == 'end') {
            para.addClass('env_end');
        }
    };
};

rawToTextArea = function(para) {
    var textArea = para.children('.p_input');
    textArea.val(para.data('raw'));
};

updateFromTextArea = function(para) {
    var raw = para.children('.p_input').val();
    var pid = para.attr('pid');
    client.sendCommand('update_para', {'pid': pid, 'text': raw});
};

/// Severer Command Editing

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

/// UI editing

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

/////////////////// ENVS /////////

// move this to backend when we have user genereted envs

// creates classes for environs
envClasses = function() {
    // remove old env classes
    $(".para").removeClass(function(index, css) {
        return (css.match(/(^|\s)env__\S+/g) || []).join(' '); 
    });

    // remove error markers
    $('.para').removeClass('env_err');

    // env state
    var current_open_env = false;
    var env_paras = [];

    // forward env pass
    $('.para').each(function() {
        var para = $(this);

        if (!current_open_env && para.hasClass('env_beg')) { // cannot open an env if one is already open
            current_open_env = para.attr('env');
        }

        if (para.hasClass('heading')) { // sections or headings break envs
            $(env_paras).addClass('env_err');
            current_open_env = false;
            env_paras = [];
        }

        if (current_open_env) {
            env_paras.push(para[0]);
        }

        if (para.hasClass('env_end')) { // closing tag = current open tag
            $(env_paras).addClass('env').addClass(`env__${current_open_env}`);
            current_open_env = false;
            env_paras = [];
        }
    });

    // add error for open envs left at the end
    $(env_paras).addClass('env_err');

    // format classed envs
    envFormat();
    createNumbers();
};

// dispatch environment formatters
envFormat = function() {
    $('.para').each(function() {
        var para = $(this);
        var env = para.attr('env');
        if (para.hasClass('env_err')) {
            var args = {code: 'open', env: env};
            env_spec.error(para, args);
        } else if (env != null) {
            if (env in env_spec) {
                env_spec[env](para, para.data('args'));
            } else {
                var args = {code: 'undef', env: env};
                env_spec.error(para, args);
            }
        }
    });
};

//// ENV formatting

simpleEnv = function(para, env, num=false, id='', head='', tail='') {
    para.attr('id', id);
    var pre = para.find('.env_header');
    pre.html(num ? `${head} <span class="num" counter=${env} inc=1></span>.` : `${head}.`);
}

numberEnv = function(para, env, args, head='', tail='') {
    var id = args.id || '';
    var num = args.number || '';
    return simpleEnv(para, env, num, id, head, tail);
}

errorEnv = function(para, args) {
    var pre = para.find('.env_header');
    var msg;
    if (args.code == 'undef') {
        msg = `<span class="env_prepend">Err: envrionment ${args.env} is not defined.</span> `;
    }
    if (args.code == 'open') {
        // could pass through which environ not closed here
        msg = `<span class="env_prepend">Err: envrionment not closed.</span> `;
    }
    pre.html(msg);
}

theoremEnv = function(para, args) {
    return numberEnv(para, 'theorem', args, 'Theorem', '');
}

proofEnv = function(para, args) {
    return simpleEnv(para, 'proof', false, '', 'Proof', 'QED');
}

exampleEnv = function(para, args) {
    return numberEnv(para, 'example', args, 'Example', '');
}

env_spec = {
    'theorem': theoremEnv,
    'proof': proofEnv,
    'example': exampleEnv,
    'error': errorEnv
}


/// Numbering

createNumbers = function() {
    var nums = {};
    $('.num').each(function(){
        var counter = $(this).attr('counter');
        var inc = parseInt($(this).attr('inc'));
        nums[counter] = nums[counter] || 0;
        nums[counter] += inc;
        $(this).text(nums[counter]);
    })
};
