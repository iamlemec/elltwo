#!/usr/bin/bash

python -u console --db=/opt/data/elltwo.db backup load testing
python -u server.py --db=/opt/data/elltwo.db --ip=0.0.0.0 --theme=white --demo
