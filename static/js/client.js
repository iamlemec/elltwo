export { connect, addHandler, addDummy, sendCommand, schedTimeout }

import { config } from './state.js'
import { noop } from './utils.js'

// socketio connection
let socket = null;

// dummy callbacks
let dummy = {};

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

// for handling events in serverless mode
function addDummy(cmd, callback) {
    dummy[cmd] = callback;
}

function disconnect() {
    if (socket !== null) {
        socket.close();
        socket = null;
    }
}

function sendCommand(cmd, data='', ack=noop) {
    if (cmd in dummy) {
        dummy[cmd](data, ack);
    } else if (socket !== null) {
        console.log(`sending: ${cmd}`);
        socket.emit(cmd, data, ack);
    } else {
        console.log(`tried to send "${cmd}" without connection or dummy handler`);
        console.log(console.trace())
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
