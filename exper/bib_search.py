#from bs4 import BeautifulSoup
import requests
import json

bibmap = {
    'journal-article': 'article',
    'book-chapter': 'incollection',
    'dataset': 'techreport',
}

def getCite(q):
    q = q.replace(' ', '+')
    url = "https://api.crossref.org/works?rows=5&query.bibliographic="

    data = requests.get(url+q)
    json_data = json.loads(data.content)
    arts = []
    x = json_data['message']['items']
    for art in x:
        keys = set(['title', 'author', 'published-print'])
        if(keys.issubset(art.keys())):
            bibtex = {}
            bibtex['title'] = art['title'][0]
            authors = [a['family'] +", " + a['given'] for a in art['author']]
            bibtex['author'] = ' and '.join(authors)
            bibtex['year'] = str(art['published-print']['date-parts'][0][0])
            if('volume' in art.keys()):
                bibtex['volume'] = art['volume']
            if('page' in art.keys()):
                bibtex['pages'] = art['page']
            if('publisher' in art.keys()):
                bibtex['publisher'] = art['publisher']
            if('DOI' in art.keys()):
                bibtex['DOI'] = art['DOI']
            if('type' in art.keys()):
                bibtex['entry_type'] = bibmap[art['type']]
            if('container-title' in art.keys()):
                if (bibtex['entry_type']=='article'):
                    bibtex['journal'] = art['container-title'][0]
                elif (bibtex['entry_type']=='incollection'):
                    bibtex['booktitle'] = art['container-title'][0]
            bibtex['citekey'] = art['author'][0]['family'].lower() + bibtex['year'] + bibtex['title'].split(' ')[0]
            arts.append(bibtex)
    print('*****')
    toBibtexStr(arts)

def toBibtexStr(arts):
    bibtex = []
    for art in arts:
        bt = f'''@{art['entry_type']}{{{art['citekey']}'''
        keys = set(art.keys())
        nonkeys = set(['citekey', 'entry_type']);
        for key in keys.difference(nonkeys):
            bt += ', ' + key + '={' + art[key] + '}'
        
        bt += "}"
        bibtex.append(bt)
    print(bibtex)


getCite('state space precludes unawareness')

