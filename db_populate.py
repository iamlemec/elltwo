import os
import argparse
from datetime import datetime

from db_setup import Article, Paragraph, Paralink, Bib, ExtRef, User, TextShard
from db_query import AxiomDB

parser = argparse.ArgumentParser(description='Axiom2 server.')
parser.add_argument('--path', type=str, default='axiom.db', help='Path to sqlite database file')
args = parser.parse_args()

adb = AxiomDB(path=args.path, create=True, reindex=False)

adb.session.query(ExtRef).delete()
adb.session.query(Bib).delete()
adb.session.query(Paralink).delete()
adb.session.query(Paragraph).delete()
adb.session.query(Article).delete()
adb.session.query(User).delete()
adb.session.query(TextShard).delete()
adb.session.commit()

now = datetime.utcnow()

for fname in os.listdir('testing'):
    if fname.endswith(".md"):
        title, _ = os.path.splitext(fname)
        mark = open(f'testing/{fname}').read()
        adb.import_markdown(title, mark, time=now)
