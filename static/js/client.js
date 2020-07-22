var Client = (function(recvCommand) {

var socket; // socketio connection

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
}

function disconnect() {
    if (socket) {
        socket.close();
    }
}

function sendCommand(cmd, cont="", ack=function(){}) {
    console.log('sending', cmd, cont);
    var data = {"cmd": cmd, "data": cont};
    socket.emit("json", data, ack);
}

return {
    connect: connect,
    disconnect: disconnect,
    sendCommand: sendCommand
};

});


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
    } else if (cmd == 'renderBib') {
        renderBib(data);
    } else {
        console.log('unknown: ', cmd);
    }
});
