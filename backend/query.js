export { getAid, getImage, articleText }

import { Op } from '@sequelize/core'

function timeSelect(time) {
    time = time ?? new Date();
    return {
        create_time: { [Op.lte]: time },
        delete_time: { [Op.or]: [
            { [Op.is]: null },
            { [Op.gt]: time }
        ] },
    };
}

function linkSort(links) {
    let [p] = links.filter(p => p.prev == null);
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
    let art = await db.Article.findOne({ where: { short_title: title } });
    return art.aid;
}

async function articleText(db, aid, time) {
    let links = await db.Paralink.findAll({
        where: { aid: aid, ...timeSelect(time) }
    });
    let layout = linkSort(links).map(p => p.pid);
    let paras = await db.Paragraph.findAll({ where: { pid: layout } });
    let ptext = new Map(paras.map(p => [p.pid, p.text]));
    return layout.map(p => ptext.get(p));
}

async function getImage(db, key, time) {
    let image = await db.Image.findOne({
        where: { key: key, ...timeSelect(time) }
    });
    return image;
}
