import { config } from './state.js';
import { noop } from './utils.js';
import { promisify } from '../node_modules/es6-promisify/dist/promisify.mjs.js';

// socketio connection
let socket = null;
let emit = null;

// dummy callbacks
let dummy = {};

// timeout state
let timeout_id = null;
let timeout_func = null;

// takes optional connect event callback
function connect(url, on_connect=noop) {
    console.log(url);

    socket = io(url);
    emit = promisify((cmd, data, ack) => {
        return socket.emit(cmd, data, ret => ack(undefined, ret));
    });

    socket.on('connect', () => {
        console.log(`socket connect: ${socket.id}`);
        on_connect();
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

async function sendCommand(cmd, data='') {
    JSON.stringify(data);
    if (cmd in dummy) {
        console.log(`dummy: ${cmd}`);
        return await dummy[cmd](data);
    } else if (socket !== null) {
        console.log(`sending: ${cmd}`);
        return await emit(cmd, data);
    } else {
        console.log(`tried to send "${cmd}" without connection or dummy handler`);
        console.log(console.trace());
    }
}

function setTimeoutHandler(callback) {
    timeout_func = callback;
}

function autoLockout() {
    console.log('timeout');
    if (timeout_func !== null) {
        timeout_func();
    }
    timeout_id = null;
    sendCommand('timeout');
}

function schedTimeout() {
    if (timeout_id !== null) {
        clearTimeout(timeout_id);
    }
    timeout_id = setTimeout(autoLockout, 1000*config.timeout);
}

export { addDummy, addHandler, connect, schedTimeout, sendCommand, setTimeoutHandler };
