var client = (function() {

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

    socket.on('applyDiff', function(data) {
        applyDiff(data);
    });

    socket.on('lock', function(pids) {
        lockParas(pids);
    });

    socket.on('unlock', function(pids) {
        unlockParas(pids);
    });

    socket.on('renderBib', function(refs) {
        renderBib(refs);
    });

    socket.on('deleteCite', function(key) {
        deleteCite(key);
    });
}

function disconnect() {
    if (socket) {
        socket.close();
    }
}

function sendCommand(cmd, data="", ack=function(){}) {
    console.log('sending', cmd);
    socket.emit(cmd, data, ack);
}

function schedCanary() {
    console.log(`schedCanary: ${canary_id}`);
    if (canary_id !== null) {
        return;
    }
    canary_id = setTimeout(function() {
        client.sendCommand('canary');
        canary_id = null;
    }, canary_freq);
};

return {
    socket: socket,
    connect: connect,
    disconnect: disconnect,
    sendCommand: sendCommand,
    schedCanary: schedCanary,
};

})();
