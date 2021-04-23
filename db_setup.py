import argparse
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from flask_login import UserMixin
from whoosh import qparser

Base = declarative_base()

def _fuzzy_parser(fieldnames, schema, group, **kwargs):
    parser = qparser.MultifieldParser(fieldnames, schema, group=group, **kwargs)
    parser.add_plugin(qparser.FuzzyTermPlugin())
    return parser

class Article(Base):
    __tablename__ = 'article'
    __searchable__ = ['title']
    __msearch_primary_key__ = 'aid'

    aid = Column(Integer, primary_key=True)
    title = Column(Text, nullable=False)
    short_title = Column(Text, nullable=False)
    blurb = Column(Text)
    create_time = Column(DateTime, default=datetime.utcnow)
    delete_time = Column(DateTime)

    __msearch_parser__ = _fuzzy_parser

    def __repr__(self):
        return f'{self.aid} [{self.create_time} → {self.delete_time}]: {self.title} ({self.short_title})'

class Paragraph(Base):
    __tablename__ = 'paragraph'

    rid = Column(Integer, primary_key=True)
    pid = Column(Integer)
    aid = Column(Integer, ForeignKey('article.aid'))
    text = Column(Text, nullable=False)
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
        return f'{self.aid}/{self.lid} [{self.create_time} → {self.delete_time}]: {self.prev}—{self.pid}—{self.next}'


class Bib(Base):
    __tablename__ = 'bib'

    bid = Column(Integer, primary_key=True)
    citekey = Column(Text, nullable=False)
    entry_type = Column(Text, nullable=False)
    title = Column(Text, nullable=False)
    author = Column(Text, nullable=False)
    journal = Column(Text)
    number = Column(Text) #integer?
    volume = Column(Text)
    year = Column(Text, nullable=False)
    booktitle = Column(Text)
    publisher = Column(Text)
    DOI = Column(Text)
    pages = Column(Text)
    raw = Column(Text, nullable=False) #the raw bibtex stored for editing, probably could kill off
    create_time = Column(DateTime, default=datetime.utcnow)
    delete_time = Column(DateTime)

    def __repr__(self):
        return f'{self.bid} [{self.create_time} → {self.delete_time}]:\n{self.author} ({self.year})'

class ExtRef(Base):
    __tablename__ = 'ext_ref'

    fid = Column(Integer, primary_key=True)
    aid = Column(Integer, ForeignKey('article.aid'), nullable=False)
    key = Column(Text, nullable=False)
    text = Column(Text, nullable=False)
    cite_type = Column(Text, nullable=False)
    cite_env = Column(Text, nullable=False)
    create_time = Column(DateTime, default=datetime.utcnow)
    delete_time = Column(DateTime)

    def __repr__(self):
        return f'{self.key} [{self.create_time} → {self.delete_time}]:\n{self.text}'

# user management
class User(UserMixin, Base):
    __tablename__ = 'user'

    id = Column(Integer, primary_key=True) # primary keys are required by SQLAlchemy
    email = Column(String(100), unique=True)
    password = Column(String(100))
    name = Column(String(1000))
    registered_on = Column(DateTime, nullable=False, default=datetime.utcnow)
    confirmed = Column(Boolean, nullable=False, default=False)
    confirmed_on = Column(DateTime, nullable=True)
