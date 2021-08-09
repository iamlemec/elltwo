# elltwo

**elltwo** (ℓ²) is a browser based platform for decentralized and collaborative technical documents. It has a wiki like structure with an emphasis on typesetting and intelligent referencing. Articles are written in a simple markup language borrowing elements of [Markdown](https://en.wikipedia.org/wiki/Markdown) and [LaTeX](https://www.latex-project.org/).

Try the live editing demo at: [dohan.io/elltwo_demo](http://dohan.io/elltwo_demo)

## Basic Usage

To install, simply clone this repository locally. Make sure you have the appropriate packages installed by running

```
pip install -r requirements.txt
```

Start a locally usable server by running

```
python server.py
```

To make this available to the outside world append `--ip=0.0.0.0` to the above command.

## Console

There is a command line console available to inspect and manipulate data on the backend, in the form of the `console` file. For instance, to list all articles, simply run

```
./console art list
```
