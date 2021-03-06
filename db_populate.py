import os
import argparse
from datetime import datetime

from db_setup import Article, Paragraph, Paralink, Bib, ExtRef
from db_query import AxiomDB, import_markdown

parser = argparse.ArgumentParser(description='Axiom2 server.')
parser.add_argument('path', type=str, default='axiom.db', help='Path to sqlite database file')
args = parser.parse_args()

adb = AxiomDB(args.path)

adb.session.query(ExtRef).delete()
adb.session.query(Bib).delete()
adb.session.query(Paralink).delete()
adb.session.query(Paragraph).delete()
adb.session.query(Article).delete()

now = datetime.utcnow()

art = Article(aid=0, title='Abraham Lincoln', short_title='abraham_lincoln', create_time=now)
par0 = Paragraph(aid=0, pid=0, text='# Abraham Lincoln', create_time=now)
par1 = Paragraph(aid=0, pid=1, text='He was a dude.', create_time=now)
par2 = Paragraph(aid=0, pid=2, text='He got shot.', create_time=now)
lin0 = Paralink(aid=0, pid=0, next=1, create_time=now)
lin1 = Paralink(aid=0, pid=1, prev=0, next=2, create_time=now)
lin2 = Paralink(aid=0, pid=2, prev=1, create_time=now)

adb.session.add(art)
adb.session.add_all([par0, par1, par2])
adb.session.add_all([lin0, lin1, lin2])
adb.session.commit()

for fname in os.listdir('testing'):
    title, _ = os.path.splitext(fname)
    mark = open(f'testing/{fname}').read()
    adb.import_markdown(title, mark, time=now)
