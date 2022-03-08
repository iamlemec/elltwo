import * as fs from 'node:fs'
import * as NodeBuffer from 'node:buffer'
import AdmZip from 'adm-zip'
import { program } from 'commander'
let { Buffer } = NodeBuffer;

import { createMarkdown, createLatex } from '../static/js/export.js'
import { cache } from '../static/js/state.js'
import { KeyCacheAsync, DummyCache } from '../static/js/utils.js'
import { initSchemas } from './schema.js'
import { getAid, getImage, articleText } from './query.js'

// export elltwo article
program
    .command('export')
    .option('--db <path>', 'database to use', '../elltwo.db')
    .option('-a, --aid <aid>', 'article id')
    .option('-t, --title <title>', 'article title')
    .option('-i, --input <path>', 'input file')
    .option('-o, --output <path>', 'output file')
    .option('-f, --format <format>', 'output file format', 'latex')
    .option('-z, --zip', 'zip output')
    .action(async function(options) {
        console.log(options);
        let input;
        if (options.input == null) {
            let db = await initSchemas(options.db);
            cache.img = new AsyncKeyCache('img', async function(key) {
                let image = await getImage(db, key);
                return {mime: image.mime, data: image.data};
            });
            let aid = options.aid ?? await getAid(db, options.title);
            input = await articleText(db, aid);
        } else {
            input = fs.readFileSync(options.input, 'utf8');
        }
        convertMarkdown(input, options.output, options.format, options.zip);
    });

// execute plan
program.parse();

// create a zip from list of (name, data)
function createZip(blobs) {
    let zwrite = new AdmZip();
    for (let [k, v] of blobs) {
        zwrite.addFile(k, v);
    }
    return zwrite;
}

function convertItems(items) {
    return items.map(([n, t, d]) => {
        if (typeof d == 'string') {
            return [n, Buffer.from(d, 'utf8')];
        } else {
            return [n, d];
        }
    });
}

function writeOrPrint(data, file) {
    if (file == null) {
        console.log(data);
    } else {
        fs.writeFileSync(file, data);
    }
}

async function convertMarkdown(input, fout, format, zip) {
    // possibly split paras
    let paras = (typeof input == 'string') ? input.split('\n\n') : input;

    // render to output format
    if (format == 'latex' || format == 'tex') {
        let latex = await createLatex(paras);
        let title = latex.title ?? 'untitled.tex';
        if (zip) {
            let buffs = convertItems([
                [title, 'application/x-latex', latex.data],
                ...latex.imgs
            ]);
            let zzip = createZip(buffs);
            zzip.writeZip(fout);
        } else {
            writeOrPrint(latex.data, fout);
        }
    } else if (format == 'markdown' || format == 'md') {
        let mark = await createMarkdown(paras);
        let title = mark.title ?? 'untitled.md';
        if (zip) {
            let buffs = convertItems([
                [title, 'text/markdown', mark.data],
                ...mark.imgs
            ]);
            let zzip = createZip(buffs);
            zzip.writeZip(fout);
        } else {
            writeOrPrint(mark.data, fout);
        }
    } else {
        console.log(`unrecognized format: ${format}`);
    }
}
