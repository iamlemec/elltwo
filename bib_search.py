from bs4 import BeautifulSoup
import requests


def getCite(q):
    q = q.replace(' ', '+')
    url = 'https://scholar.google.com/scholar?hl=en&as_sdt=0%2C33&q='+q+'&btnG='
    page = requests.get(url)
    soup = BeautifulSoup(page.text, 'html.parser')

    links = soup.find_all('.gs_citi')


    print(soup.prettify())


getCite('a preference for flexibility')

