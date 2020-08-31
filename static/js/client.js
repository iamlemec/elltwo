var Client = (function(recvCommand) {

// socketio connection
var socket;

// canary state
var canary_id = null;
var canary_freq = 1000*30;

function connect(url) {
    console.log(url);

    socket = io.connect(url);

    socket.on('connect', function() {
        console.log("socket connected!");
    });

    socket.on('close', function() {
        console.log("socket closed");
    });

    socket.on('json', function(json) {
        recvCommand(json["cmd"], json["data"]);
    });

    socket.on('updatePara', function(data) {
        updatePara(...data);
    });

    socket.on('updateBulk', function(data) {
        updateParas(data);
    });

    socket.on('insertPara', function(data) {
        insertPara(...data);
    });

    socket.on('deletePara', function(data) {
        deletePara(...data);
    });

    socket.on('lock', function(pids) {
        lockParas(pids);
    });

    socket.on('unlock', function(pids) {
        unlockParas(pids);
    });

}

function disconnect() {
    if (socket) {
        socket.close();
    }
}

// function sendCommand(cmd, cont="", ack=function(){}) {
//     console.log('sending', cmd, cont);
//     var data = {"cmd": cmd, "data": cont};
//     socket.emit("json", data, ack);
// }

function sendCommand(cmd, data="", ack=function(){}) {
    console.log('sending', cmd, )//data);
    socket.emit(cmd, data, ack);
}

function schedCanary() {
    console.log(`schedCanary: ${canary_id}`);
    if (canary_id != null) {
        return;
    }
    canary_id = setTimeout(function() {
        client.sendCommand('canary');
        canary_id = null;
    }, canary_freq);
};

return {
    connect: connect,
    disconnect: disconnect,
    sendCommand: sendCommand,
    schedCanary: schedCanary,
};

});


//// SERVER INTERACTION ////

// handle incoming commands from server
client = Client(function(cmd, data) {
    msg = JSON.stringify(data);
    console.log("received [" + cmd + "]: " + msg);

    if (cmd == 'status') {
        console.log('status: ', data);
    } else if (cmd == 'renderBib') {
        renderBib(data);
    } else if (cmd == 'deleteCite') {
        deleteCite(data);
    } else {
        console.log('unknown: ', cmd);
    }
});
