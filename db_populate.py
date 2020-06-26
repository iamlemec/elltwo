from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db_setup import Article, Paragraph, Paralink

engine = create_engine('sqlite:///axiom.db')
Session = sessionmaker(bind=engine)
session = Session()

art = Article(aid=0, title='Abraham Lincoln')
par0 = Paragraph(pid=0, aid=0, text='# Abraham Lincoln')
par1 = Paragraph(pid=1, aid=0, text='He was a dude.')
par2 = Paragraph(pid=2, aid=0, text='He got shot.')
lin0 = Paralink(aid=0, pid=0, next=1)
lin1 = Paralink(aid=0, pid=1, prev=0, next=2)
lin2 = Paralink(aid=0, pid=2, prev=1)

session.add(art)
session.add_all([par0, par1, par2])
session.add_all([lin0, lin1, lin2])
session.commit()
