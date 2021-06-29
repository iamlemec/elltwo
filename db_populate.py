import os
import argparse
from datetime import datetime

from db_setup import Article, Paragraph, Paralink, Bib, ExtRef, User, TextShard
from db_query import ElltwoDB

parser = argparse.ArgumentParser(description='Populate elltwo database.')
parser.add_argument('--path', type=str, default='elltwo.db', help='Path to sqlite database file')
args = parser.parse_args()

edb = ElltwoDB(path=args.path, create=True, reindex=False)

edb.session.query(ExtRef).delete()
edb.session.query(Bib).delete()
edb.session.query(Paralink).delete()
edb.session.query(Paragraph).delete()
edb.session.query(Article).delete()
edb.session.query(User).delete()
edb.session.query(TextShard).delete()
edb.session.commit()

now = datetime.utcnow()

for fname in os.listdir('testing'):
    if fname.endswith(".md"):
        title, _ = os.path.splitext(fname)
        mark = open(f'testing/{fname}').read()
        edb.import_markdown(title, mark, time=now)
