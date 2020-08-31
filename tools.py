from collections import defaultdict

class Multimap:
    def __init__(self):
        self._sets = defaultdict(set)
        self._locs = {}

    def __repr__(self):
        return '\n'.join([f'{loc}: {val}' for loc, val in self._sets.items()])

    def add(self, loc, item):
        if item in self._locs:
            if (loc1 := self._locs[item]) != loc:
                print(f'Item {item} already in set {loc1} (not {loc})')
            return
        self._sets[loc].add(item)
        self._locs[item] = loc

    def drop(self, item):
        if item not in self._locs:
            print(f'Item {item} not found')
            return False
        loc = self._locs.pop(item)
        self._sets[loc].remove(item)
        return True

    def get(self, loc):
        return list(self._sets[loc])

    def loc(self, item):
        if item not in self._locs:
            return None
        else:
            return self._locs[item]
