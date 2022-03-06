import AdmZip from 'adm-zip'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import * as NodeBuffer from 'node:buffer'
import * as fs from 'node:fs'
import { program } from 'commander'
import { createMarkdown, createLatex } from './static/js/export.js'
import { cache } from './static/js/state.js'
import { DummyCache } from './static/js/utils.js'
let { Buffer } = NodeBuffer;

// TODO: use sequelize as ORM

// dummy cache for images (TODO: link this to database)
cache.img = new DummyCache();

// convert markdown file
program
    .command('convert')
    .argument('<string>', 'input file')
    .option('-o, --out <path>', 'output file')
    .option('-f, --format <format>', 'output file format', 'latex')
    .option('-z, --zip', 'zip output')
    .action(async function(fin, options) {
        let input = fs.readFileSync(fin, 'utf8');
        await convertMarkdown(input, options.out, options.format, options.zip);
    });

// export elltwo article
program
    .command('export')
    .option('--db <path>', 'database to use', 'elltwo.db')
    .option('-i, --aid <aid>', 'article id')
    .option('-t, --title <title>', 'article title')
    .option('-o, --out <path>', 'output file')
    .option('-f, --format <format>', 'output file format', 'latex')
    .option('-z, --zip', 'zip output')
    .action(async function(options) {
        let db = await openDb(options.db);
        let aid = options.aid ?? await getAid(db, options.title);
        let input = await articleText(db, aid);
        convertMarkdown(input, options.out, options.format, options.zip);
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

async function openDb(dbpath) {
    return await open({filename: dbpath, driver: sqlite3.Database});
}

function d(date) {
    return (date != null) ? new Date(date) : null;
}

function filterByTime(rows, time) {
    time = d(time) ?? Date();
    let tlim = rows.map(r => [d(r.create_time), d(r.delete_time)]);
    return rows.filter(r =>
        r.create_time <= time &&
        (r.delete_time == null || r.delete_time > time)
    );
}

function find_start(links) {
    return links.filter(p => p.prev == null)[0];
}

function link_sort(links) {
    let p = find_start(links);
    if (p == null) { return null; }

    let map = new Map(links.map(q => [q.pid, q]));
    let ret = [];

    while (p != null) {
        map.delete(p.pid);
        ret.push(p);
        p = map.get(p.next);
    }

    return ret;
}

async function getAid(db, title) {
    let art = await db.get(`SELECT * FROM article WHERE short_title="${title}"`);
    return art.aid;
}

async function articleText(db, aid, time) {
    let links = await db.all(`SELECT * FROM paralink WHERE aid="${aid}"`);
    let layout = link_sort(filterByTime(links, time)).map(p => p.pid);
    let paras = await db.all(`SELECT * FROM paragraph WHERE pid IN (${layout.join(', ')})`);
    let pmap = new Map(paras.map(p => [p.pid, p.text]));
    return layout.map(p => pmap.get(p));
}

async function convertMarkdown(input, fout, format, zip) {
    // split paras
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
