import AdmZip from 'adm-zip'
import * as NodeBuffer from 'node:buffer'
import * as fs from 'node:fs'
import { program } from 'commander'
import { createLatex } from './static/js/export.js'
let { Buffer } = NodeBuffer;

// parse args
program
    .argument('<string>', 'input file')
    .argument('<string>', 'output file')
    .option('-f, --format <format>', 'output file format')
    .parse(process.argv);
let [fin, fout] = program.processedArgs;
let { format } = program.opts();

// create a zip from list of (name, data)
function createZip(blobs) {
    let zwrite = new AdmZip();
    for (let [k, v] of blobs) {
        zwrite.addFile(k, v);
    }
    return zwrite;
}

// read input file
let input = fs.readFileSync(fin, 'utf8');
let paras = input.split('\n\n');

// render to output format
let blobs;
if (format == 'latex' || format == 'tex') {
    let latex = await createLatex(paras);
    let title = latex.title ?? 'untitled.tex';
    blobs = [
        [title, 'application/x-latex', latex.data],
        ...latex.imgs
    ];
}

// convert blob data
blobs = blobs.map(([n, t, d]) => {
    if (typeof d == 'string') {
        return [n, Buffer.from(d, 'utf8')];
    } else {
        return [n, d];
    }
});

// write output file
let zzip = createZip(blobs);
zzip.writeZip(fout);
