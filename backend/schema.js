export { initSchemas }

import { Sequelize, DataTypes, Model } from '@sequelize/core'

const options = {
    freezeTableName: true,
    timestamps: false,
};

const time_cols = {
    create_time: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    delete_time: DataTypes.DATE,
};

const schema_article = {
    aid: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    title: DataTypes.TEXT,
    short_title: DataTypes.TEXT,
    blurb: DataTypes.TEXT,
    g_ref: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    last_edit: DataTypes.DATE,
    ...time_cols
};

const schema_paragraph = {
    rid: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    aid: DataTypes.INTEGER,
    pid: DataTypes.INTEGER,
    text: DataTypes.TEXT,
    ...time_cols
};

const schema_paralink = {
    lid: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    aid: DataTypes.INTEGER,
    pid: DataTypes.INTEGER,
    prev: DataTypes.INTEGER,
    next: DataTypes.INTEGER,
    ...time_cols
};

const schema_image = {
    iid: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    key: DataTypes.TEXT,
    keywords: DataTypes.TEXT,
    mime: DataTypes.TEXT,
    data: DataTypes.BLOB,
    ...time_cols
};

async function initSchemas(db_path) {
    const sequelize = new Sequelize(`sqlite://${db_path}`);
    const opts = { sequelize, ...options };
    const Article = sequelize.define('article', schema_article, opts);
    const Paragraph = sequelize.define('paragraph', schema_paragraph, opts);
    const Paralink = sequelize.define('paralink', schema_paralink, opts);
    const Image = sequelize.define('image', schema_image, opts);
    await sequelize.sync();
    return { Article, Paragraph, Paralink, Image }
}
