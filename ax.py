from flask import Flask, request, redirect, url_for, render_template, jsonify, make_response, flash, send_from_directory
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy

import os, re, json, argparse
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from apscheduler.schedulers.background import BackgroundScheduler

from werkzeug.security import check_password_hash
from flask_login import LoginManager, current_user, login_user, logout_user, login_required

# import db tools
from db_setup import Article, Paragraph, Paralink, Bib, User
from db_query import AxiomDB, order_links

# other tools
from tools import Multimap

###
### initialize flask and friends
###

parser = argparse.ArgumentParser(description='Axiom2 server.')
parser.add_argument('--theme', type=str, default='classic', help='Theme CSS to use (if any)')
parser.add_argument('--path', type=str, default='axiom.db', help='Path to sqlite database file')
parser.add_argument('--ip', type=str, default='127.0.0.1', help='IP address to serve on')
parser.add_argument('--port', type=int, default=5000, help='Main port to serve on')
parser.add_argument('--timeout', type=int, default=180, help='Client timeout time in seconds')
parser.add_argument('--debug', action='store_true', help='Run in debug mode')
parser.add_argument('--login', action='store_true', help='Require login for editing')
args = parser.parse_args()

# login decorator with logging
login_decor = login_required if args.login else (lambda f: f)

# start scheduler
sched = BackgroundScheduler(daemon=True)
sched.start()

# create flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{args.path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = True
app.debug = args.debug

# load sqlalchemy
db = SQLAlchemy(app)
adb = AxiomDB(db=db)

# login manager
login = LoginManager(app)

# create socketio
socketio = SocketIO(app)

# initialize tables
@app.before_first_request
def db_setup():
    adb.create()
    login.user_loader(adb.load_user)

###
### Create global variables for all templets
###

@app.context_processor
def inject_dict_for_all_templates():
    return dict(login=args.login)

###
### Home Page
###

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                          'favicon.ico',mimetype='image/vnd.microsoft.icon')

@app.route('/')
@app.route('/home')
def Home():
    return render_template('home.html', theme=args.theme)

@app.route('/create', methods=['POST'])
@login_decor
def Create():
    art_name =request.form['new_art']
    art = adb.get_art_short(art_name)
    if art:
        return  redirect(url_for('RenderArticle', title=art_name))
    else:
        adb.create_article(art_name)
        return redirect(url_for('RenderArticle', title=art_name))

###
### Auth Routes
###

@app.route('/signup')
def Signup():
    return render_template('signup.html', theme=args.theme)

@app.route('/login',  methods=['GET', 'POST'])
def Login():
    if request.referrer:
        next = request.referrer.replace('/r/', '/a/', 1)
    else:
        next = url_for('Home')
    print(next, type(next))
    return render_template('login.html', next=next, theme=args.theme)

@app.route('/create_user', methods=['POST'])
def CreateUser():
    email = request.form.get('email')
    name = request.form.get('name')
    password = request.form.get('password')

    user = adb.get_user(email) # if this returns a user, then the email already exists in database

    if user is not None: # if a user is found, we want to redirect back to signup page so user can try again
        flash('Email address already exists')
        return redirect(url_for('Signup'))

    adb.add_user(email, name, password)

    return redirect(url_for('Login'))

@app.route('/login_user', methods=['POST'])
def LoginUser():
    email = request.form.get('email')
    password = request.form.get('password')
    next = request.form.get('next')

    if next == 'this':
        next = request.referrer.replace('/r/', '/a/', 1)

    user = adb.get_user(email)

    # check if the user actually exists
    # take the user-supplied password, hash it, and compare it to the hashed password in the database
    if user is None or not check_password_hash(user.password, password):
        flash('Please check your login details and try again.')
        return redirect(url_for('Login')) # if the user doesn't exist or password is wrong, reload the page

    # if the above check passes, then we know the user has the right credentials
    login_user(user, remember=True)
    return redirect(next)

@app.route('/logout_user', methods=['POST'])
@login_decor
def LogoutUser():
    logout_user()
    return redirect(request.referrer)

###
### Article
###

def GetArtData(title, edit):
    themes = [t[:-4] for t in os.listdir('static/themes/')]
    art = adb.get_art_short(title)
    if art:
        aid = art.aid
        paras = adb.get_paras(aid)
        return render_template(
            'article.html',
            title=art.title,
            aid=art.aid,
            paras=paras,
            theme=args.theme,
            themes=themes,
            edit=edit,
        )
    else:
        flash(f'Article "{title}" does not exist.')
        return redirect(url_for('Home'))


@app.route('/a/<title>', methods=['GET'])
def RenderArticle(title):
    if current_user.is_authenticated or not args.login:
        return GetArtData(title, True)
    else:
        return redirect(url_for('RenderArticleRO', title=title))


@app.route('/r/<title>', methods=['GET'])
def RenderArticleRO(title):
    return GetArtData(title, False)


@app.route('/b', methods=['GET'])
def RenderBib():
    return render_template('bib.html', theme=args.theme)

###
### socketio handler
###

@socketio.on('connect')
def socket_connect():
    sid = request.sid
    print(f'connect: {sid}')
    emit('status', 'connected')

@socketio.on('disconnect')
def socket_disconnect():
    sid = request.sid
    print(f'disconnect: {sid}')
    if sched.get_job(sid) is not None:
        sched.remove_job(sid)
    if (data := locked_by_sid(sid)):
        unlock(data)
    roomed.pop(sid)
    emit('status', 'disconnected')

@socketio.on('room')
def room(data):
    sid = request.sid
    room = data['room']
    join_room(room)
    roomed.add(room, sid)
    if data.get('get_locked', False):
        return sum([locked.get(s) for s in roomed.get(room)], [])

###
### para editing
###

@socketio.on('update_para')
@login_decor
def update_para(data):
    adb.update_para(data['pid'], data['text'])
    emit('updatePara',
        [data['pid'], data['text']],
        include_self=False,
        room=data['room'])
    unlock({'room': data['room'], 'pids': [data['pid']]})
    return True

@socketio.on('update_bulk')
@login_decor
def update_bulk(data):
    paras = data['paras']
    adb.bulk_update(paras)
    pids = list(paras.keys())
    emit('updateBulk', paras, include_self=False, room=data['room'])
    unlock({'room': data['room'], 'pids': pids})
    return True

@socketio.on('insert_after')
@login_decor
def insert_after(data):
    text = data.get('text', '')
    par1 = adb.insert_after(data['pid'], text)
    emit('insertPara', [data['pid'], par1.pid, False, text], room=data['room'])
    return True

@socketio.on('insert_before')
@login_decor
def insert_before(data):
    text = data.get('text', '')
    par1 = adb.insert_before(data['pid'], text)
    emit('insertPara', [data['pid'], par1.pid, True, text], room=data['room'])
    return True

@socketio.on('delete_para')
@login_decor
def delete_para(data):
    adb.delete_para(data['pid'])
    emit('deletePara', [data['pid']], room=data['room'])
    return True

@socketio.on('get_commits')
def get_commits(data):
    dates = adb.get_commits(aid=data['aid'])
    return [d.isoformat().replace('T', ' ') for d in dates]

@socketio.on('get_history')
def get_history(data):
    paras = adb.get_paras(aid=data['aid'], time=data['date'])
    return [(p.pid, p.text) for p in paras]

@socketio.on('revert_history')
@login_decor
def revert_history(data):
    print(f'revert_history: aid={data["aid"]} date={data["date"]}')
    diff = adb.diff_article(data['aid'], data['date'])
    adb.revert_article(data['aid'], diff=diff)
    order = order_links(diff['link_add'])
    print(diff)
    edits = {
        'para_add': diff['para_add'],
        'para_del': diff['para_del'],
        'para_upd': diff['para_upd'],
        'position': order,
    }
    print(edits)
    emit('applyDiff', edits, room=data['aid'])
    return True

###
### article editing
###

@socketio.on('create_art')
@login_decor
def create_art(title):
    art = adb.get_art_short(title)
    if art:
        return url_for('RenderArticle', title=title)
    else:
        adb.create_article(title)
        return url_for('RenderArticle', title=title)

@socketio.on('search_title')
def search_title(data):
    results = adb.search_title(data)
    if (results):
        r = {}
        for art in results:
            r[art.title] = {'url': art.short_title, 'blurb': art.blurb}
        return r
    else:
        return False

@socketio.on('set_blurb')
@login_decor
def set_blurb(data):
    aid = data['aid']
    blurb = data['blurb']
    adb.set_blurb(aid, blurb)
    return True

@socketio.on('get_blurb')
def get_blurb(title):
    art = adb.get_art_short(title)
    if art:
        return art.blurb
    else:
        return False

###
### citations
###

@socketio.on('create_cite')
@login_decor
def create_cite(data):
    adb.create_cite(data['citationKey'], data['entryType'], **data['entryTags'])
    bib = adb.get_bib_dict(keys=[data['citationKey']])
    socketio.emit('renderBib', bib, broadcast=True)

@socketio.on('delete_cite')
@login_decor
def delete_cite(data):
    adb.delete_cite(data['key'])
    socketio.emit('deleteCite', data['key'], broadcast=True)

@socketio.on('get_bib')
def get_bib(data):
    keys = data['keys']
    if not keys:
        keys=None
    bib = adb.get_bib_dict(keys=keys)
    socketio.emit('renderBib', bib)

@socketio.on('get_cite')
def get_cite(data):
    bib = adb.get_bib_dict(keys=data['keys'])
    return bib

###
### external references
###

@socketio.on('get_ref')
def get_ref(data):
    art = adb.get_art_short(data['title'])
    if art:
        ref = adb.get_ref(data['key'], art.aid)
        title = art.title
        if ref:
            return {'text': ref.text, 'cite_type': ref.cite_type, 'cite_env': ref.cite_env, 'title': title}
        else:
            return {'text': "", 'cite_type': 'err'}
    else:
        return {'text': "", 'cite_type': 'err'}

@socketio.on('update_ref')
@login_decor
def update_ref(data):
    adb.create_ref(data['key'], data['aid'], data['cite_type'], data['cite_env'], data['text'])

###
### locking
###

roomed = Multimap()
locked = Multimap()

@socketio.on('lock')
@login_decor
def lock(data):
    pid = data['pid']
    aid = data['room']
    sid = request.sid # unique client id
    if (own := locked.loc(pid)) is not None:
        return own == sid
    locked.add(sid, pid)
    timeout_sched(sid)
    emit('lock', [pid], room=aid, include_self=False)
    return True

@socketio.on('unlock')
@login_decor
def unlock(data):
    pids = data['pids']
    aid = data['room']
    rpid = [p for p in pids if locked.pop(p) is not None]
    socketio.emit('unlock', rpid, room=aid) # since called exernally

def locked_by_sid(sid):
    return {
        'pids': locked.get(sid),
        'room': roomed.loc(sid),
    }

###
### timeout
###

def timeout_exec(sid):
    print(f'timeout: {sid}')
    if (data := locked_by_sid(sid)) is not None:
        unlock(data)

def timeout_sched(sid):
    run_date = datetime.now() + timedelta(seconds=args.timeout)
    if sched.get_job(sid) is None:
        sched.add_job(timeout_exec, id=sid, trigger='date', run_date=run_date, args=[sid])
    else:
        sched.reschedule_job(sid, trigger='date', run_date=run_date)

@socketio.on('canary')
def canary(data):
    sid = request.sid
    print(f'canary: {sid}')
    timeout_sched(sid)

##
## run that babeee
##

# run through socketio event loop
socketio.run(app, host=args.ip, port=args.port)
