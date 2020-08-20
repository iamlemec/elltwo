import re
from datetime import datetime
from functools import partial
from sqlalchemy import create_engine, or_, and_
from sqlalchemy.sql import func
from sqlalchemy.orm import sessionmaker
from math import ceil

from db_setup import db, Article, Paragraph, Paralink, Bib, ExtRef
session = db.session

##
## diagnostic tools
##

def getall(klass, disp=True):
    ret = session.query(klass).all()
    if disp:
        print('\n'.join([str(x) for x in ret]))
    else:
        return ret

def revert(time, klass=None):
    if klass is None:
        revert(time, klass=Article)
        revert(time, klass=Paragraph)
        revert(time, klass=Paralink)
    else:
        for k in session.query(klass).filter(klass.create_time > time).all():
            session.delete(k)
        for k in session.query(klass).filter(klass.delete_time > time).all():
            k.delete_time = None
        session.commit()

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

##
## query methods
##

def get_links(aid, time=None):
    if time is None:
        time = datetime.utcnow()
    query = (session
        .query(Paralink)
        .filter_by(aid=aid)
        .filter(lintime(time))
    )
    return query.all()

def get_pids(aid, time=None):
    links = get_links(aid, time=time)
    return list(link_sort(links))

def get_paras(aid, pids=None, time=None):
    if time is None:
        time = datetime.utcnow()

    if pids is None:
        pids = get_pids(aid, time=time)

    query = (session
        .query(Paragraph)
        .filter_by(aid=aid)
        .filter(partime(time))
        .filter(Paragraph.pid.in_(pids))
    )
    paras = query.all()

    index = {p.pid: p for p in paras}
    return [index[p] for p in pids]

def get_art(aid, time=None):
    if time is None:
        time = datetime.utcnow()

    return (session
        .query(Article)
        .filter_by(aid=aid)
        .filter(arttime(time))
        .one_or_none()
    )

def get_art_text(aid, time=None):
    paras = get_paras(aid, time=time)
    return '\n\n'.join([p.text for p in paras])

def get_para(pid, time=None):
    if time is None:
        time = datetime.utcnow()
    return session.query(Paragraph).filter_by(pid=pid).filter(partime(time)).one_or_none()

def get_link(pid, time=None):
    if time is None:
        time = datetime.utcnow()
    return session.query(Paralink).filter_by(pid=pid).filter(lintime(time)).one_or_none()

##
## editing methods
##

def create_pid():
    if (pmax := session.query(func.max(Paragraph.pid)).scalar()) != None:
        return pmax + 1
    else:
        return 0

def update_para(pid, text, time=None):
    if time is None:
        time = datetime.utcnow()

    if (par := get_para(pid, time=time)) is None:
        return

    par.delete_time = time

    par1 = Paragraph(aid=par.aid, pid=par.pid, create_time=time, text=text)
    session.add(par1)

    session.commit()

def bulk_update(para_dict, time=None):
    if time is None:
        time = datetime.utcnow()

    for pid, text in para_dict.items():
        update_para(pid, text, time=time)

def insert_after(pid, text='', time=None):
    if time is None:
        time = datetime.utcnow()

    if (par := get_para(pid)) is None:
        return
    if (lin := get_link(pid, time=time)) is None:
        return

    linn = get_link(lin.next, time=time)

    pid1 = create_pid()
    par1 = Paragraph(aid=par.aid, pid=pid1, text=text, create_time=time)
    session.add(par1)

    lin0 = Paralink(aid=par.aid, pid=par1.pid, prev=pid, next=lin.next, create_time=time)
    session.add(lin0)

    lin1 = splice_link(lin, time, next=par1.pid)
    session.add(lin1)

    if linn is not None:
        linn1 = splice_link(linn, time, prev=par1.pid)
        session.add(linn1)

    session.commit()

    return par1

def insert_before(pid, text='', time=None):
    if time is None:
        time = datetime.utcnow()

    if (par := get_para(pid)) is None:
        return
    if (lin := get_link(pid, time=time)) is None:
        return

    linp = get_link(lin.prev, time=time)

    pid1 = create_pid()
    par1 = Paragraph(aid=par.aid, pid=pid1, text=text, create_time=time)
    session.add(par1)

    lin0 = Paralink(aid=par.aid, pid=par1.pid, prev=lin.prev, next=pid, create_time=time)
    session.add(lin0)

    lin1 = splice_link(lin, time, prev=par1.pid)
    session.add(lin1)

    if linp is not None:
        linp1 = splice_link(linp, time, next=par1.pid)
        session.add(linp1)

    session.commit()

    return par1

def delete_para(pid, time=None):
    if time is None:
        time = datetime.utcnow()

    if (par := get_para(pid)) is None:
        return
    if (lin := get_link(pid, time=time)) is None:
        return

    linp = get_link(lin.prev, time)
    linn = get_link(lin.next, time)

    par.delete_time = time
    lin.delete_time = time

    if linp is not None:
        linp1 = splice_link(linp, time, next=lin.next)
        session.add(linp1)
    if linn is not None:
        linn1 = splice_link(linn, time, prev=lin.prev)
        session.add(linn1)

    session.commit()

##
## article methods
##

def urlify(s):
    return re.sub(r'\W', '_', s).lower()

def first_para(aid):
    return session.query(Paralink).filter_by(aid=aid).filter_by(prev=None).one_or_none()

def last_para(aid):
    return session.query(Paralink).filter_by(aid=aid).filter_by(next=None).one_or_none()

def create_article(title, short_title=None, init=True, time=None):
    if time is None:
        time = datetime.utcnow()

    if short_title is None:
        short_title = urlify(title)

    art = Article(title=title, short_title=short_title, create_time=time)
    session.add(art)
    session.commit()

    if init:
        init_article(art.aid, text=f'#! {title}', time=time)

    return art

def delete_article(aid, time=None):
    if time is None:
        time = datetime.utcnow()
    if (art := get_art(aid)) is not None:
        art.delete_time = time
        session.commit()

def init_article(aid, text, time=None):
    if time is None:
        time = datetime.utcnow()

    pid = create_pid()
    par = Paragraph(aid=aid, pid=pid, text=text, create_time=time)
    lin = Paralink(aid=aid, pid=pid, prev=None, next=None, create_time=time)

    session.add_all([par, lin])
    session.commit()

def insert_begin(aid, text, time=None):
    if time is None:
        time = datetime.utcnow()

    if (par := first_para(aid)) is None:
        init_article(aid, text, time=time)
    else:
        insert_before(par.pid, text, time=time)

def insert_end(aid, text, time=None):
    if time is None:
        time = datetime.utcnow()

    if (par := last_para(aid)) is None:
        init_article(aid, text, time=time)
    else:
        insert_after(par.pid, text, time=time)

def set_blurb(aid, blurb):
    art = session.query(Article).filter_by(aid=aid).one_or_none()
    if art:
        art.blurb = blurb
        session.add(art)
        session.commit()

def import_markdown(title, mark, time=None):
    if time is None:
        time = datetime.utcnow()

    art = create_article(title, init=False, time=time)
    aid = art.aid

    paras = re.sub(r'\n{3,}', '\n\n', mark).strip().split('\n\n')
    n_par, max_pid = len(paras), create_pid()
    pids = list(range(max_pid, max_pid + n_par))

    for i, (pid, ptxt) in enumerate(zip(pids, paras)):
        prev = None if i == 0 else pids[i-1]
        next = None if i == n_par - 1 else pids[i+1]
        par = Paragraph(aid=aid, pid=pid, text=ptxt, create_time=time)
        lin = Paralink(aid=aid, pid=pid, prev=prev, next=next, create_time=time)
        session.add_all([par, lin])

    session.commit()

##
## query methods
##

def get_art_short(short):
    short_match = urlify(short)
    art = session.query(Article).filter_by(short_title=short_match).one_or_none()
    return art

def get_short(short):
    short_match = urlify(short)
    art = session.query(Article).filter_by(short_title=short_match).one_or_none()
    return [p.text for p in get_paras(art.aid)]

def fuzzy_query(words, err=0.3):
    toks = words.split()
    dist = [ceil(err*len(s)) for s in toks]
    return ' '.join([f'{s}~{e}' for s, e in zip(toks, dist)])

def search_title(words, err=0.3):
    quer = fuzzy_query(words, err=err)
    return Article.query.msearch(quer, fields=['title']).all()

##
## citation methods
##

def create_cite(citekey, entry_type, **kwargs):
    now = datetime.utcnow()

    if (bib := get_cite(citekey)) is None:
        cite = Bib(citekey=citekey, entry_type=entry_type, create_time=now, **kwargs)
        session.add(cite)
        session.commit()
        return cite
    else:
        bib.delete_time = now
        cite = Bib(citekey=citekey, entry_type=entry_type, create_time=now, **kwargs)
        session.add(bib)
        session.add(cite)
        session.commit()

def get_cite(citekey, time=None):
    if time is None:
        time = datetime.utcnow()
    return session.query(Bib).filter_by(citekey=citekey).filter(bibtime(time)).one_or_none()

def delete_cite(citekey):
    now = datetime.utcnow()

    if (bib := get_cite(citekey)) is None:
        return

    bib.delete_time = now
    session.commit()

def get_bib(keys=None, time=None):
    if time is None:
        time = datetime.utcnow()

    if keys is None:
        query = (session
            .query(Bib)
            .filter(bibtime(time))
        )
    else:
        query = (session
            .query(Bib)
            .filter(bibtime(time))
            .filter(Bib.citekey.in_(keys))
        )

    bib = query.all()

    return bib

def get_bib_dict(keys=None, time=None):
    bib = get_bib(keys, time)
    bib_dict = []
    for c in bib:
        x = c.__dict__
        del x['_sa_instance_state']
        del x['create_time']
        del x['delete_time']
        bib_dict.append(x)
    return bib_dict

##
## exteral references
##

def get_ref(key, aid, time=None):
    if time is None:
        time = datetime.utcnow()
    return session.query(ExtRef).filter_by(key=key).filter_by(aid=aid).filter(reftime(time)).one_or_none()

def create_ref(key, aid, cite_type, cite_env, text):
    now = datetime.utcnow()

    if (ref := get_ref(key, aid)) is None:
        ref1 = ExtRef(key=key, aid=aid, cite_type=cite_type, cite_env=cite_env, text=text, create_time=now,)
        session.add(ref1)
        session.commit()
        return ref
    else:
        ref.delete_time = now
        ref1 = ExtRef(key=key, aid=aid, cite_type=cite_type, cite_env=cite_env, text=text, create_time=now,)
        session.add(ref1)
        session.commit()

def delete_cite(key, aid):
    now = datetime.utcnow()

    if (ref := get_ref(key, aid)) is None:
        return

    ref.delete_time = now
    session.commit()
