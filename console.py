#! /usr/bin/env python

# elltwo admin console

import os
import getpass
import fire
import toml

from elltwo.tools import gen_auth
from elltwo.convert import convert_latex
import elltwo.query as dbq
import elltwo.schema as dbs

def confirm_request(question):
    prompt = '[y/N]'
    response = input(f'{question} [y/N]: ').lower()
    return response == 'y'

def art_summary(art, time=False):
    if time:
        return f'{art.aid} [{art.create_time} → {art.delete_time}]: {art.title} ({art.short_title})'
    else:
        return f'{art.aid}: {art.title} ({art.short_title})'

def para_summary(para, time=False):
    if time:
        return f'{para.pid}/{para.rid} [{para.create_time} → {para.delete_time}]: {para.text}'
    else:
        return f'{para.pid}: {para.text}'

def img_summary(img, time=False):
    ret = f'{img.key} ({img.mime}): {len(img.data)} bytes'
    if time:
        ret += f' [{img.create_time} → {img.delete_time}]'
    return ret

def bib_summary(bib, full=False, time=False):
    if time:
        time_text = f' [{bib.create_time} → {bib.delete_time}]'
    else:
        time_text = ''
    if full:
        summ_text = '\n' + '\n'.join([f'{col} = {getattr(bib, col)}' for col in dbq.bib_cols if col != 'raw'])
    else:
        summ_text = f' {bib.author} ({bib.year})'
    return f'{bib.citekey}{time_text}:{summ_text}'

def ref_summary(ref, time=False):
    if time:
        return f'{ref.key}/{ref.cite_env} ({ref.aid}) [{ref.create_time} → {ref.delete_time}]: {ref.ref_text}'
    else:
        return f'{ref.key}/{ref.cite_env} ({ref.aid}): {ref.ref_text}'

def art_find(edb, aid=None, title=None, all=False):
    if aid is not None:
        art = edb.get_art(aid, all=all)
    elif title is not None:
        art = edb.get_art_short(title, all=all)
    else:
        art = None
    return art

class Config:
    def auth(self, path, overwrite=False):
        if overwrite or not os.path.exists(path) or confirm_request(f'overwrite {path}?'):
            with open(path, 'w+') as fid:
                auth = gen_auth()
                toml.dump(auth, fid)

class User:
    def __init__(self, edb):
        self.edb = edb

    def list(self):
        for u in self.edb.get_all_users():
            print(u)

    def create(self, email, name=None, password=None, confirm=True):
        if name is None:
            name, _ = email.split('@')
        if password is None:
            password = getpass.getpass()
        else:
            password = str(password)
        self.edb.add_user(email, name, password, confirm=confirm)

    def delete(self, email):
        if confirm_request('delete user?'):
            if self.edb.del_user(email):
                print(f'{email} deleted')
            else:
                print(f'{email} not found')

class Article:
    def __init__(self, edb):
        self.edb = edb

    def list(self, all=False):
        if all:
            arts = self.edb.getall(dbs.Article)
            print('\n'.join([art_summary(a, time=True) for a in arts]))
        else:
            arts = self.edb.get_arts()
            print('\n'.join([art_summary(a) for a in arts]))

    def show(self, aid=None, title=None, all=False):
        if (art := art_find(self.edb, aid=aid, title=title, all=all)) is None:
            print(f'Article "{title}" not found')
            return

        head = art_summary(art)
        if all:
            paras = self.edb.getall(dbs.Paragraph, aid=art.aid)
            body = [p for p in paras if p.delete_time is None]
            tail = [p for p in paras if p.delete_time is not None]
            tail = sorted(tail, key=lambda p: p.create_time)
        else:
            body = self.edb.get_paras(art.aid)
            tail = []

        print(head)
        print('='*len(head))
        print('\n'.join([para_summary(p, time=all) for p in body]))
        print('='*len(head))
        print('\n'.join([para_summary(p, time=all) for p in tail]))

    def text(self, aid=None, title=None, all=False):
        art = art_find(self.edb, aid=aid, title=title, all=all)
        paras = self.edb.get_paras(art.aid)
        print('\n\n'.join([p.text for p in paras]))

    def create(self, title):
        short = dbq.urlify(title)
        if (art := self.edb.get_art_short(short)) is not None:
            print(f'Article "{short}" already exists')
        else:
            self.edb.create_article(title)

    def rekey(self, new_short, aid=None, title=None, all=False):
        if (art := art_find(self.edb, aid=aid, title=title, all=all)) is None:
            print(f'Article "{title}" not found')
            return
        self.edb.rename_short(art.aid, new_short)

    def rename(self, new_title, aid=None, title=None, all=False):
        if (art := art_find(self.edb, aid=aid, title=title, all=all)) is None:
            print(f'Article "{title}" not found')
            return
        self.edb.rename_article(art.aid, new_title)

    def delete(self, aid=None, title=None):
        if (art := art_find(self.edb, aid=aid, title=title, all=False)) is None:
            print(f'Article "{title}" not found')
            return
        elif confirm_request(f'delete article "{title}"?'):
            self.edb.delete_article(art.aid)

    def undelete(self, aid=None, title=None):
        if (art := art_find(self.edb, aid=aid, title=title, all=True)) is None:
            print(f'Article "{title}" not found')
            return
        elif confirm_request(f'undelete article "{title}"?'):
            self.edb.undelete_article(art.aid)

    def purge(self, aid=None, title=None):
        if (art := art_find(self.edb, aid=aid, title=title, all=True)) is None:
            print(f'Article "{title}" not found')
        elif confirm_request(f'purge article "{art.short_title}"?'):
            self.edb.purge_article(art.aid)

class Paragraph:
    def __init__(self, edb):
        self.edb = edb

    def show(self, pid):
        para = self.edb.get_para(pid)
        if para is None:
            print(f'paragraph {pid} not found (try "hist")')
        else:
            print(para_summary(para))

    def hist(self, pid):
        coms = self.edb.getall(dbs.Paragraph, pid=pid)
        coms = sorted(coms, key=lambda c: c.create_time)
        print('\n'.join([para_summary(p, time=True) for p in coms]))

class Image:
    def __init__(self, edb):
        self.edb = edb

    def list(self, all=False):
        if all:
            imgs = self.edb.getall(dbs.Image)
            print('\n'.join([img_summary(i, time=True) for i in imgs]))
        else:
            imgs = self.edb.get_images()
            print('\n'.join([img_summary(i) for i in imgs]))

    def show(self, key):
        if (img := self.edb.get_image(key)) is None:
            print(f'Image "{key}" not found')
        else:
            print(img_summary(img))
            if img.mime.startswith('text/svg'):
                print(img.data.decode())

    def delete(self, key):
        if (img := self.edb.get_image(key)) is None:
            print(f'Image "{key}" not found')
        elif confirm_request(f'delete image "{key}"?'):
            self.edb.delete_image(key)

    def purge(self, key):
        if len(self.edb.get_image(key, all=True)) == 0:
            print(f'Image "{key}" not found')
        elif confirm_request(f'purge image "{key}"?'):
            self.edb.purge_image(key)

    def prune(self, key):
        print('Not implemented')

class Index:
    def __init__(self, edb):
        self.edb = edb

    def regen(self):
        self.edb.reindex_articles()

    def title(self, query):
        arts = self.edb.search_title(query)
        for a in arts:
            print(a)

    def paras(self, query):
        paras = self.edb.search_text(query)
        for p in paras:
            print(p)

class Biblio:
    def __init__(self, edb):
        self.edb = edb

    def list(self, all=False):
        for b in self.edb.get_bib(all=all):
            print(bib_summary(b, time=all))

    def show(self, key, all=False):
        bib = self.edb.get_cite(key, all=all)
        print(bib_summary(bib, full=True, time=all))

class Reference:
    def __init__(self, edb):
        self.edb = edb

    def list(self, aid=None, all=False):
        for r in self.edb.get_all_refs(aid=aid, all=all):
            print(ref_summary(r, time=all))

class Backup:
    def __init__(self, edb):
        self.edb = edb

    def save(self, out, all=False, zip=False):
        if (
            not os.path.exists(out) or
            confirm_request(f'file "{out}" exists, overwrite?')
        ):
            self.edb.save_articles(out, all=all, zip=zip)

    def load(self, inp, zip=False):
        if (
            not os.path.exists(self.edb.path) or
            confirm_request(f'database "{self.edb.path}" exists, load anyway?')
        ):
            self.edb.create()
            self.edb.load_articles(inp, zip=zip)

class Ingest:
    def __init__(self, edb):
        self.edb = edb

    def markdown(self, path, title=None):
        if title is None:
            _, fname = os.path.split(path)
            title, _ = os.path.splitext(fname)
        if (art := self.edb.get_art_short(title)) is not None:
            print(f'Article "{title}" already exists')
        else:
            with open(path) as fid:
                mark = fid.read()
            self.edb.import_markdown(title, mark)

    def latex(self, path, out=None):
        with open(path) as fid:
            tex = fid.read()
        mark = convert_latex(tex)
        if out is None:
            print('Output:')
            print(mark)
        else:
            with open(out, 'w+') as fout:
                fout.write(mark)

class Main:
    def __init__(self, db='elltwo.db'):
        edb = dbq.ElltwoDB(path=db)
        edb.path = db

        self.config = Config()
        self.user = User(edb=edb)
        self.article = self.art = Article(edb=edb)
        self.paragraph = self.par = Paragraph(edb=edb)
        self.image = self.img = Image(edb=edb)
        self.index = self.idx = Index(edb=edb)
        self.biblio = self.bib = Biblio(edb=edb)
        self.reference = self.ref = Reference(edb=edb)
        self.backup = Backup(edb=edb)
        self.ingest = Ingest(edb=edb)

if __name__ == '__main__':
    fire.Fire(Main)
