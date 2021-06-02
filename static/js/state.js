/* global state and config */

export { config, cache, state, updateConfig, updateCache, updateState }

import { merge } from './utils.js'

// defaults

let config = {};

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
