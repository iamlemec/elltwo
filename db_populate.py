import os
import argparse
from datetime import datetime

from db_setup import Base, Article, Paragraph, Paralink, Bib, ExtRef, User, TextShard
from db_query import ElltwoDB

parser = argparse.ArgumentParser(description='Populate elltwo database.')
parser.add_argument('--path', type=str, default='elltwo.db', help='Path to sqlite database file')
args = parser.parse_args()

edb = ElltwoDB(path=args.path, create=True, reindex=False)

for tab in [Article, Paragraph, Paralink, Bib, ExtRef, User, TextShard]:
    edb.session.query(tab).delete()
edb.session.commit()

edb.load_articles('testing')
