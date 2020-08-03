from flask import Flask, request, redirect, url_for, render_template, jsonify, make_response
from flask_socketio import SocketIO, send, emit
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
#####
######
####### Home Page
######
#####
####

@app.route('/')
@app.route('/home')
def Home():
    return render_template('home.html')

####
#####
######
####### Article
######
#####
####

@app.route('/a/<short>', methods=['GET'])
def RenderArticle(short):
    art = dbq.get_art_short(short)
    paras = dbq.get_paras(art.aid)
    return render_template(
        'article.html',
        title=art.title,
        paras=paras,
        theme=args.theme
    )

@app.route('/b', methods=['GET'])
def RenderBib():
    return render_template('bib.html',
        )

##
## socketio handler
##

def send_command(cmd, data=None, broadcast=False, include_self=True):
    emit('json', {'cmd': cmd, 'data': data}, broadcast=broadcast, include_self=include_self)

@socketio.on('connect')
def socket_connect():
    print('Client connected')
    emit('status', 'connected')

@socketio.on('disconnect')
def socket_disconnect():
    print('Client disconnected')
    emit('status', 'disconnected')

@socketio.on('json')
def socket_json(json):
    cmd = json['cmd']
    data = json['data']
    print(f'received [{cmd}]: {data}')

    if cmd == 'create_art':
        art = dbq.create_article(data['title'])
        send_command('create', art.short_title)
    elif cmd == 'update_para':
        dbq.update_para(data['pid'], data['text'])
        # note: this is inefficent, it resends the text from the server to the client
        # but, it makes sure the commit happend before sending
        send_command('updatePara', [data['pid'], data['text']], broadcast=True, include_self=False)
        return True
    elif cmd == 'update_bulk':
        dbq.bulk_update(data)
        #force update for other open windows
        send_command('update_bulk', data, broadcast=True, include_self=False)
        return True
    elif cmd == 'delete_para':
        dbq.delete_para(data['pid'])
        send_command('deletePara', [data['pid']])
    elif cmd == 'insert_after':
        text = data.get('text', '')
        par1 = dbq.insert_after(data['pid'], text)
        send_command('insert', [data['pid'], par1.pid, False, text])
        return True
    elif cmd == 'insert_before':
        text = data.get('text', '')
        par1 = dbq.insert_before(data['pid'], text)
        send_command('insert', [data['pid'], par1.pid, True, text])
        return True
    elif cmd == 'create_cite':
        dbq.create_cite(data['citationKey'], data['entryType'], **data['entryTags'])
        bib = dbq.get_bib_dict(keys=[data['citationKey']])
        send_command('renderBib', bib, broadcast=True)
    elif cmd == 'get_bib':
        keys = data['keys']
        if not keys:
            keys=None
        bib = dbq.get_bib_dict(keys=keys)
        send_command('renderBib', bib)
    elif cmd == 'get_cite':
        bib = dbq.get_bib_dict(keys=data['keys'])
        return bib
    elif cmd == 'delete_cite':
        dbq.delete_cite(data['key'])
        send_command('deleteCite', data['key'], broadcast=True)
    elif cmd == 'echo':
        return data
    else:
        print(f'Unknown command: {cmd}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Axiom2 server.')
    parser.add_argument('--theme', type=str, default=None, help='Theme CSS to use (if any)')
    parser.add_argument('--debug', action='store_true', help='Run in debug mode')
    args = parser.parse_args()

    app.debug = args.debug
    socketio.run(app, host='0.0.0.0', port=5000)
