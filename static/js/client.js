export { connect, addHandler, sendCommand, schedTimeout }

// socketio connection
let socket;

// timeout state
let timeout_id = null;

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
}

function addHandler(signal, callback) {
    socket.on(signal, callback);
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

function autoLockout() {
    console.log('timeout');
    sendCommand('timeout');
    timeout_id = null;
}

function schedTimeout() {
    // console.log(`schedTimeout: ${timeout_id}`);
    if (timeout_id !== null) {
        clearTimeout(timeout_id);
    }
    timeout_id = setTimeout(autoLockout, timeout);
}
