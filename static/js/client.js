var client = (function() {

// socketio connection
var socket;

// canary state
var canary_id = null;
var canary_freq = 1000*30;

// takes optional connect event callback
function connect(url, on_connect) {
    console.log(url);

    socket = io(url);

    socket.on('connect', () => {
        console.log(`socket connect: ${socket.id}`);
        if (on_connect !== undefined) {
            on_connect();
        }
    });

    socket.on('connect_error', (error) => {
        console.log(`socket connect_error: ${error.message}`);
    });

    socket.on('disconnect', (reason) => {
        console.log(`socket disconnect: ${reason}`);
    });

    socket.io.on('reconnect_attempt', () => {
        console.log('socket reconnect_attempt');
    });

    socket.io.on('reconnect', () => {
        console.log(`socket reconnect: ${socket.id}`);
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

    socket.on('pasteCB', function(data) {
        pasteCB(...data);
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
