export { connect, addHandler, sendCommand, schedTimeout }

import { config } from './state.js'

// socketio connection
let socket = null;

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
    if (socket !== null) {
        socket.close();
        socket = null;
    }
}

function sendCommand(cmd, data='', ack=function(){}) {
    if (socket !== null) {
        console.log(`sending: ${cmd}`);
        socket.emit(cmd, data, ack);
    } else {
        console.log(`tried to send "${cmd}" without connection`);
    }
}

function autoLockout() {
    console.log('timeout');
    sendCommand('timeout');
    timeout_id = null;
}

function schedTimeout() {
    if (timeout_id !== null) {
        clearTimeout(timeout_id);
    }
    timeout_id = setTimeout(autoLockout, 1000*config.timeout);
}
