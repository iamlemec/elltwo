import re
from math import ceil
from datetime import datetime
from functools import partial

from sqlalchemy import create_engine, or_, and_, distinct
from sqlalchemy.sql import func
from sqlalchemy.orm import sessionmaker
from werkzeug.security import generate_password_hash, check_password_hash

from db_setup import Base, Article, Paragraph, Paralink, Bib, ExtRef, User

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

def order_links(links, single=True):
    groups = []
    for lin in links.values():
        pi, pr, nx = lin
        found = False
        for gr in groups:
            _, lo, _ = gr[0]
            _, _, hi = gr[-1]
            if lo == pi and lo is not None:
                gr.insert(0, lin)
                found = True
                break
            if hi == pi and hi is not None:
                gr.append(lin)
                found = True
                break
        if not found:
            groups.append([lin])
    if single:
        groups = [[(pi, pr) for pi, pr, _ in gr[:-1]] for gr in groups]
    return sum(groups, [])

##
## db interface
##

class AxiomDB:
    def __init__(self, db=None, path='axiom.db', name='Axiom', uri=None):
        if db is None:
            if uri is None:
                uri = f'sqlite:///{path}'

            self.engine = create_engine(uri)
            Session = sessionmaker(bind=self.engine)
            self.session = Session()
        else:
            self.engine = db.engine
            self.session = db.session

    def create(self):
        Base.metadata.create_all(bind=self.engine)

    ##
    ## diagnostic tools
    ##

    def getall(self, klass, disp=True, **kwargs):
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

    def get_art(self, aid, time=None):
        if time is None:
            time = datetime.utcnow()

        return (self.session
            .query(Article)
            .filter_by(aid=aid)
            .filter(arttime(time))
            .one_or_none()
        )

    def get_art_text(self, aid, time=None):
        paras = self.get_paras(aid, time=time)
        return '\n\n'.join([p.text for p in paras])

    def get_para(self, pid, time=None):
        if time is None:
            time = datetime.utcnow()
        return self.session.query(Paragraph).filter_by(pid=pid).filter(partime(time)).one_or_none()

    def get_link(self, pid, time=None):
        if time is None:
            time = datetime.utcnow()
        return self.session.query(Paralink).filter_by(pid=pid).filter(lintime(time)).one_or_none()

    def get_lid(self, lid):
        return self.session.query(Paralink).filter_by(lid=lid).one_or_none()

    ##
    ## editing methods
    ##

    def create_pid(self):
        if (pmax := self.session.query(func.max(Paragraph.pid)).scalar()) != None:
            return pmax + 1
        else:
            return 0

    def update_para(self, pid, text, time=None):
        if time is None:
            time = datetime.utcnow()

        if (par := self.get_para(pid, time=time)) is None:
            return

        par.delete_time = time

        par1 = Paragraph(aid=par.aid, pid=par.pid, create_time=time, text=text)
        self.session.add(par1)

        self.session.commit()

    def bulk_update(self, para_dict, time=None):
        if time is None:
            time = datetime.utcnow()

        for pid, text in para_dict.items():
            self.update_para(pid, text, time=time)

    def insert_after(self, pid, text='', time=None):
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

        self.session.commit()

        return par1

    def insert_before(self, pid, text='', time=None):
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

        self.session.commit()

        return par1

    def delete_para(self, pid, time=None):
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

        self.session.commit()

    ##
    ## article methods
    ##

    def first_para(self, aid):
        return self.session.query(Paralink).filter_by(aid=aid).filter_by(prev=None).one_or_none()

    def last_para(self, aid):
        return self.session.query(Paralink).filter_by(aid=aid).filter_by(next=None).one_or_none()

    def create_article(self, title, short_title=None, init=True, time=None):
        if time is None:
            time = datetime.utcnow()

        if short_title is None:
            short_title = urlify(title)

        art = Article(title=title, short_title=short_title, create_time=time)
        self.session.add(art)
        self.session.commit()

        if init:
            self.init_article(art.aid, text=f'#! {title}', time=time)

        return art

    def delete_article(self, aid, time=None):
        if time is None:
            time = datetime.utcnow()
        if (art := self.get_art(aid)) is not None:
            art.delete_time = time
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

    def import_markdown(self, title, mark, time=None):
        if time is None:
            time = datetime.utcnow()

        art = self.create_article(title, init=False, time=time)
        aid = art.aid

        paras = re.sub(r'\n{3,}', '\n\n', mark).strip().split('\n\n')
        n_par, max_pid = len(paras), self.create_pid()
        pids = list(range(max_pid, max_pid + n_par))

        for i, (pid, ptxt) in enumerate(zip(pids, paras)):
            prev = None if i == 0 else pids[i-1]
            next = None if i == n_par - 1 else pids[i+1]
            par = Paragraph(aid=aid, pid=pid, text=ptxt, create_time=time)
            lin = Paralink(aid=aid, pid=pid, prev=prev, next=next, create_time=time)
            self.session.add_all([par, lin])

        self.session.commit()

    ##
    ## query methods
    ##

    def get_art_short(self, short):
        short_match = urlify(short)
        art = self.session.query(Article).filter_by(short_title=short_match).one_or_none()
        return art

    def get_short(self, short):
        short_match = urlify(short)
        art = self.session.query(Article).filter_by(short_title=short_match).one_or_none()
        return [p.text for p in self.get_paras(art.aid)]

    def search_title(self, words, err=0.3):
        pattern = Article.title.like(f'%{words}%')
        return self.session.query(Article).filter(pattern).all()

    ##
    ## citation methods
    ##

    def create_cite(self, citekey, entry_type, **kwargs):
        now = datetime.utcnow()

        if (bib := self.get_cite(citekey)) is None:
            cite = Bib(citekey=citekey, entry_type=entry_type, create_time=now, **kwargs)
            self.session.add(cite)
            self.session.commit()
            return cite
        else:
            bib.delete_time = now
            cite = Bib(citekey=citekey, entry_type=entry_type, create_time=now, **kwargs)
            self.session.add(bib)
            self.session.add(cite)
            self.session.commit()

    def get_cite(self, citekey, time=None):
        if time is None:
            time = datetime.utcnow()
        return self.session.query(Bib).filter_by(citekey=citekey).filter(bibtime(time)).one_or_none()

    def delete_cite(self, citekey):
        now = datetime.utcnow()

        if (bib := self.get_cite(citekey)) is None:
            return

        bib.delete_time = now
        self.session.commit()

    def get_bib(self, keys=None, time=None):
        if time is None:
            time = datetime.utcnow()

        if keys is None:
            query = (self.session
                .query(Bib)
                .filter(bibtime(time))
            )
        else:
            query = (self.session
                .query(Bib)
                .filter(bibtime(time))
                .filter(Bib.citekey.in_(keys))
            )

        bib = query.all()

        return bib

    def get_bib_dict(self, keys=None, time=None):
        bib = self.get_bib(keys, time)
        bib_dict = []
        for c in bib:
            x = c.__dict__.copy()
            del x['_sa_instance_state']
            del x['create_time']
            del x['delete_time']
            bib_dict.append(x)
        return bib_dict

    ##
    ## exteral references
    ##

    def get_ref(self, key, aid, time=None):
        if time is None:
            time = datetime.utcnow()
        return self.session.query(ExtRef).filter_by(key=key).filter_by(aid=aid).filter(reftime(time)).one_or_none()

    def create_ref(self, key, aid, cite_type, cite_env, text):
        now = datetime.utcnow()

        if (ref := get_ref(key, aid)) is None:
            ref1 = ExtRef(key=key, aid=aid, cite_type=cite_type, cite_env=cite_env, text=text, create_time=now,)
            self.session.add(ref1)
            self.session.commit()
            return ref
        else:
            ref.delete_time = now
            ref1 = ExtRef(key=key, aid=aid, cite_type=cite_type, cite_env=cite_env, text=text, create_time=now,)
            self.session.add(ref1)
            self.session.commit()

    def delete_cite(self, key, aid):
        now = datetime.utcnow()

        if (ref := self.get_ref(key, aid)) is None:
            return

        ref.delete_time = now
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

        # update existing paras
        for pid, text in diff['para_upd'].items():
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

    def add_user(self, email, name, password):
        hash = generate_password_hash(password, method='sha256')
        new_user = User(email=email, name=name, password=hash)
        self.session.add(new_user)
        self.session.commit()
