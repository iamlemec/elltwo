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
    var html_text = markthree(raw);
    para.children('.p_text').html(html_text);
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

// env formating
// move this to backend when we have user genereted envs

getEnvClass = function(span) {
    var envcls = span.attr('class').match(/(?:^|\s)env__(\S+)/);
    if (envcls == null) {
        return null;
    } else {
        return envcls[1];
    }
}

checkEnv = function (para) {
    var flags = {open: false};

    var envspan = para.find('.env_beg').first();
    if (envspan.length !== 0) {
        var env = getEnvClass(envspan);
        if (env != null) {
            flags.open = env;
            flags.args = envspan.data('args');
        }
    }

    flags.close = para.find('.env_end').length !== 0;
    flags.heading = para.find('.heading').length !== 0;

    return flags;
};

// creates classes for environs
envClasses = function() {
    // remove old section classes
    $(".para").removeClass(function(index, css) {
        //should remove all tags, inc env_beg, env_end, env_err
        return (css.match(/(^|\s)env_\S+/g) || []).join(' ');
    });

    var current_open_env = false;
    var env_paras = [];

    $('.para').each(function() {
        var para = $(this);
        var flags = checkEnv(para);
        if (flags.open && !current_open_env) { // cannot open an env if one is already open
            current_open_env = flags.open;
            para.addClass('env_beg').data('args', flags.args);
        }
        if (flags.heading) { // sections or headings break envs
            $(env_paras).addClass('env_err');
            current_open_env = false;
            env_paras = [];
        }
        if (current_open_env) {
            env_paras.push(para[0]);
        }
        if (flags.close) { // closing tag = current open tag
            $(env_paras).addClass(`env__${current_open_env}`);
            para.addClass('env_end');
            current_open_env = false;
            env_paras = [];
        }
    });

    $(env_paras).addClass('env_err'); // add error for open envs left at the end
    envFormat(); // format classed envs
};

// env text

envFormat = function() {
    $('.para.env_beg').each(function() {
        var para = $(this);
        var env = getEnvClass(para);
        if (env != null) {
            if (env in env_spec) {
                env_spec[env](para, para.data('args'));
            } else {
                var args = {code: 'undef', env: env};
                env_spec.error(para, args);
            }
        } else if (para.hasClass('env_err')) {
            var args = {code: 'open'};
            env_spec.error(para, args);
        }
    });
};

//// ENV formatting

simpleEnv = function(para, env, num=false, head='', tail='') {
    para.find('.env_prepend').remove();
    if (num) {
        num = `<span class="num_${env}"></span>`;
    }
    prepend = `<span class="env_prepend">${head}${num}.</span> `;
    para.children('.p_text').prepend(prepend);
}

numberEnv = function(para, env, args, head='', tail='') {
    var num = args.number || '';
    return simpleEnv(para, env, num, head, tail);
}

errorEnv = function(para, args) {
    para.find('.env_prepend').remove();
    if (args.code == 'und') {
        prepend = `<span class="env_prepend">Err: envrionment ${args.env} is not defined.</span> `;
    };
    if (args.code == 'open') {
        // could pass through which environ not closed here
        prepend = `<span class="env_prepend">Err: envrionment not closed.</span> `;
    }
    para.children('.p_text').prepend(prepend);
}

theoremEnv = function(para, args) {
    return numberEnv(para, 'theorem', args, 'Theorem', '');
}

proofEnv = function(para, args) {
    return numberEnv(para, 'proof', args, 'Proof', 'QED');
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
