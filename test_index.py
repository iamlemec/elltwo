# bespoke text indexing

from operator import itemgetter
from collections import defaultdict

from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import Session
from sqlalchemy.ext.declarative import declarative_base

## table schema

Base = declarative_base()

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

## text functions

def analyzer(s):
    return s.lower().split()

def shardify(text, size=3):
    shgen = zip(*[text[k:len(text)-(size-1-k)] for k in range(size)])
    return [(''.join(x), i) for i, x in enumerate(shgen)]

def shardify_document(doc, analyzer=str.split, size=3):
    if type(doc) is str:
        doc = analyzer(doc)
    return {i: shardify(w, size=size) for i, w in enumerate(doc)}

def shard_compress(shards):
    count = defaultdict(int)
    posit = defaultdict(int)
    for t, i in shards:
        count[t] += 1
        posit[t] += i
    return {t: (posit[t]/count[t], count[t]) for t in count}

def dist_score(p1, p2):
    return max(0.75, 1/(1+0.25*abs(p1-p2)))

def shard_score(shards1, shards2):
    score = 0
    ntoks = 0
    for t, (p1, c1) in shards1.items():
        ntoks += c1
        if t in shards2:
            p2, c2 = shards2[t]
            score += min(c1, c2)*dist_score(p1, p2)
    return score/ntoks

## index corpus

class Indexer:
    def __init__(self, analyzer=analyzer, shard_size=3):
        self.shard_size = shard_size
        self.analyzer = analyzer

        engine = create_engine("sqlite+pysqlite:///:memory:")
        self.session = Session(engine)
        Base.metadata.create_all(bind=engine)

    def shardify(self, doc):
        words = [f' {w} ' for w in self.analyzer(doc)]
        return shardify_document(words, size=self.shard_size)

    def index_document(self, ident, text, dtype='title', commit=True):
        for wid, shards in self.shardify(text).items():
            for tok, pos in shards:
                ent = TextShard(
                    text=tok, word_idx=wid, word_pos=pos,
                    source_type=dtype, source_id=ident
                )
                self.session.add(ent)
        if commit:
            self.session.commit()

    def index_corpus(self, corpus):
        for i, doc in corpus.items():
            self.index_document(i, doc, commit=False)
        self.session.commit()

    def search_string(self, text):
        # shardify query
        shards = {i: shard_compress(s) for i, s in self.shardify(text).items()}
        toks = set.union(*[set(s.keys()) for s in shards.values()])

        # get potential matches (move this to all-sql when finalized)
        query = self.session.query(TextShard).filter(TextShard.text.in_(toks))
        match = defaultdict(list)
        for s in query.all():
            match[(s.source_id, s.word_idx)].append((s.text, s.word_pos))
        match = {i: shard_compress(sh) for i, sh in match.items()}

        # compute distance metrics
        sims = defaultdict(list)
        for (i, j), m in match.items():
            sims[i].append(max(shard_score(s, m) for s in shards.values()))
        sims = [(k, sum(v)/len(shards)) for k, v in sims.items()]

        # return sorted decreasing
        return sorted(sims, key=itemgetter(1), reverse=True)

if __name__ == '__main__':
    # test corpus
    test_corpus = dict(enumerate([
        'random title', 'text data', 'unit of transit', 'axiom elltwo',
        'axioid', 'title rando', 'estimators of gold', 'text the fish',
        'steve ballmer', 'axiom'
    ]))

    # create interface
    idx = Indexer()
    idx.index_corpus(test_corpus)
