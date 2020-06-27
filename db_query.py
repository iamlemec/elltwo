from datetime import datetime
from functools import partial
from sqlalchemy import create_engine, or_, and_
from sqlalchemy.orm import sessionmaker

from db_setup import Base, Article, Paragraph, Paralink

engine = create_engine('sqlite:///axiom.db')
Session = sessionmaker(bind=engine)
session = Session()

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
    if pids is None:
        pids = get_pids(aid, time=time)

    query = (session
        .query(Paragraph)
        .filter_by(aid=aid)
        .filter(Paragraph.pid.in_(pids))
    )
    paras = query.all()

    index = {p.pid: p for p in paras}
    return [index[p] for p in pids]

def get_text(aid, time=None):
    paras = get_paras(aid, time=time)
    return '\n\n'.join([p.text for p in paras])

def get_para(pid):
    return session.query(Paragraph).filter_by(pid=pid).one_or_none()

def get_link(pid, time=None):
    if time is None:
        time = datetime.utcnow()
    return session.query(Paralink).filter_by(pid=pid).filter(lintime(time)).one_or_none()

##
## editing methods
##

def update_para(pid, text):
    now = datetime.utcnow()

    if (par := get_para(pid)) is None:
        return
    if (lin := get_link(pid, now)) is None:
        return

    linp = get_link(lin.prev, now)
    linn = get_link(lin.next, now)

    par.delete_time = now
    par1 = Paragraph(aid=par.aid, create_time=now, text=text)
    session.add(par1)
    session.commit()

    lin1 = splice_link(lin, now, pid=par1.pid)
    session.add(lin1)

    if linp is not None:
        linp1 = splice_link(linp, now, next=par1.pid)
        session.add(linp1)
    if linn is not None:
        linn1 = splice_link(linn, now, prev=par1.pid)
        session.add(linn1)

    session.commit()

def insert_after(pid, text):
    now = datetime.utcnow()

    if (par := get_para(pid)) is None:
        return
    if (lin := get_link(pid, now)) is None:
        return

    linn = get_link(lin.next, now)

    par1 = Paragraph(aid=par.aid, text=text, create_time=now)
    session.add(par1)
    session.commit()

    lin0 = Paralink(aid=par.aid, pid=par1.pid, prev=pid, next=lin.next, create_time=now)
    session.add(lin0)

    lin1 = splice_link(lin, now, next=par1.pid)
    session.add(lin1)

    if linn is not None:
        linn1 = splice_link(linn, now, prev=par1.pid)
        session.add(linn1)

    session.commit()

def insert_before(pid, text):
    now = datetime.utcnow()

    if (par := get_para(pid)) is None:
        return
    if (lin := get_link(pid, now)) is None:
        return

    linp = get_link(lin.prev, now)

    par1 = Paragraph(aid=par.aid, text=text, create_time=now)
    session.add(par1)
    session.commit()

    lin0 = Paralink(aid=par.aid, pid=par1.pid, prev=lin.prev, next=pid, create_time=now)
    session.add(lin0)

    lin1 = splice_link(lin, now, prev=par1.pid)
    session.add(lin1)

    if linp is not None:
        linp1 = splice_link(linp, now, next=par1.pid)
        session.add(linp1)

    session.commit()

def delete_para(pid):
    now = datetime.utcnow()

    if (par := get_para(pid)) is None:
        return
    if (lin := get_link(pid, now)) is None:
        return

    linp = get_link(lin.prev, now)
    linn = get_link(lin.next, now)

    par.delete_time = now
    lin.delete_time = now

    if linp is not None:
        linp1 = splice_link(linp, now, next=lin.next)
        session.add(linp1)
    if linn is not None:
        linn1 = splice_link(linn, now, prev=lin.prev)
        session.add(linn1)

    session.commit()
