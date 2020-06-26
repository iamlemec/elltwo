from datetime import datetime
from functools import partial
from sqlalchemy import create_engine, or_, and_
from sqlalchemy.orm import sessionmaker

from db_setup import Base, Article, Paragraph, Paralink

engine = create_engine('sqlite:///axiom.db')
Session = sessionmaker(bind=engine)
session = Session()

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

def getall(klass, disp=True):
    ret = session.query(klass).all()
    if disp:
        print('\n'.join([str(x) for x in ret]))
    else:
        return ret

def find_start(links):
    for p in links:
        if p.prev is None:
            return p

def link_sort(links):
    if (p := find_start(links)) is None:
        return
    else:
        yield p.pid
    index = {p.pid: p for p in links}
    while (p := index.get(p.next, None)) is not None:
        yield p.pid

def get_links(aid, time=None):
    if time is None:
        time = datetime.utcnow()

    query = (session
        .query(Paralink)
        .filter_by(aid=aid)
        .filter(lintime(time))
    )
    links = query.all()

    return list(link_sort(links))

def get_paras(aid, pids=None, time=None):
    if time is None:
        time = datetime.utcnow()
    if pids is None:
        pids = get_links(aid, time=time)

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

def update_para(pid, text):
    now = datetime.utcnow()

    if (par := get_para(pid)) is None:
        return
    if (lin := get_link(pid, now)) is None:
        return

    linp = get_link(lin.prev, now)
    linn = get_link(lin.next, now)

    par1 = Paragraph(aid=par.aid, create_time=now, text=text)
    session.add(par1)
    session.commit()

    par.delete_time = now
    lin.delete_time = now
    lin1 = Paralink(aid=par.aid, pid=par1.pid, prev=lin.prev, next=lin.next, create_time=now)
    session.add(lin1)

    if linp is not None:
        linp.delete_time = now
        linp1 = Paralink(aid=par.aid, pid=linp.pid, prev=linp.prev, next=par1.pid, create_time=now)
        session.add(linp1)
    if linn is not None:
        linn.delete_time = now
        linn1 = Paralink(aid=par.aid, pid=linn.pid, prev=par1.pid, next=linn.next, create_time=now)
        session.add(linn1)

    session.commit()

def insert_after(aid, pid, text):
    now = datetime.utcnow()

    if (lin := get_link(pid, now)) is None:
        return

    linn = get_link(lin.next, now)

    par1 = Paragraph(aid=aid, text=text, create_time=now)
    session.add(par1)
    session.commit()

    lin.delete_time = now
    lin1 = Paralink(aid=aid, pid=pid, prev=lin.prev, next=par1.pid, create_time=now)
    lin2 = Paralink(aid=aid, pid=par1.pid, prev=pid, next=lin.next, create_time=now)
    session.add_all([lin1, lin2])

    if linn is not None:
        linn.delete_time = now
        linn1 = Paralink(aid=aid, pid=lin.next, prev=par1.pid, next=linn.next, create_time=now)
        session.add(linn1)

    session.commit()

if __name__ == '__main__':
    for art in getall(Article):
        print(f'{art.aid}: {art.title}')
        print(get_text(art.aid))
