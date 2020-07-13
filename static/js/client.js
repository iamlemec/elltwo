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

function sendCommand(cmd, cont, ack) {
    if (cont == undefined) cont = "";
    data = {"cmd": cmd, "data": cont};
    socket.emit("json", data, ack);
}

return {
    connect: connect,
    disconnect: disconnect,
    sendCommand: sendCommand
}

});
