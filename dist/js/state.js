import { isMobile, merge } from './utils.js';

/* global state and config */

// defaults

let config = {
    mobile: isMobile()
};

let cache = {};

let state = {};

// config

function updateConfig(cf) {
    config = merge(config, ...arguments);
}

// cache

function updateCache(ch) {
    cache = merge(cache, ...arguments);
}

// state

function updateState(st) {
    state = merge(state, ...arguments);
}

export { cache, config, state, updateCache, updateConfig, updateState };
