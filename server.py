from flask import (
    Flask, Response, Markup,
    request, redirect, url_for, render_template,
    jsonify, flash, send_from_directory, send_file
)
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy, BaseQuery
from flask_mail import Mail, Message

import os, sys, re, json, argparse, toml, secrets
from io import BytesIO
from datetime import datetime
from collections import namedtuple
from random import getrandbits
from http.server import BaseHTTPRequestHandler, HTTPServer
from werkzeug.utils import secure_filename

from werkzeug.security import check_password_hash
from flask_login import LoginManager, current_user, login_user, logout_user, login_required
from itsdangerous import URLSafeTimedSerializer

# import db tools
from db_setup import Article, Paragraph, Paralink, Bib, User
from db_query import ElltwoDB, order_links

# other tools
from tools import Multimap, gen_auth
from pathlib import Path

# necessary hack
from engineio.payload import Payload
Payload.max_decode_packets = 50

###
### parse command line args
###

parser = argparse.ArgumentParser(description='Elltwo server.')
parser.add_argument('--theme', type=str, default='classic', help='Theme CSS to use (if any)')
parser.add_argument('--path', type=str, default='elltwo.db', help='Path to sqlite database file')
parser.add_argument('--ip', type=str, default='127.0.0.1', help='IP address to serve on')
parser.add_argument('--port', type=int, default=5000, help='Main port to serve on')
parser.add_argument('--debug', action='store_true', help='Run in debug mode')
parser.add_argument('--login', action='store_true', help='Require login for editing')
parser.add_argument('--private', action='store_true', help='Require login for viewing/editing')
parser.add_argument('--reindex', action='store_true', help='reindex search database on load')
parser.add_argument('--conf', type=str, default=None, help='path to configuation file')
parser.add_argument('--auth', type=str, default=None, help='user authorization config')
parser.add_argument('--mail', type=str, default=None, help='mail authorization config')
args = parser.parse_args()

###
### general config
###

# enumerate available themes
theme_css = [os.path.splitext(t) for t in os.listdir('static/themes')]
themes = [t for t, e in theme_css if e == '.css']

# get base configuration
config = {
    'timeout': 180, # paragraph lock timeout in seconds
    'max_size': 1024, # max image size in kilobytes
    'max_imgs': 50, # max number of images returned in search
    'themes': themes, # all themes by default
    'demo_path': 'testing/howto.md', # path to demo content
}
if args.conf is not None:
    config |= toml.load(args.conf)

# login decorator (or not)
edit_decor = login_required if (args.login or args.private) else (lambda f: f)
view_decor = login_required if args.private else (lambda f: f)

###
### initialize flask and friends
###

# create flask app
app = Flask(__name__)
app.config['DEBUG'] = args.debug
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{args.path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = True

# load user security config
if args.auth is None:
    auth = gen_auth()
else:
    auth = toml.load(args.auth)
app.config.update(auth)

# load mail security config
if args.mail is not None:
    mail_auth = toml.load(args.mail)
    app.config.update(mail_auth)
    mail = Mail(app)
else:
    MailNull = namedtuple('MailNull', ['send'])
    mail = MailNull(send=lambda _: None)

# load sqlalchemy
db = SQLAlchemy(app)
edb = ElltwoDB(db=db, reindex=args.reindex)

# login manager
login = LoginManager(app)

# create socketio
socketio = SocketIO(app)

# initialize tables
@app.before_first_request
def db_setup():
    edb.create()
    login.user_loader(edb.load_user)

###
### Create global variables for all templets
###

@app.context_processor
def inject_dict_for_all_templates():
    return dict(login=args.login)

###
### Home Page
###

@app.route('/')
@app.route('/home')
@view_decor
def Home():
    style = getStyle(request)
    return render_template('home.html', **style)

@app.route('/create', methods=['POST'])
@edit_decor
def Create():
    art_name = request.form['new_art']
    art = edb.get_art_short(art_name)
    if art:
        return  redirect(url_for('RenderArticle', title=art_name))
    else:
        edb.create_article(art_name)
        return redirect(url_for('RenderArticle', title=art_name))

@app.route('/demo')
@view_decor
def Demo():
    hash_tag = secrets.token_urlsafe(16)
    art_name = f'demo_{hash_tag}'
    with open(config['demo_path']) as fid:
        demo_mark = fid.read()
    edb.import_markdown(art_name, demo_mark)
    return redirect(url_for('RenderArticle', title=art_name))

###
### Auth Routes
###

@app.route('/signup')
def Signup():
    style = getStyle(request)
    return render_template('signup.html', **style)

@app.route('/login',  methods=['GET', 'POST'])
def Login():
    if request.referrer:
        next = request.referrer.replace('/r/', '/a/', 1)
    else:
        next = url_for('Home')
    style = getStyle(request)
    return render_template('login.html', next=next, **style)

def CreateUser():
    email = request.form.get('email')
    name = request.form.get('name')
    password = request.form.get('password')

    user = edb.get_user(email) # if this returns a user, then the email already exists in database

    if user is not None: # if a user is found, we want to redirect back to signup page so user can try again
        lg = url_for('Login')
        msg = Markup(f'An account with this email already exists. <br> <a href={lg} class="alert-link">Click here to log in.</a>')
        flash(msg)
        return redirect(url_for('Signup'))

    edb.add_user(email, name, password)
    send_confirmation_email(email)
    rs = url_for('Resend', email=email)
    msg = Markup(f'Check your email to activate your account. <br> <a href={rs} class="alert-link">Resend.</a>')
    flash(msg)
    return redirect(url_for('Login'))

if not args.private:
    app.add_url_rule('/create_user', CreateUser, methods=['POST'])

@app.route('/confirm/<token>')
def confirm_email(token):
    try:
        email = confirm_token(token)
        user = edb.get_user(email)
    except:
        flash('The confirmation link is invalid or has expired.')
        return redirect(url_for('Signup'))
    if user.confirmed:
        lg = url_for('Login')
        msg = Markup(f'The account is already confirmed. <br> <a href={lg} class="alert-link">Click here to log in.</a>')
        flash(msg)
        return redirect(url_for('Login'))
    else:
        edb.confirm_user(user)
        login_user(user, remember=True) #currently we always store cookies, could make it option
        flash('You have confirmed your account. Thanks!')
    return redirect(url_for('Home'))

@app.route('/resend/<email>')
def Resend(email):
    send_confirmation_email(email)
    rs = url_for('Resend', email=email)
    msg = Markup(f'Check your email to activate your account. <br> <a href={rs} class="alert-link">Resend.</a>')
    flash(msg)
    return redirect(url_for('Home'))

@app.route('/forgot', methods=['GET', 'POST'])
def Forgot():
    style = getStyle(request)
    return render_template('forgot.html', **style)

@app.route('/reset_email', methods=['POST'])
def ResetEmail():
    email = request.form.get('email')
    user = edb.get_user(email)

    if user is not None:
        send_reset_email(email)
        msg = Markup(f'Check your email for a password reset link.')
        flash(msg)
        return redirect(url_for('Home'))
    else:
        msg = Markup(f'No account with email {email}.')
        flash(msg)
        return redirect(url_for('Forgot'))

@app.route('/reset/<email>/<token>', methods=['GET'])
def Reset(email, token):
    style = getStyle(request)
    return render_template('reset.html', email=email, token=token, **style)

@app.route('/reset_with_token/<token>', methods=['POST'])
def ResetWithToken(token):
    password = request.form.get('password')
    try:
        email = confirm_token(token)
        user = edb.get_user(email)
    except:
        flash('The reset link is invalid or has expired.')
        return redirect(url_for('Forgot'))
    edb.update_password(user, password)
    login_user(user, remember=True) #currently we always store cookies, could make it option
    flash('You have reset your password and are logged in.')
    return redirect(url_for('Home'))

@app.route('/login_user', methods=['POST'])
def LoginUser():
    email = request.form.get('email')
    password = request.form.get('password')
    next = request.form.get('next')

    if next == 'this':
        next = request.referrer.replace('/r/', '/a/', 1)

    user = edb.get_user(email)

    # check if the user actually exists
    # take the user-supplied password, hash it, and compare it to the hashed password in the database
    if user is None or not check_password_hash(user.password, password):
        flash('Please check your login details and try again.')
        return redirect(url_for('Login'))
    if not user.confirmed:
        rs = url_for('Resend', email=email)
        msg = Markup(f'Activate your account. <br> <a href={rs} class="alert-link">Click here to resend a confirmation email.</a>')
        flash(msg)
        return redirect(url_for('Login'))

    # if the above check passes, then we know the user has the right credentials
    login_user(user, remember=True) #currently we always store cookies, could make it option
    return redirect(next)

@app.route('/logout_user', methods=['POST'])
@edit_decor
def LogoutUser():
    logout_user()
    return redirect(request.referrer)

def send_confirmation_email(email):
    subject = "Confirm your elltwo account"
    token = create_token(email)
    confirm_url = url_for('confirm_email', token=token, _external=True)
    html = render_template('email_conf.html', confirm_url=confirm_url, confirm=True)
    send_email(email, subject, html)
    # return redirect(url_for('Home'))

def send_reset_email(email):
    subject = "Password reset: elltwo account"
    token = create_token(email)
    confirm_url = url_for('Reset', email=email, token=token, _external=True)
    html = render_template('email_conf.html', confirm_url=confirm_url, confirm=False)
    send_email(email, subject, html)
    # return redirect(url_for('Home'))

def send_email(to, subject, template, logo=True):
    msg = Message(
        subject,
        recipients=[to],
        html=template,
        sender=app.config['MAIL_DEFAULT_SENDER']
        )
    if logo:
        fpp = Path(__file__).parent / "static/img/logofull.png"
        with app.open_resource(fpp) as fp:
                msg.attach(filename="axlogo.png", content_type="image/png", data=fp.read(),
                               disposition="inline", headers=[['Content-ID', '<logo>']])

    mail.send(msg)

def create_token(email):
    serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])
    return serializer.dumps(email, salt=app.config['SECURITY_PASSWORD_SALT'])

def confirm_token(token, expiration=3600):
    serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])
    try:
        out = serializer.loads(
            token,
            salt=app.config['SECURITY_PASSWORD_SALT'],
            max_age=expiration
        )
    except:
        return False
    return out

###
### Article
###

def GetArtData(title, edit, theme=args.theme, font='default', pid=None):
    app.logger.debug(f'article [{pid}]: {title}')
    art = edb.get_art_short(title)
    if art:
        paras = edb.get_paras(art.aid)
        ref_list = []
        bib_list = {}
        if edit:
            bib_list = {cite.citekey: None for cite in edb.get_bib()}
            ref_list = edb.get_refs(art.aid)
        return render_template(
            'article.html',
            title=art.title,
            aid=art.aid,
            g_ref=art.g_ref,
            paras=paras,
            theme=theme,
            font=font,
            pid=pid,
            readonly=not edit,
            ref_list=ref_list,
            bib_list=bib_list,
            themes=config['themes'],
            timeout=config['timeout'],
            max_size=config['max_size'],
        )
    else:
        flash(f'Article "{title}" does not exist.')
        return redirect(url_for('Home'))

def ErrorPage(title='Error', message=''):
    style = getStyle(request)
    return render_template('error.html', title=title, message=message, **style)

def getStyle(request):
    return {
        'theme': request.cookies.get('theme') or args.theme,
        'font': request.cookies.get('font') or 'default',
    }

@app.route('/a/<title>', methods=['GET'])
@view_decor
def RenderArticle(title):
    style = getStyle(request)
    pid = request.args.get('pid')
    if current_user.is_authenticated or not args.login:
        return GetArtData(title, edit=True, pid=pid, **style)
    else:
        return redirect(url_for('RenderArticleRO', title=title))

@app.route('/r/<title>', methods=['GET'])
@view_decor
def RenderArticleRO(title):
    style = getStyle(request)
    return GetArtData(title, edit=False, **style)

@app.route('/i/<key>', methods=['GET'])
@view_decor
def GetImage(key):
    if (img := edb.get_image(key)) is not None:
        buf = BytesIO(img.data)
        return send_file(buf, mimetype=img.mime)
    else:
        flash(f'Image "{key}" does not exist.')
        return redirect(url_for('Home'))

##
## Libraries
##

@app.route('/bib', methods=['GET'])
@view_decor
def RenderBib():
    style = getStyle(request)
    return render_template('bib.html', **style)

@app.route('/img', methods=['GET','POST'])
@view_decor
def Img():
    edit = current_user.is_authenticated or not args.login
    style = getStyle(request)
    img = [(i.key, i.keywords) for i in edb.get_images()]
    img.reverse()
    return render_template('img.html',
        img=img,
        readonly=not edit,
        max_size=config['max_size'],
        max_imgs=config['max_imgs'],
        **style,
    )

###
### socketio handler
###

@socketio.on('connect')
def socket_connect():
    sid = request.sid
    app.logger.debug(f'connect: {sid}')
    emit('status', 'connected')

@socketio.on('disconnect')
def socket_disconnect():
    sid = request.sid
    app.logger.debug(f'disconnect: {sid}')
    aid, pids = locked_by_sid(sid)
    if len(pids) > 0:
        trueUnlock(aid, pids)
    roomed.pop(sid)
    emit('status', 'disconnected')

@socketio.on('join_room')
def room(data):
    sid = request.sid
    app.logger.debug(f'join_room: {sid}')
    room = str(data['room'])
    join_room(room)
    roomed.add(room, sid)
    if data.get('get_locked', False):
        return sum([locked.get(s) for s in roomed.get(room)], [])

###
### para editing
###

@socketio.on('update_para')
@edit_decor
def update_para(data):
    aid, pid, text = data['aid'], data['pid'], data['text']
    edb.update_para(pid, text)
    emit('updatePara', [pid, text], room=str(aid), include_self=False)
    trueUnlock(aid, [pid])
    return True

@socketio.on('insert_para')
@edit_decor
def insert_para(data):
    sid = request.sid
    aid, pid, after, edit, text = (
        data['aid'], data['pid'], data['after'], data['edit'], data['text']
    )
    insert_func = edb.insert_after if after else edb.insert_before
    par1 = insert_func(pid, text)
    new_pid = par1.pid
    emit('insertPara', [pid, new_pid, text, after], room=str(aid), include_self=False)
    if edit:
        trueLock(aid, new_pid, sid)
    return new_pid

@socketio.on('paste_cells')
@edit_decor
def paste_cells(data):
    aid, pid, cb = data['aid'], data['pid'], data['cb']
    if len(cb) == 0:
        return False
    pid_map = edb.paste_after(pid, cb)
    emit('pasteCB', [pid, pid_map], room=str(aid))
    return True

@socketio.on('delete_para')
@edit_decor
def delete_para(data):
    aid, pid = data['aid'], data['pid']
    edb.delete_para(pid)
    emit('deletePara', [pid], room=str(aid), include_self=False)
    return True

@socketio.on('get_commits')
@view_decor
def get_commits(data):
    aid = data['aid']
    dates = edb.get_commits(aid=aid)
    return [d.isoformat().replace('T', ' ') for d in dates]

@socketio.on('get_history')
@view_decor
def get_history(data):
    aid, date = data['aid'], data['date']
    paras = edb.get_paras(aid=aid, time=date)
    diff = edb.diff_article(aid, date)
    return {
        'paras': [(p.pid, p.text) for p in paras],
        'diff': list(diff['para_upd'] | diff['para_add']),
    }

@socketio.on('revert_history')
@edit_decor
def revert_history(data):
    aid, date = data['aid'], data['date']
    app.logger.debug(f'revert_history: {aid} {date}')
    diff = edb.diff_article(aid, date)
    edb.revert_article(aid, diff=diff)
    order = order_links(diff['link_add'])
    edits = {
        'para_add': diff['para_add'],
        'para_del': diff['para_del'],
        'para_upd': diff['para_upd'],
        'position': order,
    }
    emit('applyDiff', edits, room=str(aid))
    return True

###
### article editing
###

@socketio.on('create_art')
@edit_decor
def create_art(title):
    art = edb.get_art_short(title)
    if art:
        return url_for('RenderArticle', title=title)
    else:
        edb.create_article(title)
        return url_for('RenderArticle', title=title)

@socketio.on('search_title')
@view_decor
def search_title(data):
    results = edb.search_title(data)
    return [{
        'url': art.short_title,
        'title': art.title,
        'blurb': art.blurb
    } for art in results]

@socketio.on('search_text')
@view_decor
def search_text(data):
    results = edb.search_text(data)

    aids = set(par.aid for par in results)
    titles = edb.get_art_titles(aids)

    return [{
        'pid': par.pid,
        'title': titles[par.aid]['title'],
        'url': titles[par.aid]['url'],
        'raw': par.text
    } for par in results]

@socketio.on('set_blurb')
@edit_decor
def set_blurb(data):
    aid = data['aid']
    blurb = data['blurb']
    edb.set_blurb(aid, blurb)
    return True

@socketio.on('get_blurb')
def get_blurb(title):
    art = edb.get_art_short(title)
    if art:
        return art.blurb
    else:
        return False

###
### citations
###

@socketio.on('create_cite')
@edit_decor
def create_cite(data):
    edb.create_cite(data['citationKey'], data['entryType'], **data['entryTags'])
    bib = edb.get_bib_dict(keys=[data['citationKey']])
    socketio.emit('renderBib', bib, broadcast=True)

@socketio.on('delete_cite')
@edit_decor
def delete_cite(data):
    edb.delete_cite(data['key'])
    socketio.emit('deleteCite', data['key'], broadcast=True)

@socketio.on('get_bib')
@view_decor
def get_bib(data):
    keys = data.get('keys', None)
    bib = edb.get_bib_dict(keys=keys)
    socketio.emit('renderBib', bib)

@socketio.on('get_cite')
@view_decor
def get_cite(data):
    bib = edb.get_bib_dict(keys=data['keys'])
    return bib

###
### external references
###

@socketio.on('get_ref')
@view_decor
def get_ref(data):
    art = edb.get_art_short(data['title'])
    if art:
        ref = edb.get_ref(data['key'], art.aid)
        title = art.title
        if ref:
            return {
                'text': ref.text,
                'cite_type': ref.cite_type,
                'cite_env': ref.cite_env,
                'ref_text': ref.ref_text,
                'title': title
            }
        else:
            return {'text': "ref not found", 'cite_type': 'err'}
    else:
        return {'text': "art not found", 'cite_type': 'err'}

@socketio.on('get_refs')
@view_decor
def get_refs(data):
    title = data['title']
    art = edb.get_art_short(title)
    if art:
        refs = edb.get_refs(art.aid)
        return {'refs' : refs, 'title': title }
    else:
        return {'refs': [], 'title': ''}

@socketio.on('get_arts')
@view_decor
def get_arts(data):
    return {art: [] for art in edb.get_art_titles()}

@socketio.on('update_ref')
@edit_decor
def update_ref(data):
    edb.create_ref(**data)

@socketio.on('update_g_ref')
@edit_decor
def update_g_ref(data):
    edb.update_g_ref(data['aid'], data['g_ref'])
    return data['g_ref']

@socketio.on('delete_ref')
@edit_decor
def delete_ref(data):
    edb.delete_ref(data['key'], data['aid'])
    # socketio.emit('deleteRef', data['key'], broadcast=True)

###
### locking
###

# store as strings to avoid confusion
roomed = Multimap()
locked = Multimap()

def locked_by_sid(sid):
    return roomed.loc(sid), locked.get(sid)

def trueUnlock(aid, pids):
    said, spids = str(aid), [str(p) for p in pids]
    rpids = [p for p in spids if locked.pop(p) is not None]
    if len(rpids) > 0:
        socketio.emit('unlock', rpids, room=said)

def trueLock(aid, pid, sid):
    said, spid = str(aid), str(pid)
    if (own := locked.loc(spid)) is not None:
        return own == sid
    locked.add(sid, spid)
    emit('lock', [spid], room=said, include_self=False)
    return True

@socketio.on('lock')
@edit_decor
def lock(data):
    sid = request.sid # unique client id
    aid, pid = data['aid'], data['pid']
    return trueLock(aid, pid, sid)

@socketio.on('unlock')
@edit_decor
def unlock(data):
    aid, pids = data['aid'], data['pids']
    trueUnlock(aid, pids)

@socketio.on('timeout')
@view_decor
def timeout(data):
    sid = request.sid
    app.logger.debug(f'timeout: {sid}')
    aid, pids = locked_by_sid(sid)
    if len(pids) > 0:
        trueUnlock(aid, pids)

###
### image handling
###

@app.route('/uploadImg', methods=['POST'])
@edit_decor
def UploadImg():
    file = request.files['file']
    img_key = request.form.get('key')
    img_mime = file.mimetype

    buf = BytesIO()
    file.save(buf)
    val = buf.getvalue()

    edb.create_image(img_key, img_mime, val)

    return {'mime': img_mime, 'key': img_key}

@socketio.on('get_image')
@view_decor
def get_image(data):
    key = data['key']
    if (img := edb.get_image(key)) is not None:
        return {'found': True, 'mime': img.mime, 'data': img.data, 'kw': img.keywords}

@socketio.on('update_image_key')
@edit_decor
def update_img_key(data):
    key = data['key']
    new_key = data['new_key']
    new_kw = data['new_kw']
    found = edb.update_image_key(key=key, new_key=new_key, new_kw=new_kw)
    return found

##
## run that babeee
##

# run through socketio event loop
socketio.run(app, host=args.ip, port=args.port)
