/* global state and config */

export { state, config, cache, initConfig, initState, initCache }

import { merge } from './utils.js'

// defaults

let config = {};

let state = {};

let cache = {};

// config

function initConfig(cf) {
    config = merge(...arguments);
}

// state

function initState(st) {
    state = merge(...arguments);
}

// cache

function initCache(ch) {
    cache = merge(...arguments);
}

function getCacheType(type) {
    if (!(type in cache)) {
        cache[type] = {};
    }
    return cache[type];
}

function getCached(type, key, fetch) {
    let sub = getCacheType(type);
    if (!(key in sub)) {
        sub[key] = fetch();
    }
    return sub[key];
}

function invCached(type, key) {
    let sub = getCacheType(type);
    delete sub[key];
}
