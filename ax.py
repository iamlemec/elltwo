from flask import Flask, request, redirect, url_for, render_template, jsonify, make_response
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
    print(paras)
    return render_template('article.html',
        title=art.title,
        paras=paras)




if __name__ == '__main__':
    app.debug = True
    app.run(host='0.0.0.0', port=5000)





