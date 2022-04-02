import re, os, toml
from math import ceil
from datetime import datetime
from functools import partial
from operator import itemgetter
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile

from sqlalchemy import create_engine, or_, and_, distinct, event
from sqlalchemy.sql import func
from sqlalchemy.orm import sessionmaker, Query
from werkzeug.security import generate_password_hash, check_password_hash

from .schema import Base, Article, Paragraph, Paralink, Bib, ExtRef, Image, User, TextShard, Tag
from .tools import Multimap

##
## image mime data
##

img_mime = Multimap({
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/svg+xml': ['svg'],
})

##
## table export
##

bib_meta = ['bid', 'create_time', 'delete_time', 'citekey']
bib_cols = [
    col.name for col in Bib.__table__.columns if col.name not in bib_meta
]

usr_meta = ['id', 'registered_on', 'confirmed_on']
usr_cols = [
    col.name for col in User.__table__.columns if col.name not in usr_meta
]

def row_dump(row, cols, string=False):
    data = {col: getattr(row, col) for col in cols}
    if string:
        return toml.dumps(data)
    else:
        return data

def table_dump(rows, index, cols, string=False):
    data = {
        getattr(row, index): {
            col: getattr(row, col) for col in cols
        } for row in rows
    }
    if string:
        return toml.dumps(data)
    else:
        return data

##
## utility methods
##

def intime(time, klass):
    return and_(
        klass.create_time <= time,
        or_(
            klass.delete_time == None,
            klass.delete_time > time
        )
    )
arttime = partial(intime, klass=Article)
partime = partial(intime, klass=Paragraph)
lintime = partial(intime, klass=Paralink)
bibtime = partial(intime, klass=Bib)
reftime = partial(intime, klass=ExtRef)
tagtime = partial(intime, klass=Tag)
imgtime = partial(intime, klass=Image)

def find_start(links):
    for p in links:
        if p.prev is None:
            return p

def link_sort(links):
    if (p := find_start(links)) is None:
        return
    else:
        yield p.pid
    index = {q.pid: q for q in links if q is not p}
    while (p := index.pop(p.next, None)) is not None:
        yield p.pid

def splice_link(lin, time, **kwargs):
    props = {**dict(pid=lin.pid, prev=lin.prev, next=lin.next), **kwargs}
    lin.delete_time = time
    return Paralink(aid=lin.aid, create_time=time, **props)

def urlify(s):
    return re.sub(r'\W', '_', s).lower()

# aggregate new links into contiguous placing instructions
# (a, b) → put a after b
def order_links(links, single=True):
    groups = []
    for lin in links.values():
        pi, pr, nx = lin
        glo, ghi = None, None
        for gr in groups:
            _, lo, _ = gr[0]
            _, _, hi = gr[-1]
            if lo == pi and lo is not None:
                ghi = gr
            if hi == pi and hi is not None:
                glo = gr
        if glo is not None and ghi is None:
            glo.append(lin)
        elif ghi is not None and glo is None:
            ghi.insert(0, lin)
        elif glo is not None and ghi is not None:
            groups.remove(ghi)
            glo.append(lin)
            glo.extend(ghi)
        else:
            groups.append([lin])
    if single:
        groups = [[(pi, pr) for pi, pr, _ in gr[:-1]] for gr in groups]
    return sum(groups, [])

##
## indexing functions
##

def shardify(s):
    shgen = zip(*[s[k:len(s)-(2-k)] for k in range(3)])
    return [(''.join(x), i) for i, x in enumerate(shgen)]

def shardify_document(doc):
    words = [f' {w} ' for w in doc.lower().split()]
    return {i: shardify(w) for i, w in enumerate(words)}

def shard_compress(shards):
    count = defaultdict(int)
    posit = defaultdict(int)
    for t, i in shards:
        count[t] += 1
        posit[t] += i
    return {t: (posit[t]/count[t], count[t]) for t in count}

def dist_score(p1, p2):
    return max(0.75, 1/(1+0.25*abs(p1-p2)))

def shard_score(shards1, shards2):
    score = 0
    ntoks = 0
    for t, (p1, c1) in shards1.items():
        ntoks += c1
        if t in shards2:
            p2, c2 = shards2[t]
            score += min(c1, c2)*dist_score(p1, p2)
    return score/ntoks

# CES: constant elasticity of substitution
# σ = 1 → sum
# σ = ∞ → max
def ces(v, σ=2):
    return sum(x**σ for x in v)**(1/σ)

##
## db interface
##

class ElltwoDB:
    def __init__(self, db=None, path='elltwo.db', uri=None, create=False, reindex=False):
        if db is None:
            if uri is None:
                uri = f'sqlite:///{path}'

            self.engine = create_engine(uri)
            Session = sessionmaker(bind=self.engine)
            self.session = Session()
        else:
            self.engine = db.engine
            self.session = db.session

        if create:
            self.create()

        if reindex:
            self.reindex_articles()

    def create(self):
        Base.metadata.create_all(bind=self.engine)

    ##
    ## diagnostic tools
    ##

    def getall(self, klass, disp=False, **kwargs):
        ret = self.session.query(klass).filter_by(**kwargs).all()
        if disp:
            print('\n'.join([str(x) for x in ret]))
        else:
            return ret

    def reset(self, time, klass=None):
        if klass is None:
            reset(time, klass=Article)
            reset(time, klass=Paragraph)
            reset(time, klass=Paralink)
        else:
            for k in self.session.query(klass).filter(klass.create_time > time).all():
                self.session.delete(k)
            for k in self.session.query(klass).filter(klass.delete_time > time).all():
                k.delete_time = None
            self.session.commit()

    def purge_article(self, aid, klass=None, commit=True):
        if klass is None:
            self.purge_article(aid, klass=Article, commit=False)
            self.purge_article(aid, klass=Paragraph, commit=False)
            self.purge_article(aid, klass=Paralink, commit=False)
            self.purge_article(aid, klass=ExtRef, commit=False)
        else:
            self.session.query(klass).filter_by(aid=aid).delete()
        if commit:
            self.session.commit()

    ##
    ## bulk save/load
    ##

    def save_articles(self, out, image=True, cite=True, user=True, all=False, zip=False):
        base = Path(out)
        if not zip and not os.path.isdir(base):
            if os.path.exists(base):
                return False
            else:
                os.mkdir(base)

        if zip:
            zf = ZipFile(out, 'w')
            def writer(n, d):
                zf.writestr(n, d)
        else:
            def writer(n, d):
                mode = 'wb' if type(d) is bytes else 'w'
                with open(base / n, mode) as fid:
                    fid.write(d)

        for art in self.get_arts(all=all):
            name = f'{art.short_title}.md'
            text = self.get_art_text(art.aid, strip=True)
            writer(name, text)

        if image:
            for img in self.get_images(all=all):
                if not img_mime.has(img.mime):
                    continue
                ext, *_ = img_mime.get(img.mime)
                name = f'{img.key}.{ext}'
                writer(name, img.data)

        if cite:
            rows = self.get_bib(all=all)
            text = table_dump(rows, 'citekey', bib_cols, string=True)
            writer('cite.toml', text)

        if user:
            rows = self.get_all_users()
            text = table_dump(rows, 'email', usr_cols, string=True)
            writer('user.toml', text)

        if zip:
            zf.close()

        return True

    def load_articles(self, inp, zip=False):
        base = Path(inp)
        if not zip and not os.path.isdir(base):
            return False

        if zip:
            zf = ZipFile(inp)
            files = zf.namelist()
            def reader(n, m='t'):
                d = zf.read(n)
                return d.decode() if m == 't' else d
        else:
            files = os.listdir(base)
            def reader(n, m='t'):
                with open(base / n, f'r{m}') as fid:
                    return fid.read()

        for name in files:
            short, ext = os.path.splitext(name)
            ext = ext[1:]

            if ext == 'md':
                mark = reader(name)
                self.import_markdown(
                    short, mark, index=False, commit=False
                )
            elif (mime := img_mime.loc(ext)) is not None:
                data = reader(name, 'b')
                self.create_image(short, mime, data)
            elif name == 'cite.toml':
                data = reader(name)
                biblio = toml.loads(data)
                for key, cite in biblio.items():
                    self.create_cite(key, **cite)
            elif name == 'user.toml':
                data = reader(name)
                users = toml.loads(data)
                for email, info in users.items():
                    self.add_user(
                        email, info['name'], phash=info['password'],
                        confirm=info['confirmed']
                    )

        if zip:
            zf.close()

        self.session.commit()
        self.reindex_articles()
        return True

    ##
    ## query methods
    ##

    def get_links(self, aid, time=None):
        if time is None:
            time = datetime.utcnow()
        query = (self.session
            .query(Paralink)
            .filter_by(aid=aid)
            .filter(lintime(time))
        )
        return query.all()

    def get_pids(self, aid, time=None):
        links = self.get_links(aid, time=time)
        return list(link_sort(links))

    def get_paras(self, aid, pids=None, time=None):
        if time is None:
            time = datetime.utcnow()

        if pids is None:
            pids = self.get_pids(aid, time=time)

        query = (self.session
            .query(Paragraph)
            .filter_by(aid=aid)
            .filter(partime(time))
            .filter(Paragraph.pid.in_(pids))
        )
        paras = query.all()

        index = {p.pid: p for p in paras}
        return [index[p] for p in pids]

    def get_art_title(self, aid):
        art = self.session.query(Article).filter_by(aid=aid).one_or_none()
        return art.short_title

    def get_art_titles(self, aids=None, time=None):
        if time is None:
            time = datetime.utcnow()

        query = self.session.query(Article)
        if aids is not None:
            query = query.filter(Article.aid.in_(aids))
        query = query.filter(arttime(time))

        return {
            art.aid: art.short_title for art in query.all()
        }

    def get_arts(self, time=None, all=False):
        if time is None:
            time = datetime.utcnow()
        query = self.session.query(Article)
        if not all:
            query = query.filter(arttime(time))
        return query.all()

    def get_recent_arts(self, time=None, n=1):
        if time is None:
            time = datetime.utcnow()
        query = (self.session.query(Article)
            .filter(arttime(time))
            .filter(Article.last_edit.isnot(None))
            .order_by(Article.last_edit.desc())
            .limit(n))
        return query.all()

    def get_art(self, aid, time=None, all=False):
        if time is None:
            time = datetime.utcnow()
        query = self.session.query(Article).filter_by(aid=aid)
        if not all:
            query = query.filter(arttime(time))
        return query.one_or_none()

    def get_art_short(self, short, time=None, all=False):
        if time is None:
            time = datetime.utcnow()
        short_match = urlify(short)
        query = self.session.query(Article).filter_by(short_title=short_match)
        if not all:
            query = query.filter(arttime(time))
        return query.one_or_none()

    def get_art_text(self, aid, time=None, strip=False):
        if time is None:
            time = datetime.utcnow()
        paras = [p.text for p in self.get_paras(aid, time=time)]
        if strip:
            paras = [re.sub('\n{2,}', '\n', p).strip('\n') for p in paras]
        return '\n\n'.join(paras)

    def get_para(self, pid, time=None):
        if time is None:
            time = datetime.utcnow()
        return (self.session
            .query(Paragraph)
            .filter_by(pid=pid)
            .filter(partime(time))
            .one_or_none()
        )

    def get_link(self, pid, time=None):
        if time is None:
            time = datetime.utcnow()
        return (self.session
            .query(Paralink)
            .filter_by(pid=pid)
            .filter(lintime(time))
            .one_or_none()
        )

    def get_lid(self, lid):
        return self.session.query(Paralink).filter_by(lid=lid).one_or_none()

    def search_title(self, words, taglist, thresh=0.25):
        now = datetime.utcnow()
        match = [
            i for i, s in self.search_index(words, dtype='title') if s > thresh
        ]
        tag_rank = self.get_tag_rank(taglist)
        #lexico sort on number of tag matchs, closeness of title, revesed here
        arts = sorted(list(tag_rank.keys()),
            key=lambda a: (len(tag_rank[a]), match.index(a) if a in match else -1),
            reverse=True
        )
        aids = [art.aid for art in arts]
        aids += match

        arts = (self.session
            .query(Article)
            .filter(Article.aid.in_(aids))
            .filter(arttime(now))
            .all()
        )
        return {'arts': sorted(arts, key=lambda a: aids.index(a.aid)), 'tags': tag_rank}

    def search_text(self, words, thresh=0.25):
        now = datetime.utcnow()
        match = [
            i for i, s in self.search_index(words, dtype='para') if s > thresh
        ]
        paras = (self.session
            .query(Paragraph)
            .filter(Paragraph.pid.in_(match))
            .filter(partime(now))
            .all()
        )
        #reversed here
        return sorted(paras, key=lambda a: match.index(a.pid), reverse=True)

    ##
    ## editing methods
    ##

    def create_pid(self):
        pmax = self.session.query(func.max(Paragraph.pid)).scalar()
        return pmax + 1 if pmax is not None else 0

    def update_para(self, pid, text, time=None):
        if time is None:
            time = datetime.utcnow()

        if (par := self.get_para(pid, time=time)) is None:
            return

        par.delete_time = time

        art = self.get_art(par.aid)
        art.last_edit = time

        par1 = Paragraph(aid=par.aid, pid=par.pid, create_time=time, text=text)
        self.session.add(par1)

        self.session.commit()

    def bulk_update(self, para_dict, time=None):
        if time is None:
            time = datetime.utcnow()

        for pid, text in para_dict.items():
            self.update_para(pid, text, time=time)

    def insert_after(self, pid, text='', time=None, commit=True):
        if time is None:
            time = datetime.utcnow()

        if (par := self.get_para(pid, time=time)) is None:
            return
        if (lin := self.get_link(pid, time=time)) is None:
            return

        linn = self.get_link(lin.next, time=time)

        pid1 = self.create_pid()
        par1 = Paragraph(aid=par.aid, pid=pid1, text=text, create_time=time)
        self.session.add(par1)

        lin0 = Paralink(aid=par.aid, pid=par1.pid, prev=pid, next=lin.next, create_time=time)
        self.session.add(lin0)

        lin1 = splice_link(lin, time, next=par1.pid)
        self.session.add(lin1)

        if linn is not None:
            linn1 = splice_link(linn, time, prev=par1.pid)
            self.session.add(linn1)

        if commit:
            self.session.commit()

        return par1

    def insert_before(self, pid, text='', time=None, commit=True):
        if time is None:
            time = datetime.utcnow()

        if (par := self.get_para(pid, time=time)) is None:
            return
        if (lin := self.get_link(pid, time=time)) is None:
            return

        linp = self.get_link(lin.prev, time=time)

        pid1 = self.create_pid()
        par1 = Paragraph(aid=par.aid, pid=pid1, text=text, create_time=time)
        self.session.add(par1)

        lin0 = Paralink(aid=par.aid, pid=par1.pid, prev=lin.prev, next=pid, create_time=time)
        self.session.add(lin0)

        lin1 = splice_link(lin, time, prev=par1.pid)
        self.session.add(lin1)

        if linp is not None:
            linp1 = splice_link(linp, time, next=par1.pid)
            self.session.add(linp1)

        if commit:
            self.session.commit()

        return par1

    def move_para(self, aid, drag_pid, targ_pid, time=None):

        if time is None:
            time = datetime.utcnow()

        ## delete links associated with inital drag pos 
        if (drag_lin := self.get_link(drag_pid, time=time)) is None:
            return

        d_linp = self.get_link(drag_lin.prev, time)
        d_linn = self.get_link(drag_lin.next, time)

        #splice
        if d_linp is not None:
            d_linp1 = splice_link(d_linp, time, next=drag_lin.next)
            self.session.add(d_linp1)
        if d_linn is not None:
            d_linn1 = splice_link(d_linn, time, prev=drag_lin.prev)
            self.session.add(d_linn1)

        #commit (drag para is now unlinked)
        self.session.commit()


        #insert dragged para after target
        if (targ_lin := self.get_link(targ_pid, time=time)) is None:
            return

        t_linn = self.get_link(targ_lin.next, time)

        d_lin1 = splice_link(drag_lin, time, prev=targ_pid, next=targ_lin.next)
        t_lin1 = splice_link(targ_lin, time, next=drag_pid)
        self.session.add(t_lin1)
        self.session.add(d_lin1)

        ##clean up next para link 
        if t_linn is not None:
            linn1 = splice_link(t_linn, time, prev=drag_pid)
            self.session.add(linn1)

        self.session.commit()
        return True



    def paste_after(self, pid, adds, time=None):
        if time is None:
            time = datetime.utcnow()

        if (par := self.get_para(pid, time=time)) is None:
            return

        pid_map = []
        pid_cur = pid
        for raw in adds:
            new_para = self.insert_after(pid_cur, raw, time=time, commit=False)
            pid_map.append([new_para.pid, raw])
            pid_cur = new_para.pid

        self.session.commit()

        return pid_map

    def delete_para(self, pid, time=None, commit=True):
        if time is None:
            time = datetime.utcnow()

        if (par := self.get_para(pid, time=time)) is None:
            return
        if (lin := self.get_link(pid, time=time)) is None:
            return

        linp = self.get_link(lin.prev, time)
        linn = self.get_link(lin.next, time)

        par.delete_time = time
        lin.delete_time = time

        if linp is not None:
            linp1 = splice_link(linp, time, next=lin.next)
            self.session.add(linp1)
        if linn is not None:
            linn1 = splice_link(linn, time, prev=lin.prev)
            self.session.add(linn1)

        if commit:
            self.session.commit()

    def delete_paras(self, pids, time=None):
        if time is None:
            time = datetime.utcnow()
        for p in pids:
            self.delete_para(p, time=time, commit=False)
        self.session.commit()

    ##
    ## article methods
    ##

    def first_para(self, aid):
        return self.session.query(Paralink).filter_by(aid=aid).filter_by(prev=None).one_or_none()

    def last_para(self, aid):
        return self.session.query(Paralink).filter_by(aid=aid).filter_by(next=None).one_or_none()

    def create_article(self, title, short_title=None, init=True, time=None, g_ref=False, index=True):
        if time is None:
            time = datetime.utcnow()

        if short_title is None:
            short_title = title
        short_title = urlify(short_title)

        if self.get_art_short(short_title) is not None:
            return None

        art = Article(title=title, short_title=short_title, create_time=time, g_ref=g_ref)
        self.session.add(art)
        self.session.commit()

        if init:
            self.init_article(art.aid, text=f'#! {title}', time=time)

        if index:
            self.index_document('title', art.aid, title)

        return art

    def rename_short(self, aid, short_title):
        short = urlify(short_title)
        if (art := self.get_art(aid)) is None:
            return False
        if self.get_art_short(short) is not None:
            return False
        art.short_title = short
        self.session.commit()
        return True

    def rename_article(self, aid, title):
        if (art := self.get_art(aid)) is None:
            return False
        art.title = title
        self.index_document('title', aid, title, clear=True, commit=False)
        self.session.commit()

    def delete_article(self, aid, time=None):
        if time is None:
            time = datetime.utcnow()
        if (art := self.get_art(aid)) is not None:
            art.delete_time = time
            self.unindex_document('title', art.aid, commit=False)
            self.session.commit()

    def undelete_article(self, aid, time=None):
        if time is None:
            time = datetime.utcnow()
        if (art := self.get_art(aid, all=True)) is not None:
            art.delete_time = None
            self.index_document('title', art.aid, art.title, commit=False)
            self.session.commit()

    def init_article(self, aid, text, time=None):
        if time is None:
            time = datetime.utcnow()

        pid = self.create_pid()
        par = Paragraph(aid=aid, pid=pid, text=text, create_time=time)
        lin = Paralink(aid=aid, pid=pid, prev=None, next=None, create_time=time)

        self.session.add_all([par, lin])
        self.session.commit()

    def insert_begin(self, aid, text, time=None):
        if time is None:
            time = datetime.utcnow()

        if (par := self.first_para(aid)) is None:
            self.init_article(aid, text, time=time)
        else:
            self.insert_before(par.pid, text, time=time)

    def insert_end(self, aid, text, time=None):
        if time is None:
            time = datetime.utcnow()

        if (par := self.last_para(aid)) is None:
            self.init_article(aid, text, time=time)
        else:
            self.insert_after(par.pid, text, time=time)

    def set_blurb(self, aid, blurb):
        art = self.session.query(Article).filter_by(aid=aid).one_or_none()
        if art:
            art.blurb = blurb
            self.session.add(art)
            self.session.commit()

    def import_markdown(self, short_title, mark, title=None, time=None, index=True, commit=True):
        if time is None:
            time = datetime.utcnow()

        if title is None:
            if (ret := re.match('#! +([^\n]+)', mark)) is not None:
                title, = ret.groups()
            else:
                title = short_title.replace('_', ' ').title()

        art = self.create_article(
            title, short_title=short_title, init=False, time=time, g_ref=True, index=index
        )
        aid = art.aid

        paras = re.sub(r'\n{3,}', '\n\n', mark).strip('\n').split('\n\n')
        n_par, max_pid = len(paras), self.create_pid()
        pids = list(range(max_pid, max_pid + n_par))

        for i, (pid, ptxt) in enumerate(zip(pids, paras)):
            prev = None if i == 0 else pids[i-1]
            next = None if i == n_par - 1 else pids[i+1]
            par = Paragraph(aid=aid, pid=pid, text=ptxt, create_time=time)
            lin = Paralink(aid=aid, pid=pid, prev=prev, next=next, create_time=time)
            self.session.add_all([par, lin])

        if commit or index:
            self.session.commit()

        if index:
            self.reindex_article(art.aid)

    ##
    ## citation methods
    ##

    def create_cite(self, citekey, entry_type, raw='', **kwargs):
        now = datetime.utcnow()

        if (bib := self.get_cite(citekey, time=now)) is not None:
            bib.delete_time = now
            self.session.add(bib)
            create = False
        else:
            create = True

        cite = Bib(citekey=citekey, entry_type=entry_type, create_time=now, raw=raw, **kwargs)
        self.session.add(cite)
        self.session.commit()

        return create

    def delete_cite(self, citekey):
        now = datetime.utcnow()

        if (bib := self.get_cite(citekey)) is None:
            return

        bib.delete_time = now
        self.session.add(bib)
        self.session.commit()

    def get_cite(self, citekey, time=None, all=False, dump=False):
        if time is None:
            time = datetime.utcnow()

        query = self.session.query(Bib).filter_by(citekey=citekey)
        if not all:
            query = query.filter(bibtime(time))

        ret = query.one_or_none()
        if dump and ret is not None:
            return row_dump(ret, bib_cols)
        else:
            return ret

    def get_bib(self, keys=None, time=None, all=False, dump=False):
        if time is None:
            time = datetime.utcnow()

        query = self.session.query(Bib)
        if not all:
            query = query.filter(bibtime(time))
        if keys is not None:
            query = query.filter(Bib.citekey.in_(keys))

        ret = query.all()
        if dump:
            return table_dump(ret, 'citekey', bib_cols)
        else:
            return ret

    def get_bib_keys(self, time=None):
        if time is None:
            time = datetime.utcnow()
        query = self.session.query(Bib).filter(bibtime(time))
        return [b.citekey for b in query.all()]

    ##
    ## exteral references
    ##

    def get_all_refs(self, aid=None, time=None, all=False):
        if time is None:
            time = datetime.utcnow()
        query = self.session.query(ExtRef)
        if aid is not None:
            query = query.filter_by(aid=aid)
        if not all:
            query = query.filter(reftime(time))
        return query.all()

    def get_ref_keys(self, aid, time=None):
        if time is None:
            time = datetime.utcnow()
        query = (self.session
            .query(ExtRef)
            .filter_by(aid=aid)
            .filter(reftime(time))
        )
        return [[r.key , r.cite_env] for r in query.all()]

    def get_ref(self, key, aid, time=None):
        if time is None:
            time = datetime.utcnow()
        return (self.session
            .query(ExtRef)
            .filter_by(aid=aid)
            .filter_by(key=key)
            .filter(reftime(time))
            .one_or_none()
        )

    def create_ref(self, aid, key, cite_type, cite_env, text, ref_text, time=None):
        if time is None:
            time = datetime.utcnow()

        if (ref0 := self.get_ref(key, aid, time=time)) is not None:
            ref0.delete_time = time
            self.session.add(ref0)
            create = False
        else:
            create = True

        ref = ExtRef(
            key=key, aid=aid, cite_type=cite_type, cite_env=cite_env, text=text,
            ref_text=ref_text, create_time=time
        )
        self.session.add(ref)
        self.session.commit()

        return create

    def delete_ref(self, aid, key, time=None):
        if time is None:
            time = datetime.utcnow()

        if (ref := self.get_ref(key, aid)) is None:
            return

        ref.delete_time = time
        self.session.add(ref)
        self.session.commit()

    def update_g_ref(self, aid, g_ref):
        art = self.get_art(aid)
        art.g_ref = g_ref
        self.session.add(art)
        self.session.commit()

    ## and tags

    def get_tag(self, tag, aid, time=None):
        if time is None:
            time = datetime.utcnow()
        return (self.session
            .query(Tag)
            .filter_by(aid=aid)
            .filter_by(tag=tag)
            .filter(tagtime(time))
            .one_or_none()
        )

    def get_tags(self, time=None):
        if time is None:
            time = datetime.utcnow()
        q = (self.session
            .query(Tag.tag.distinct()
            .label("tag"))
            .all()
            )
        return [tag.tag for tag in q]

    def tags_by_art(self, aid, time=None):
        if time is None:
            time = datetime.utcnow()
        q = (self.session
            .query(Tag)
            .filter_by(aid=aid)
            .filter(tagtime(time))
            .all()
        )
        return [t.tag for t in q]

    def arts_by_tag(self, tag, time=None):
        if time is None:
            time = datetime.utcnow()
        return (self.session
            .query(Tag)
            .filter_by(tag=tag)
            .filter(tagtime(time))
            .all()
        )

    def create_tag(self, aid, tag, time=None):
        if time is None:
            time = datetime.utcnow()

        if (tag0 := self.get_tag(tag, aid, time=time)) is not None:
            return
        
        tag = Tag(
            aid=aid, tag=tag, create_time=time
        )
        self.session.add(tag)
        self.session.commit()

    def delete_tag(self, aid, tag, time=None):
        if time is None:
            time = datetime.utcnow()

        if (tag := self.get_ref(tag, aid)) is None:
            return

        tag.delete_time = time
        self.session.add(tag)
        self.session.commit()

    ##
    ## storing images
    ##

    def get_image(self, key, time=None, all=False):
        if time is None:
            time = datetime.utcnow()
        query = self.session.query(Image).filter_by(key=key)
        if all:
            return query.all()
        else:
            return query.filter(imgtime(time)).one_or_none()

    def update_image_key(self, key, new_key=None, new_kw=None, time=None):
        if time is None:
            time = datetime.utcnow()
        if (img := self.get_image(key, time=time)) is not None:
            if new_key is not None:
                img.key = new_key
            if new_kw is not None:
                img.keywords = new_kw
            self.session.add(img)
            self.session.commit()
            return True
        else:
            return False

    def get_images(self, time=None, all=False):
        if time is None:
            time = datetime.utcnow()
        query = self.session.query(Image)
        if not all:
            query = query.filter(imgtime(time))
        return query.all()

    def create_image(self, key, mime, data, time=None):
        if time is None:
            time = datetime.utcnow()
        key = urlify(key)

        if (img0 := self.get_image(key, time=time)) is not None:
            img0.delete_time = time
            self.session.add(img0)

        img = Image(key=key, mime=mime, data=data, create_time=time)
        self.session.add(img)
        self.session.commit()

        return img

    def delete_image(self, key, time=None):
        if time is None:
            time = datetime.utcnow()

        if (img := self.get_image(key)) is None:
            return

        img.delete_time = time
        self.session.add(img)
        self.session.commit()

    def purge_image(self, key):
        if len(imgs := self.get_image(key, all=True)) > 0:
            for img in imgs:
                self.session.delete(img)
            self.session.commit()


    ##
    ## getting differentials
    ##

    def get_commits(self, aid=None, klass=None):
        if klass is None:
            return sorted(set(
                self.get_commits(aid=aid, klass=Paragraph)
              + self.get_commits(aid=aid, klass=Paralink)
            ))
        cond = {'aid': aid} if aid is not None else {}
        paras = self.session.query(klass).filter_by(**cond)
        times = (
            paras.from_self(distinct(klass.create_time)).all()
          + paras.from_self(distinct(klass.delete_time)).all()
        )
        return sorted({t for t, in times} - {None})

    # diff 1 → 2
    def diff_article(self, aid, time2, time1=None):
        if time1 is None:
            time1 = datetime.utcnow()

        # get paragraphs
        paras1 = self.get_paras(aid, time=time1)
        paras2 = self.get_paras(aid, time=time2)
        pids1 = set(p.pid for p in paras1)
        pids2 = set(p.pid for p in paras2)

        # get paralinks
        links1 = self.get_links(aid, time=time1)
        links2 = self.get_links(aid, time=time2)
        lids1 = set(l.lid for l in links1)
        lids2 = set(l.lid for l in links2)

        # get added paras
        pid_add = list(pids2 - pids1)
        para_add = {p.pid: p.text for p in paras2 if p.pid in pid_add}

        # get deleted paras
        pid_del = list(pids1 - pids2)

        # get updated paras
        pid_com = list(pids1 & pids2)
        para1_com = sorted([p for p in paras1 if p.pid in pid_com], key=lambda x: x.pid)
        para2_com = sorted([p for p in paras2 if p.pid in pid_com], key=lambda x: x.pid)
        para_upd = {p2.pid: p2.text for p1, p2 in zip(para1_com, para2_com) if p1.rid != p2.rid}

        # get added paralinks
        lid_add = list(lids2 - lids1)
        link_add = {l.lid: (l.pid, l.prev, l.next) for l in links2 if l.lid in lid_add}

        # get deleted paralinks
        lid_del = list(lids1 - lids2)

        return {
            'para_add': para_add,
            'para_upd': para_upd,
            'para_del': pid_del,
            'link_add': link_add,
            'link_del': lid_del,
        }

    def revert_article(self, aid, time0=None, time1=None, diff=None):
        if time0 is None:
            time = datetime.utcnow()
        else:
            time = time0

        # generate diff info
        if diff is None:
            diff = diff_article(aid, time, time1)

        # insert new paras
        for pid, text in diff['para_add'].items():
            par = Paragraph(aid=aid, pid=pid, text=text, create_time=time)
            self.session.add(par)

        # update existing paras (delete old revision, add new revision)
        for pid, text in diff['para_upd'].items():
            rev = self.get_para(pid, time=time)
            rev.delete_time = time
            par = Paragraph(aid=aid, pid=pid, text=text, create_time=time)
            self.session.add(par)

        # delete old paras
        for pid in diff['para_del']:
            par = self.get_para(pid, time=time)
            par.delete_time = time

        # add new links
        for lid, (pid, prv, nxt) in diff['link_add'].items():
            lin = Paralink(aid=aid, pid=pid, prev=prv, next=nxt, create_time=time)
            self.session.add(lin)

        # delete old links
        for lid in diff['link_del']:
            lin = self.get_lid(lid) # primary key
            lin.delete_time = time

        # commit it all
        self.session.commit()

    ##
    ## user manager
    ##

    def load_user(self, id):
        return self.session.query(User).get(int(id))

    def get_user(self, email):
        return self.session.query(User).filter_by(email=email).one_or_none()

    def get_all_users(self):
        return self.session.query(User).all()

    def add_user(self, email, name, password=None, phash=None, confirm=False):
        time = datetime.now()

        if phash is None:
            phash = generate_password_hash(password, method='sha256')
        user = User(email=email, name=name, password=phash, registered_on=time)

        if confirm:
            user.confirmed = True
            user.confirmed_on = time

        self.session.add(user)
        self.session.commit()

    def del_user(self, email):
        user = self.get_user(email)
        if user is None:
            return False
        else:
            self.session.delete(user)
            self.session.commit()
            return True

    def confirm_user(self, user):
        user.confirmed = True
        user.confirmed_on = datetime.now()
        self.session.add(user)
        self.session.commit()

    def update_password(self, user, password):
        phash = generate_password_hash(password, method='sha256')
        user.password = phash
        self.session.add(user)
        self.session.commit()

    ##
    ## index interface
    ##

    def index_document(self, dtype, ident, text, clear=False, commit=True):
        if clear:
            self.unindex_document(dtype, ident, commit=False)
        for wid, shards in shardify_document(text).items():
            for tok, pos in shards:
                ent = TextShard(
                    text=tok, word_idx=wid, word_pos=pos,
                    source_type=dtype, source_id=ident
                )
                self.session.add(ent)
        if commit:
            self.session.commit()

    def unindex_document(self, dtype, ident, commit=True):
        query = self.session.query(TextShard).filter_by(
            source_type=dtype, source_id=ident
        )
        query.delete()
        if commit:
            self.session.commit()

    def clear_index(self, dtype=None):
        query = self.session.query(TextShard)
        if dtype is not None:
            query = query.filter_by(source_type=dtype)
        query.delete()
        self.session.commit()

    def reindex_article(self, aid, commit=True):
        if (art := self.get_art(aid)) is None:
            return
        self.index_document('title', art.aid, art.title, clear=True, commit=False)
        self.index_document('title', art.aid, art.short_title, clear=False, commit=False)
        for par in self.get_paras(art.aid):
            self.index_document('para', par.pid, par.text, clear=True, commit=False)
        if commit:
            self.session.commit()

    def reindex_articles(self):
        self.clear_index()
        for art in self.get_arts():
            self.reindex_article(art.aid, commit=False)
        self.session.commit()

    def search_index(self, text, dtype=None):
        # shardify query
        shards = {i: shard_compress(s) for i, s in shardify_document(text).items()}
        toks = set.union(*[set(s.keys()) for s in shards.values()])

        # construct token query
        query = self.session.query(TextShard)
        if dtype is not None:
            query = query.filter_by(source_type=dtype)
        query = query.filter(TextShard.text.in_(toks))

        # get potential matches (move this to all-sql when finalized)
        match = defaultdict(list)
        for s in query.all():
            match[(s.source_type, s.source_id, s.word_idx)].append((s.text, s.word_pos))
        match = {i: shard_compress(sh) for i, sh in match.items()}

        # compute distance metrics
        sims = defaultdict(list)
        for (t, i, j), m in match.items():
            sims[(t, i)].append(max(shard_score(s, m) for s in shards.values()))
        sims = [(k, ces(v)) for k, v in sims.items()]

        # drop dtype if specified
        if dtype is not None:
            sims = [(i, x) for (_, i), x in sims]

        # return sorted NO LONGER decreasing --- changed elsewhere
        return sorted(sims, key=itemgetter(1))

    def get_cur_tag(self, art, taglist):
        q = (self.session
                .query(Tag)
                .filter_by(aid=art.aid)
                .filter(Tag.tag.in_(taglist))
                .all()
                )
        return [t.tag for t in q]

    def get_tag_rank(self, taglist):
        arts = self.get_arts()
        arts = {art: self.get_cur_tag(art, taglist) for art in arts if self.get_cur_tag(art, taglist)}
        return arts

    def get_tagged_arts(self, taglist):
        tag_rank = self.get_tag_rank(taglist)
        tag_image = sorted(tag_rank.values(), key=len, reverse=True)
        # create list of dicts {tags, arts}
        tagged = [{'tagGrp': tags, 'arts': [{'short': 'a/' + art.short_title, 'blurb': art.blurb} for art in tag_rank if tag_rank[art] == tags]} for tags in tag_image]
        return tagged