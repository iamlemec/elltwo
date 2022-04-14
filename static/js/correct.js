/* main article entry point */

export { initAC }

import { state } from './state.js'

class AutoCorrect {
    constructor(corpus) {
        this.corpus = corpus;
    }

    correct(word) {
        let cap = (word[0].toUpperCase() === word[0])
        word = word.toLowerCase()
        if(!word.match(/^[a-z]+$/) || word in this.corpus){
            //if not alpha, do not bother correcting
            //in word, do not bother
            return false
        }
        let nbrs = this.neighbors(word)
        let select = this.selectNeighbor(nbrs)
        if(select && cap){
            select = select[0].toUpperCase() + select.slice(1);
        }
        return select
    }

    //create a list of textually close words
    neighbors(word) {
        let nbrs = [];
        let ab = 'abcdefghijklmnopqrstuvwxyz'
        let loop = [...Array(word.length+1).keys()];
        let a_loop = [...Array(ab.length).keys()];

        loop.forEach((i) => {
            if(i > 0){ // boundry conditions
                let subtracted = word.slice(0, i-1) + word.slice(i);
                if(i==1 || i==word.length || word[i] == word[i-1]){
                    nbrs.push([subtracted, 'subtracted+']);
                }else{
                    nbrs.push([subtracted, 'subtracted']);
                }
                if(i > 1){
                let transposed = word.slice(0, i-2) + word[i-1] + word[i-2] + word.slice(i);
                nbrs.push([transposed, 'transposed']);
                }
            }
            a_loop.forEach((j) => {
                let added = word.slice(0, i) + ab[j] + word.slice(i);
                if(i==0 || i==word.length+1){
                    nbrs.push([added, 'added+']);
                }else{
                    nbrs.push([added, 'added']);
                }
                if(i > 0){
                    let substituted = word.slice(0, i-1) + ab[j] + word.slice(i);
                    nbrs.push([substituted,'substituted']);
                }
            })
        })

        return nbrs;
    }

    calcDist(freq, type) {
        let weights = {
            'transposed': 10,
            'substituted': 1,
            'added': 3,
            'added+': 7,
            'subtracted': 4,
            'subtracted+': 8,
        }
        let weight = weights[type] || 1;
        return freq*weight;
    }

    //select the most frequently used word
    selectNeighbor(nbrs) {
        let reduced = nbrs.reduce((filtered, w) => {
            if (w[0] in this.corpus){
                let dist = this.calcDist(this.corpus[w[0]],w[1]);
                filtered.push([w[0],dist, w[1]]);
            }
            return filtered;
        }, []);
        if(!reduced.length){
            return false;
        }
        let opts = reduced.sort((a,b) => {return a[1] > b[1]})
        return opts.pop()[0];
    }
}

let initAC = async function() {
    async function getData(url) {
        const response = await fetch(url);
        return response.json();
    }

    const wordFreq = await getData('/dist/json/word_freq.json');
    state.ac = new AutoCorrect(wordFreq);
}
