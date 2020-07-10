from datetime import datetime
from sqlalchemy import create_engine, Column, ForeignKey, Integer, Boolean, String, DateTime
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Article(Base):
    __tablename__ = 'article'

    aid = Column(Integer, primary_key=True)
    title = Column(String(), nullable=False)
    short_title = Column(String(), nullable=False)
    create_time = Column(DateTime, default=datetime.utcnow)
    delete_time = Column(DateTime)

    def __repr__(self):
        return f'{self.aid} [{self.create_time} → {self.delete_time}]: {self.title} ({self.short_title})'

class Paragraph(Base):
    __tablename__ = 'paragraph'

    rid = Column(Integer, primary_key=True)
    pid = Column(Integer)
    aid = Column(Integer, ForeignKey('article.aid'))
    text = Column(String(), nullable=False)
    create_time = Column(DateTime, default=datetime.utcnow)
    delete_time = Column(DateTime)

    def __repr__(self):
        return f'{self.aid}/{self.pid} [{self.create_time} → {self.delete_time}]:\n{self.text}'

class Paralink(Base):
    __tablename__ = 'paralink'

    lid = Column(Integer, primary_key=True)
    aid = Column(Integer, ForeignKey('article.aid'))
    pid = Column(Integer, ForeignKey('paragraph.pid'))
    prev = Column(Integer, ForeignKey('paragraph.pid'))
    next = Column(Integer, ForeignKey('paragraph.pid'))
    create_time = Column(DateTime, default=datetime.utcnow)
    delete_time = Column(DateTime)

    def __repr__(self):
        return f'{self.aid} [{self.create_time} → {self.delete_time}]: {self.prev}—{self.pid}—{self.next}'

if __name__ == '__main__':
    engine = create_engine('sqlite:///axiom.db')
    Base.metadata.create_all(engine)
