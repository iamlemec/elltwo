from flask import (
    Flask, Response, Markup,
    request, redirect, url_for, render_template,
    jsonify, flash, send_from_directory, send_file
)
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy, BaseQuery
from flask_mail import Mail, Message

import os, re, json, argparse, toml
from io import BytesIO
from datetime import datetime, timedelta
from collections import namedtuple
from random import getrandbits
from http.server import BaseHTTPRequestHandler, HTTPServer
from apscheduler.schedulers.background import BackgroundScheduler
from werkzeug.utils import secure_filename

from werkzeug.security import check_password_hash
from flask_login import LoginManager, current_user, login_user, logout_user, login_required
from itsdangerous import URLSafeTimedSerializer

# import db tools
from db_setup import Article, Paragraph, Paralink, Bib, User
from db_query import AxiomDB, order_links

# other tools
from tools import Multimap
from pathlib import Path

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
parser.add_argument('--auth', type=str, default='auth.toml', help='user authorization config')
parser.add_argument('--mail', type=str, default=None, help='mail authorization config')
parser.add_argument('--max-size', type=int, default=1024, help='max image size in kilobytes')
parser.add_argument('--reindex', action='store_true', help='reindex search database on load')
args = parser.parse_args()

# login decorator (or not)
login_decor = login_required if args.login else (lambda f: f)

# start scheduler
sched = BackgroundScheduler(daemon=True)
sched.start()

# create flask app
app = Flask(__name__)
app.config['DEBUG'] = args.debug
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{args.path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = True

# load user security config
if args.auth is not None:
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
adb = AxiomDB(db=db, reindex=args.reindex)

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

# @app.route('/favicon.ico')
# def favicon():
#     return send_from_directory(os.path.join(app.root_path, 'static'),
#                           'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/')
@app.route('/home')
def Home():
    theme=request.cookies.get('theme') or args.theme
    return render_template('home.html', theme=theme)

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

# demo setup
demo_path = 'testing/howto.md'
rand_hex = lambda s: hex(getrandbits(4*s))[2:].zfill(s)

@app.route('/demo')
def Demo():
    hash_tag = rand_hex(8)
    art_name = f'demo_{hash_tag}'
    with open(demo_path) as fid:
        demo_mark = fid.read()
    adb.import_markdown(art_name, demo_mark)
    return redirect(url_for('RenderArticle', title=art_name))

###
### Auth Routes
###

@app.route('/signup')
def Signup():
    theme=request.cookies.get('theme') or args.theme
    return render_template('signup.html', theme=theme)

@app.route('/login',  methods=['GET', 'POST'])
def Login():
    if request.referrer:
        next = request.referrer.replace('/r/', '/a/', 1)
    else:
        next = url_for('Home')
    theme=request.cookies.get('theme') or args.theme
    return render_template('login.html', next=next, theme=theme)

@app.route('/create_user', methods=['POST'])
def CreateUser():
    email = request.form.get('email')
    name = request.form.get('name')
    password = request.form.get('password')

    user = adb.get_user(email) # if this returns a user, then the email already exists in database

    if user is not None: # if a user is found, we want to redirect back to signup page so user can try again
        lg = url_for('Login')
        msg = Markup(f'An account with this email already exists. <br> <a href={lg} class="alert-link">Click here to log in.</a>')
        flash(msg)
        return redirect(url_for('Signup'))

    adb.add_user(email, name, password)
    send_confirmation_email(email)
    rs = url_for('Resend', email=email)
    msg = Markup(f'Check your email to activate your account. <br> <a href={rs} class="alert-link">Resend.</a>')
    flash(msg)
    return redirect(url_for('Login'))

@app.route('/confirm/<token>')
def confirm_email(token):
    try:
        email = confirm_token(token)
        user = adb.get_user(email)
    except:
        flash('The confirmation link is invalid or has expired.')
        return redirect(url_for('Signup'))
    if user.confirmed:
        lg = url_for('Login')
        msg = Markup(f'The account is already confirmed. <br> <a href={lg} class="alert-link">Click here to log in.</a>')
        flash(msg)
        return redirect(url_for('Login'))
    else:
        adb.confirm_user(user)
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

@app.route('/forgot',  methods=['GET', 'POST'])
def Forgot():
    theme=request.cookies.get('theme') or args.theme
    return render_template('forgot.html', theme=theme)

@app.route('/reset_email', methods=['POST'])
def ResetEmail():
    email = request.form.get('email')
    user = adb.get_user(email)

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
    theme=request.cookies.get('theme') or args.theme
    return render_template('reset.html', email=email, token=token, theme=theme)

@app.route('/reset_with_token/<token>', methods=['POST'])
def ResetWithToken(token):
    password = request.form.get('password')
    try:
        email = confirm_token(token)
        user = adb.get_user(email)
    except:
        flash('The reset link is invalid or has expired.')
        return redirect(url_for('Forgot'))
    adb.update_password(user, password)
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

    user = adb.get_user(email)

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
@login_decor
def LogoutUser():
    logout_user()
    return redirect(request.referrer)

def send_confirmation_email(email):
    subject = "Confirm your Axiom L2 account"
    token = create_token(email)
    confirm_url = url_for('confirm_email', token=token, _external=True)
    html = render_template('email_conf.html', confirm_url=confirm_url, confirm=True)
    send_email(email, subject, html)
    # return redirect(url_for('Home'))

def send_reset_email(email):
    subject = "Password Reset: Axiom L2 account"
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

def GetArtData(title, edit, theme):
    themes = [t[:-4] for t in os.listdir('static/themes/')]
    art = adb.get_art_short(title)
    if art:
        aid = art.aid
        paras = adb.get_paras(aid)
        ref_list = []
        if edit:
            bib_list = [cite.citekey for cite in adb.get_bib()]
            ref_list = adb.get_refs(aid)
            ref_list += bib_list
        return render_template(
            'article.html',
            title=art.title,
            aid=art.aid,
            paras=paras,
            theme=theme,
            themes=themes,
            max_size=args.max_size,
            edit=edit,
            ref_list=ref_list,
            g_ref=art.g_ref,
        )
    else:
        flash(f'Article "{title}" does not exist.')
        return redirect(url_for('Home'))

def ErrorPage(title='Error', message=''):
    theme=request.cookies.get('theme') or args.theme
    return render_template('error.html', title=title, message=message, theme=theme)

@app.route('/a/<title>', methods=['GET'])
def RenderArticle(title):
    theme=request.cookies.get('theme') or args.theme
    if current_user.is_authenticated or not args.login:
        return GetArtData(title, True, theme=theme)
    else:
        return redirect(url_for('RenderArticleRO', title=title))

@app.route('/r/<title>', methods=['GET'])
def RenderArticleRO(title):
    theme=request.cookies.get('theme') or args.theme
    return GetArtData(title, False, theme=theme)

@app.route('/i/<key>', methods=['GET'])
def GetImage(key):
    print(f'GetImage: {key}')
    if (img := adb.get_image(key)) is not None:
        buf = BytesIO(img.data)
        return send_file(buf, mimetype=img.mime)
    else:
        flash(f'Image "{key}" does not exist.')
        return redirect(url_for('Home'))

### exporting

@app.route('/em/<title>', methods=['GET'])
def ExportMarkdown(title):
    art = adb.get_art_short(title)
    md = adb.get_art_text(art.aid)
    fname = f'{title}.md'

    resp = Response(md)
    resp.headers['Content-Type'] = 'text/markdown'
    resp.headers['Content-Disposition'] = f'attachment; filename={fname}'

    return resp

@app.route('/et', methods=['GET', 'POST'])
def export_tex():
    data = request.form['data']
    data = json.loads(data)

    title = data['title']
    in_title = data['in_title']
    paras = data['paras']
    bib = adb.get_bib_dict(keys=data['keys'])
    macros = data['macros']
    s_envs = data['s_envs']

    fname = f'{title}.tex'

    tex = render_template('template.tex',
        in_title=in_title,
        paras=paras, bib=bib,
        macros=macros,
        s_envs=s_envs,
        date=datetime.now())

    resp = Response(tex)
    resp.headers['Content-Type'] = 'text/tex'
    resp.headers['Content-Disposition'] = f'attachment; filename={fname}'

    return resp

@app.route('/b', methods=['GET'])
def RenderBib():
    theme=request.cookies.get('theme') or args.theme
    return render_template('bib.html', theme=theme)

@app.route('/img', methods=['GET','POST'])
def Img():
    edit = current_user.is_authenticated or not args.login
    theme=request.cookies.get('theme') or args.theme
    imgs = [[i.key, i.keywords] for i in adb.get_images()]
    imgs.reverse()
    return render_template('img.html',
        imgs=imgs,
        theme=theme,
        max_size=args.max_size,
        edit=edit,
    )

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
        trueUnlock(data)
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

@socketio.on('paste_cells')
@login_decor
def paste_cells(data):
    pid = data.get('pid')
    cb = data.get('cb')
    print(cb)
    if not cb:
        return False
    pid_map = adb.paste_after(pid=pid,cb=cb)
    emit('pasteCB', [data['pid'], pid_map], room=data['room'])
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
    diff = adb.diff_article(data['aid'], data['date'])
    return {
        'paras': [(p.pid, p.text) for p in paras],
        'diff': list(diff['para_upd'] | diff['para_add']),
    }


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
    return {
        art.title: {
            'url': art.short_title,
            'title': art.title,
            'blurb': art.blurb
        } for art in results
    }

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
def get_refs(data):
    title = data['title']
    art = adb.get_art_short(title)
    if art:
        refs = adb.get_refs(art.aid)
        return {'refs' : refs, 'title': title }
    else:
        return {'refs': [], 'title': ''}

@socketio.on('get_arts')
def get_arts(data):
    return {art: [] for art in adb.get_art_titles()}

@socketio.on('update_ref')
@login_decor
def update_ref(data):
    #adb.create_ref(data['key'], data['aid'], data['cite_type'], data['cite_env'], data['text'], data['ref_text'])
    adb.create_ref(**data)

@socketio.on('update_g_ref')
def update_g_ref(data):
    adb.update_g_ref(data['aid'], data['g_ref'])
    return data['g_ref']

@socketio.on('delete_ref')
@login_decor
def delete_ref(data):
    adb.delete_ref(data['key'],data['aid'])
    #socketio.emit('deleteRef', data['key'], broadcast=True)

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

def trueUnlock(data):
    pids = data['pids']
    aid = data['room']
    rpid = [p for p in pids if locked.pop(p) is not None]
    socketio.emit('unlock', rpid, room=aid) # since called exernally

@socketio.on('unlock')
@login_decor
def unlock(data):
    trueUnlock(data)

def locked_by_sid(sid):
    return {
        'pids': locked.get(sid),
        'room': roomed.loc(sid),
    }

###
### image handling
###

@app.route('/uploadImg', methods=['POST'])
def UploadImg():
    file = request.files['file']
    img_key = request.form.get('key')
    img_mime = file.mimetype

    buf = BytesIO()
    file.save(buf)
    val = buf.getvalue()

    print(f'UploadImg [{img_key}]: {img_mime} mime, {len(val)} bytes')
    adb.create_image(img_key, img_mime, val)

    return {'mime': img_mime, 'key': img_key}

@socketio.on('get_image')
def get_image(data):
    key = data['key']
    if (img := adb.get_image(key)) is not None:
        return {'found': True, 'mime': img.mime, 'data': img.data, 'kw': img.keywords}
    else:
        return {'found': False}

@socketio.on('update_image_key')
def update_img_key(data):
    print(data)
    key = data['key']
    new_key = data['new_key']
    new_kw = data['new_kw']
    adb.update_image_key(key=key, new_key=new_key, new_kw=new_kw)
    return {'found': True}

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
