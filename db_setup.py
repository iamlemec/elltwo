from datetime import datetime
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_msearch import Search
from flask_login import UserMixin, LoginManager
from whoosh import qparser

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///axiom.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = True
app.config['MSEARCH_ENABLE'] = True
app.config['MSEARCH_BACKEND'] = 'whoosh'
db = SQLAlchemy(app)
login = LoginManager(app)


search = Search(app=app, db=db)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True) # primary keys are required by SQLAlchemy
    email = db.Column(db.String(100), unique=True)
    password = db.Column(db.String(100))
    name = db.Column(db.String(1000))

@login.user_loader
def load_user(id):
    return User.query.get(int(id))

class Article(db.Model):
    __tablename__ = 'article'
    __searchable__ = ['title']
    __msearch_primary_key__ = 'aid'

    aid = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.Text, nullable=False)
    short_title = db.Column(db.Text, nullable=False)
    blurb = db.Column(db.Text)
    create_time = db.Column(db.DateTime, default=datetime.utcnow)
    delete_time = db.Column(db.DateTime)

    def _parser(fieldnames, schema, group, **kwargs):
        parser = qparser.MultifieldParser(fieldnames, schema, group=group, **kwargs)
        parser.add_plugin(qparser.FuzzyTermPlugin())
        return parser
    __msearch_parser__ = _parser

    def __repr__(self):
        return f'{self.aid} [{self.create_time} → {self.delete_time}]: {self.title} ({self.short_title})'

class Paragraph(db.Model):
    __tablename__ = 'paragraph'

    rid = db.Column(db.Integer, primary_key=True)
    pid = db.Column(db.Integer)
    aid = db.Column(db.Integer, db.ForeignKey('article.aid'))
    text = db.Column(db.Text, nullable=False)
    create_time = db.Column(db.DateTime, default=datetime.utcnow)
    delete_time = db.Column(db.DateTime)

    def __repr__(self):
        return f'{self.aid}/{self.pid} [{self.create_time} → {self.delete_time}]:\n{self.text}'

class Paralink(db.Model):
    __tablename__ = 'paralink'

    lid = db.Column(db.Integer, primary_key=True)
    aid = db.Column(db.Integer, db.ForeignKey('article.aid'))
    pid = db.Column(db.Integer, db.ForeignKey('paragraph.pid'))
    prev = db.Column(db.Integer, db.ForeignKey('paragraph.pid'))
    next = db.Column(db.Integer, db.ForeignKey('paragraph.pid'))
    create_time = db.Column(db.DateTime, default=datetime.utcnow)
    delete_time = db.Column(db.DateTime)

    def __repr__(self):
        return f'{self.aid}/{self.lid} [{self.create_time} → {self.delete_time}]: {self.prev}—{self.pid}—{self.next}'


class Bib(db.Model):
    __tablename__ = 'bib'

    bid = db.Column(db.Integer, primary_key=True)
    citekey = db.Column(db.Text, nullable=False)
    entry_type = db.Column(db.Text, nullable=False)
    title = db.Column(db.Text, nullable=False)
    author = db.Column(db.Text, nullable=False)
    journal = db.Column(db.Text)
    number = db.Column(db.Text) #integer?
    volume = db.Column(db.Text)
    year = db.Column(db.Text, nullable=False)
    booktitle = db.Column(db.Text)
    publisher = db.Column(db.Text)
    DOI = db.Column(db.Text)
    pages = db.Column(db.Text)
    raw = db.Column(db.Text, nullable=False) #the raw bibtex stored for editing, probably could kill off
    create_time = db.Column(db.DateTime, default=datetime.utcnow)
    delete_time = db.Column(db.DateTime)

    def __repr__(self):
        return f'{self.bid} [{self.create_time} → {self.delete_time}]:\n{self.author} ({self.year})'

class ExtRef(db.Model):
    __tablename__ = 'ext_ref'

    fid = db.Column(db.Integer, primary_key=True)
    aid = db.Column(db.Integer, db.ForeignKey('article.aid'), nullable=False)
    key = db.Column(db.Text, nullable=False)
    text = db.Column(db.Text, nullable=False)
    cite_type = db.Column(db.Text, nullable=False)
    cite_env = db.Column(db.Text, nullable=False)
    create_time = db.Column(db.DateTime, default=datetime.utcnow)
    delete_time = db.Column(db.DateTime)

    def __repr__(self):
        return f'{self.key} [{self.create_time} → {self.delete_time}]:\n{self.text}'

if __name__ == '__main__':
    db.drop_all()
    db.create_all()
    search.create_index()
