from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db_setup import Article, Paragraph, Paralink

engine = create_engine('sqlite:///axiom.db')
Session = sessionmaker(bind=engine)
session = Session()

now = datetime.utcnow()

art = Article(aid=0, title='Abraham Lincoln', create_time=now)
par0 = Paragraph(pid=0, aid=0, text='# Abraham Lincoln', create_time=now)
par1 = Paragraph(pid=1, aid=0, text='He was a dude.', create_time=now)
par2 = Paragraph(pid=2, aid=0, text='He got shot.', create_time=now)
lin0 = Paralink(aid=0, pid=0, next=1, create_time=now)
lin1 = Paralink(aid=0, pid=1, prev=0, next=2, create_time=now)
lin2 = Paralink(aid=0, pid=2, prev=1, create_time=now)

session.add(art)
session.add_all([par0, par1, par2])
session.add_all([lin0, lin1, lin2])
session.commit()
