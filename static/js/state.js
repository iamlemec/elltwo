/* global state and config */

export { config, cache, state, initConfig, initCache, initState }

import { merge } from './utils.js'

// defaults

let config = {};

let cache = {};

let state = {};

// config

function initConfig(cf) {
    config = merge(...arguments);
}

// cache

function initCache(ch) {
    cache = merge(...arguments);
}

// state

function initState(st) {
    state = merge(...arguments);
}
