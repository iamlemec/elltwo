from flask import Flask, request, redirect, url_for, render_template, jsonify, make_response
from flask_socketio import SocketIO, send, emit, join_room, leave_room
#app = Flask(__name__)

import os, re, datetime, time, json, argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# from sqlalchemy.sql import func
# from random import randint

#import DM models
from db_setup import Article, Paragraph, Paralink, Bib, db, app

#import article mgmt
import db_query as dbq

session = db.session

# socket setup
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

###
### Home Page
###

@app.route('/')
@app.route('/home')
def Home():
    return render_template('home.html', theme=args.theme)

@app.route('/create', methods=['POST'])
def Create():
    art_name =request.form['new_art']
    art = dbq.get_art_short(art_name)
    if art:
        return  redirect(url_for('RenderArticle', title=art_name))
    else:
        dbq.create_article(art_name)
        return redirect(url_for('RenderArticle', title=art_name))

###
### Article
###

@app.route('/a/<title>', methods=['GET'])
def RenderArticle(title):
    art = dbq.get_art_short(title)
    if art:
        paras = dbq.get_paras(art.aid)
        return render_template(
            'article.html',
            title=art.title,
            aid=art.aid,
            paras=paras,
            theme=args.theme
        )
    else:
        return render_template('home.html')

@app.route('/b', methods=['GET'])
def RenderBib():
    return render_template('bib.html',theme=args.theme)

###
### socketio handler
###

def send_command(cmd, data=None, broadcast=False, include_self=True, room=False):
    emit('json', {'cmd': cmd, 'data': data}, broadcast=broadcast, include_self=include_self,)

@socketio.on('connect')
def socket_connect():
    print('Client connected')
    emit('status', 'connected')

@socketio.on('disconnect')
def socket_disconnect():
    print('Client disconnected')
    emit('status', 'disconnected')

@socketio.on('room')
def room(data):
    room = data['room']
    join_room(room)
    return('joined room:' + room)

###
### arbitrary command
###

@socketio.on('json')
def socket_json(json):
    cmd = json['cmd']
    data = json['data']
    print(f'received [{cmd}]: {data}')
    if cmd == 'echo':
        return data
    else:
        print(f'Unknown command: {cmd}')

###
### para editing
###

@socketio.on('update_para')
def update_para(data):
    dbq.update_para(data['pid'], data['text'])
    emit('updatePara',
        [data['pid'], data['text']],
        include_self=False,
        room=data['room'])
    return True

@socketio.on('update_bulk')
def update_bulk(data):
    paras = data['paras']
    dbq.bulk_update(paras)
    emit('updateBulk', paras, include_self=False, room=data['room'])
    return True

@socketio.on('insert_after')
def insert_after(data):
    text = data.get('text', '')
    par1 = dbq.insert_after(data['pid'], text)
    emit('insertPara', [data['pid'], par1.pid, False, text], room=data['room'])
    return True

@socketio.on('insert_before')
def insert_before(data):
    text = data.get('text', '')
    par1 = dbq.insert_before(data['pid'], text)
    emit('insertPara', [data['pid'], par1.pid, True, text], room=data['room'])
    return True

@socketio.on('delete_para')
def delete_para(data):
    dbq.delete_para(data['pid'])
    emit('deletePara', [data['pid']], room=data['room'])
    return True

###
### article editing
###

@socketio.on('create_art')
def create_art(title):
    print(title)
    art = dbq.get_art_short(title)
    if art:
        return url_for('RenderArticle', title=title)
    else:
        dbq.create_article(title)
        return url_for('RenderArticle', title=title)

@socketio.on('search_title')
def search_title(data):
    results = dbq.search_title(data)
    if (results):
        r = {}
        for art in results:
            print('b', art.blurb)
            r[art.title] = {'url': art.short_title, 'blurb': art.blurb}
        return r
    else:
        return False

@socketio.on('set_blurb')
def set_blurb(data):
    aid = data['aid']
    blurb = data['blurb']
    print('set_blurb', aid, blurb)
    dbq.set_blurb(aid, blurb)
    return True

@socketio.on('get_blurb')
def get_blurb(title):
    art = dbq.get_art_short(title)
    if art:
        return art.blurb
    else:
        return False

###
### citations
###

@socketio.on('create_cite')
def create_cite(data):
    dbq.create_cite(data['citationKey'], data['entryType'], **data['entryTags'])
    bib = dbq.get_bib_dict(keys=[data['citationKey']])
    send_command('renderBib', bib, broadcast=True)

@socketio.on('delete_cite')
def delete_cite(data):
    dbq.delete_cite(data['key'])
    send_command('deleteCite', data['key'], broadcast=True)

@socketio.on('get_bib')
def get_bib(data):
    keys = data['keys']
    if not keys:
        keys=None
    bib = dbq.get_bib_dict(keys=keys)
    send_command('renderBib', bib)

@socketio.on('get_cite')
def get_cite(data):
    bib = dbq.get_bib_dict(keys=data['keys'])
    return bib

###
### external references
###

@socketio.on('get_ref')
def get_ref(data):
    art = dbq.get_art_short(data['title'])
    if art:
        ref = dbq.get_ref(data['key'], art.aid)
        title = art.title
        if ref:
            return {'text': ref.text, 'cite_type': ref.cite_type, 'cite_env': ref.cite_env, 'title': title}
        else:
            return {'text': "", 'cite_type': 'err'}
    else:
        return {'text': "", 'cite_type': 'err'}

@socketio.on('update_ref')
def update_ref(data):
    dbq.create_ref(data['key'], data['aid'], data['cite_type'], data['cite_env'], data['text'])

###
### interface
###

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Axiom2 server.')
    parser.add_argument('--theme', type=str, default='classic', help='Theme CSS to use (if any)')
    parser.add_argument('--debug', action='store_true', help='Run in debug mode')
    args = parser.parse_args()

    app.debug = args.debug
    socketio.run(app, host='0.0.0.0', port=5000)
