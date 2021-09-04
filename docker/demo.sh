#!/usr/bin/bash

# global options
E2DB="/opt/data/elltwo.db"
ADDR="0.0.0.0"

# create database if needed
if [ ! -f "${E2DB}" ]; then
    python -u console.py --db="${E2DB}" backup load testing
fi

# start server
python -u server.py --db="${E2DB}" --ip="${ADDR}" --demo
