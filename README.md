<div align="center">
<img src="static/favicon/elltwo.svg" alt="logo" />
</div>

# elltwo

**elltwo** (ℓ²) is a browser-based platform collaborative technical document creation. It has a wiki like structure with an emphasis on typesetting and intelligent referencing. Articles are written in a simple markup language borrowing elements of [Markdown](https://en.wikipedia.org/wiki/Markdown) and [LaTeX](https://www.latex-project.org/).

Try the live editing demo at: [elltwo.io/demo](http://elltwo.io/demo). Here's a quick preview below

<div align="center">
<img src="static/features/elltwo.gif" alt="preview gif"></img>
</div>

## Setup

To install, simply clone this repository locally. Install the necessary Python packages with

```
pip install -r requirements.txt
```

Install and build the web content with

```
node install
npm run build
```

Start a locally usable server by running

```
python server.py
```

All data is stored in a single SQLite database. This command will use the default database path (`elltwo.db`) and create it if necessary. To use an alternative database path (such as `path.db`), append `--db=path.db` to the above command.

The server is only visible locally be default. To make the server visible to the outside world, append `--ip=0.0.0.0` to the above command.

## Usage

The home page provides full text search over all articles and the ability to create new articles.

Once in a particular article, the editor operates on a cell-by-cell basis. At any given time, either no cells are active, one cell is active (akin to a cursor), or one cell is being edited. You can switch between these modes using the mouse or `Enter`/`Escape`.

Saving happens automatically. You can also revert back to any previous point in the editing history using the history explorer at the bottom. Additionally, when multiple people are editing an article simultaneously, locking occurs at the cell level.

The create new cells, use either `a` or `b` depending on whether you want it above or below the current active cell. For a comprehensive list of keyboard commands, press `F1` in the editor.

The editor has two top-level states that can be toggled in the status bar at the bottom. One controls whether you are in classic editing mode or side-by-side editing mode. The other controls whether you are in read-only mode or edititing mode.

## Console

There is a command line console available to inspect and manipulate data on the backend, in the form of the `console.py` file. For instance, to list all articles, simply run

```
./console.py art list
```

This also exposes backup/restore facilities. To load markdown files from a directory (for instance the `testing` directory in this repo) run

```
./console.py backup load testing --db=testing.db
```

To save, use the `backup save` sub-command. Note that one can also provide a zip file for both load and save.
