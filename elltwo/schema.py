from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from flask_login import UserMixin

Base = declarative_base()

class Article(Base):
    __tablename__ = 'article'

    aid = Column(Integer, primary_key=True)
    title = Column(Text, nullable=False)
    short_title = Column(Text, nullable=False)
    blurb = Column(Text)
    g_ref = Column(Boolean, nullable=False, default=False)
    last_edit = Column(DateTime, nullable=True)
    create_time = Column(DateTime, default=datetime.utcnow)
    delete_time = Column(DateTime)

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
        return f'{self.bid} [{self.create_time} → {self.delete_time}]: {self.author} ({self.year})'

class ExtRef(Base):
    __tablename__ = 'ext_ref'

    fid = Column(Integer, primary_key=True)
    aid = Column(Integer, ForeignKey('article.aid'), nullable=False)
    key = Column(Text, nullable=False)
    text = Column(Text, nullable=False)
    cite_type = Column(Text, nullable=False)
    cite_env = Column(Text, nullable=False)
    ref_text = Column(Text)
    create_time = Column(DateTime, default=datetime.utcnow)
    delete_time = Column(DateTime)

    def __repr__(self):
        return f'{self.key} [{self.create_time} → {self.delete_time}]:\n{self.text}'

class Image(Base):
    __tablename__ = 'image'

    iid = Column(Integer, primary_key=True)
    key = Column(Text, nullable=False)
    keywords = Column(Text)
    mime = Column(Text, nullable=False)
    data = Column(LargeBinary)
    create_time = Column(DateTime, default=datetime.utcnow)
    delete_time = Column(DateTime)

    def __repr__(self):
        return f'{self.key} ({self.mime}) [{self.create_time} → {self.delete_time}]'


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

    def __repr__(self):
        conf = 'confirmed' if self.confirmed else 'unconfirmed'
        return f'{self.email} [{conf}]: {self.name}'

class TextShard(Base):
    __tablename__ = 'textshard'

    id = Column(Integer, primary_key=True)
    text = Column(String(10), nullable=False)
    word_idx = Column(Integer, nullable=False)
    word_pos = Column(Integer, nullable=False)
    source_type = Column(String(10), nullable=False)
    source_id = Column(Integer, nullable=False)

    def __repr__(self):
        return f'{self.source_id}/{self.pos}: {self.text}'
