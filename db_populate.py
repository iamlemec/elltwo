from datetime import datetime

from db_setup import db, Article, Paragraph, Paralink

now = datetime.utcnow()

art = Article(aid=0, title='Abraham Lincoln', short_title='abraham_lincoln', create_time=now)
par0 = Paragraph(aid=0, pid=0, text='# Abraham Lincoln', create_time=now)
par1 = Paragraph(aid=0, pid=1, text='He was a dude.', create_time=now)
par2 = Paragraph(aid=0, pid=2, text='He got shot.', create_time=now)
lin0 = Paralink(aid=0, pid=0, next=1, create_time=now)
lin1 = Paralink(aid=0, pid=1, prev=0, next=2, create_time=now)
lin2 = Paralink(aid=0, pid=2, prev=1, create_time=now)

db.session.add(art)
db.session.add_all([par0, par1, par2])
db.session.add_all([lin0, lin1, lin2])
db.session.commit()
