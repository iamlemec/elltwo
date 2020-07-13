from flask import Flask, request, redirect, url_for, render_template, jsonify, make_response
from flask_socketio import SocketIO, send, emit
#app = Flask(__name__)

import os, re, datetime, time, json
from http.server import BaseHTTPRequestHandler, HTTPServer
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# from sqlalchemy.sql import func
# from random import randint

#import DM models
from db_setup import Article, Paragraph, Paralink, db, app

#import article mgmt
import db_query as dbq

session = db.session

# socket setup
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

#function to contruct URL names (Article.short_title)

# def urlify(s):

#      # Remove all non-word characters (everything except numbers and letters)
#      # We should probably make this more robust, to allow escaped chars
#      s = re.sub(r"[^\w\s]", '', s)

#      # Replace all runs of whitespace with a single dash
#      s = re.sub(r"\s+", '_', s)

#      return s.lower()

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
    return render_template('article.html',
        title=art.title,
        paras=paras)

##
## socketio handler
##

def send_command(cmd, data=None):
    emit('json', {'cmd': cmd, 'data': data})

@socketio.on('connect')
def test_connect():
    print('Client connected')
    send_command('status', 'connected')

@socketio.on('disconnect')
def test_disconnect():
    print('Client disconnected')

@socketio.on('json')
def test_json(json):
    cmd = json['cmd']
    data = json['data']
    print(f'received [{cmd}]: {data}')

    if cmd == 'create_art':
        art = dbq.create_article(data['title'])
        send_command('create', art.short_title)
    elif cmd == 'update_para':
        dbq.update_para(data['pid'], data['text'])
        #note: this is inefficent, it resends the text from the server to the client
        #but, it makes sure the commit happend before sending
        send_command('updatePara', [data['pid'], data['text']]) 
    elif cmd == 'delete_para':
        dbq.delete_para(data['pid'])
        send_command('deletePara', [data['pid']]) 
    elif cmd == 'insert_after':
        text = data.get('text', '')
        par1 = dbq.insert_after(data['pid'], text)
        send_command('insert', [data['pid'], par1.pid, False, text])
    elif cmd == 'insert_before':
        text = data.get('text', '')
        par1 = dbq.insert_before(data['pid'], text)
        send_command('insert', [data['pid'], par1.pid, True, text]) 
    else:
        print(f'Unknown command: {cmd}')


if __name__ == '__main__':
    app.debug = True
    socketio.run(app, host='0.0.0.0', port=5000)    
