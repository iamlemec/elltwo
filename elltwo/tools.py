import os
from collections import defaultdict
from secrets import token_hex

class Multimap:
    def __init__(self, init=None):
        self._sets = defaultdict(set)
        self._locs = {}
        if init is not None:
            self.upd(init)

    def __repr__(self):
        return '\n'.join([f'{loc}: {val}' for loc, val in self._sets.items()])

    def add(self, loc, item):
        if item in self._locs:
            if (loc1 := self._locs[item]) != loc:
                print(f'Item {item} already in set {loc1} (not {loc})')
            return
        self._sets[loc].add(item)
        self._locs[item] = loc

    def has(self, loc):
        return len(self._sets[loc]) > 0

    def upd(self, dic):
        for k, s in dic.items():
            for v in s:
                self.add(k, v)

    def pop(self, item):
        loc = self._locs.pop(item, None)
        if loc is None:
            print(f'Item {item} not found')
            return
        self._sets[loc].remove(item)
        return loc

    def get(self, loc):
        return list(self._sets[loc])

    def loc(self, item):
        return self._locs.get(item, None)

def gen_auth():
    return {
        'SECRET_KEY': token_hex(16),
        'SECURITY_PASSWORD_SALT': token_hex(16),
    }

def get_secret(name):
    if os.path.exists(path := f'/run/secrets/{name}'):
        with open(path) as fid:
            return fid.read()

def secret_dict(keys):
    vals = [get_secret(k) for k in keys]
    return {k: v for k, v in zip(keys, vals) if v is not None}
