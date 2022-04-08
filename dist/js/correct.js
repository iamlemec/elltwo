import { state } from './state.js';

/* main article entry point */

class AutoCorrect {
    constructor(corpus){
        this.corpus = corpus;
    }

    correct(word){
    word = word.toLowerCase();
    if(!word.match(/^[a-z]+$/) || word in this.corpus){
        //if not alpha, do not bother correcting
        //in word, do not bother
        return false
    }
    let nbrs = this.neighbors(word);
    return this.selectNeighbor(nbrs)
    }

    //create a list of textually close words
    neighbors(word){

    let nbrs = [];
    let ab = 'abcdefghijklmnopqrstuvwxyz';
    let loop = [...Array(word.length+1).keys()];
    let a_loop = [...Array(ab.length).keys()];

    loop.forEach((i) => {
        if(i > 0){ // boundry conditions
            let subtracted = word.slice(0, i-1) + word.slice(i);
            nbrs.push(subtracted);
            if(i > 1){
            let transposed = word.slice(0, i-2) + word[i-1] + word[i-2] + word.slice(i);
            nbrs.push(transposed);
            }
        }
        a_loop.forEach((j) => {
            let added = word.slice(0, i) + ab[j] + word.slice(i);
            nbrs.push(added);
            if(i > 0){
                let substituted = word.slice(0, i-1) + ab[j] + word.slice(i);
                nbrs.push(substituted);
            }
        });
    });

    return nbrs;

    }

    //select the most frequently used word
    selectNeighbor(nbrs){
    let reduced = nbrs.reduce((filtered, w) => {
        if (w in this.corpus){
            filtered.push([w,this.corpus[w]]);
        }
        return filtered;
    }, []);
    if(!reduced.length){
        return false;
    }
    return reduced.sort((a,b) => {return a[1] > b[1]}).pop()[0];
    }
}

let initAC = async function(){
    console.log('ac INIT');

    async function getData(url) {
        const response = await fetch(url);
        return response.json();
    }

    const wordFreq = await getData('/dist/json/word_freq.json');
    state.ac = new AutoCorrect(wordFreq);

};

export { initAC };
