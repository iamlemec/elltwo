from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, Query

Base = declarative_base()

class Timed(Base):
    id = Column(Integer, primary_key=True)
    create_time = Column(DateTime, default=datetime.utcnow)
    delete_time = Column(DateTime)
    discriminator = Column(String)

    __tablename__ = 'timed'
    __mapper_args__ = {'polymorphic_on': discriminator}

    def __repr__(self):
        return f'{self.id} [{self.create_time} → {self.delete_time}]'

class Article(Timed):
    title = Column(Text)

    __mapper_args__ = {'polymorphic_identity': 'article'}

    def __repr__(self):
        return f'{super().__repr__()}: {self.title}'

class Paragraph(Timed):
    aid = Column(Integer)
    text = Column(Text)

    __mapper_args__ = {'polymorphic_identity': 'paragraph'}

    def __repr__(self):
        return f'{super().__repr__()}: {self.text}'

engine = create_engine(f'sqlite://')
Base.metadata.create_all(engine)
session = Session(engine)

art = Article(title='abraham lincoln')
session.add(art)

par = Paragraph(aid=art.id, text='he was a dude')
session.add(par)

session.commit()

print('Articles:')
for a in session.query(Article).filter(Timed.create_time>='2021-07-01').all():
    print(a)

print()

print('Paragraphs:')
for a in session.query(Paragraph).filter(Timed.create_time>='2021-07-01').all():
    print(a)
