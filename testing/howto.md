#! How²

**elltwo** ($\ell^2$) is a browser based platform for decentralized and collaborative technical documents. It has a wiki like structure with an emphasis on typesetting and intelligent referencing. elltwo articles are written in a simple markup language barrowing elements of [Markdown](https://en.wikipedia.org/wiki/Markdown) and [LaTeX](https://www.latex-project.org/).

# Structure & Editing

Each article (denoted by a URL) is a collection of cells. Cells contain text which can be styled and referenced individually. For example, a cell could be a paragraph of text (like this one), an equation, an SVG figure, a custom environment, etc. In the same way that articles can be references from other articles in any wiki-like platform, cells that contain a reference can be referenced elsewhere, including across articles.

Cells can be selected by clicking while holding `alt` (`option`) or by pressing `enter` and then navigating with the arrow keys. When a cell is selected, an addition click or `enter` with enter "edit mode." When in edit mode, the raw input of the cell is shown in an editable text box. When edit mode is escaped, by clicking elsewhere or pressing `esc`, changes will be rendered and the formatted text will be displayed. Changes are automatically saved upon rendering, but in the event of a server error or disruption, uncommitted cells are demarcated by a right border.

## Keyboard Navigation

A list of keyboard shortcuts:

- fill this
- with shortcuts

# Formatting

Inline text formatting follows Markdown syntax: single `*italic*` renders as *Italic*, `**bold**` for **bold**, etc. Verbatim text is delimited by left quotes `` `. Inline TeX typesetting is handled by KaTeX and delimited by single dollar signs: `$f: x \mapsto e^x$` renders as $f: x \mapsto e^x$.

## [env] Cell Level Formating

Formatting also takes place at the cell level. A cell is formated by use of a cell **prefix** or string of charecters at the beginging of the cell.

 The most basic formated cell types are *section title cells*, with prefixes of between 1 and 6 `#`'s and *display style TeX cells*, with prefix `$$`. For example:

`` $$ [id=geo] \sum_{i=1}^\infty \frac{1}{2^n} = 1

renders as

$$ [id=geo] \sum_{i=1}^\infty \frac{1}{2^n} = 1

A list of cell prefixes:

- `$$` : display math
- `!svg` : svg (HTML5) code
- `!` : images
- `#` : section headings
- `>>` LaTeX style environments
- `<<` ending multi cell environments
- ` `` ` code (verbatim) blocks

## [env] Environments

Environments are used to format blocks of cells and function in a similar way to LaTeX environments. An environment is opened the prefix `>>` and closed by a subsequent cell with prefix `<<`. Single cell environments use the special prefix `>>!`. For example:

`` >> theorem [id=primes|name=Borel Cantelli] If the sum of the probabilities of the events $\{E_n\}_{n\in \mathbb{N}}$ is finite, then

`` $$ \mu\left(\bigcap_{n=1}^{\infty }\bigcup_{k\geq n}^{\infty }E_{k}\right) = 0

`` << that is, the probability that infinitely many of them occur is $0$.

will format as:

>> theorem [id=primes|name=Borel Cantelli] If the sum of the probabilities of the events $\{E_n\}{n\in \mathbb{N}}$ is finite, then

$$ \mu\left(\bigcap_{n=1}^{\infty }\bigcup_{k\geq n}^{\infty }E_{k}\right) = 0

<< that is, the probability that infinitely many of them occur is $0$.

Prebuilt envrioments include **theorem**, **lemma**, **proof**, and **example**; others can be constructed by augmenting the render.js file.

## [id=args] Passing Arguments

As seen above, you can pass arguments to the cell by means of placing `key=value` pairs inside brackets directly after the cell prefix. Mutiple arguments are separated by `|` or a newline.

Referencing is done through the `id` argument, so `id`s should be unique within articles. The `id` argument can be omitted so that `[geo]` will produce the same reference as `[id=geo]`. Multiple arguments can be set to the same via `[key1=key2=val]`. Keys (and the value for the `id` argument, must be alphanumeric (plus hyphens and underscores).

A partial list of helpful arguments:

- `name`: used for environments to create a displayed name.
- `rt`: used to set the default display text when the environment is referenced.
- `number`: a boolean, to number the environment or not.
- `caption`: used for figures and images to set the caption text.

# [sec_fig] Figures

Cells can also contain figure and images. Images environments begin with an exclamation point `!` and can direct to external images via a URL or internal images using an image ID.

``! [id=img_torus] (https://mathworld.wolfram.com/images/eps-gif/torus_1000.gif)

to render the following figure.

! [id=torus|w=40|caption=An externally hosted image of a torus] (https://www.torus.co.uk/wp-content/themes/torus/images/torus_swoosh.png)

The size of the image can be controlled by passing a `width` or `w` argument, corresponding to percentage of the text width. The caption can be set with the `caption` argument and can be suppressed by setting `caption=none`.

Images can be stored locally, and assessed via an ID. To upload an image render a cell with two exclamation points `!!`. This will create a drag-and-drop image uploader (clicking the upload box will open a file browser).

Cells can also contain figure and images, including HTML5 SVG images. The `&SVG` prefix creates a 100x100 HTML canvas, rendering directly and HTML SVG elements the follow.

!svg [
id=fig
caption=An SVG figure rendered using HTML SVG styling.
w=100
]
<rect x='0' y='0' width='25' height='25', fill='#66AF4C', stroke='#66AF4C'/>
<rect x='0' y='25' width='25' height='25', fill='#5D9D68', stroke='#5D9D68'/>
<rect x='0' y='50' width='25' height='25', fill='#52868A', stroke='#52868A'/>
<rect x='0' y='75' width='25' height='25', fill='#4874A6', stroke='#4874A6'/>
<rect x='25' y='0' width='25' height='25', fill='#8CB13F', stroke='#8CB13F'/>
<rect x='25' y='25' width='25' height='25', fill='#849857', stroke='#849857'/>
<rect x='25' y='50' width='25' height='25', fill='#7A7C73', stroke='#7A7C73'/>
<rect x='25' y='75' width='25' height='25', fill='#72638A', stroke='#72638A'/>
<rect x='50' y='0' width='25' height='25', fill='#BAB230', stroke='#BAB230'/>
<rect x='50' y='25' width='25' height='25', fill='#B39442', stroke='#B39442'/>
<rect x='50' y='50' width='25' height='25', fill='#AB6F57', stroke='#AB6F57'/>
<rect x='50' y='75' width='25' height='25', fill='#A45069', stroke='#A45069'/>
<rect x='75' y='0' width='25' height='25', fill='#E0B423', stroke='#E0B423'/>
<rect x='75' y='25' width='25' height='25', fill='#DA9031', stroke='#DA9031'/>
<rect x='75' y='50' width='25' height='25', fill='#D36541', stroke='#D36541'/>
<rect x='75' y='75' width='25' height='25', fill='#CD404E', stroke='#CD404E'/>

# [ref] Referencing

To create a hyperlink to another article simply encode its static name (i.e., the name corresponding to its URL) in double brackets. `[[howto]]` creates the link [[howto]]. References to existing articles will generate hoverable popups containing the beginning of the article.

Formatted cells or environments which has been passed an `id` argument can be referenced (n.b., id is the default argument, so `[geo]` is equivalent to `[id=geo]`). `@[id]` creates a reference (and, for most cell types, a hoverable popup). For example `@[geo]` creates the reference @[geo]; `@[ref]` creates a reference to this section; `@[primes]` creates a reference to @[primes].

References can also be passed arguments via the same syntax. For example `@[primes|format=plain]` creates a reference to Theorem @[primes|format=plain] but renders only the number.

References can be across articles. To reference an external article use `@[article_name:id]`; for example reference the above equation from a different page would require `@[howto:geo]`.

Typing an `@` will open a command completion window ranging over all extant reference in the current article and bibliographic entries (citekeys); `@:` will search over external article tiles and `@art_title:` will search over references in the article *art_title*.

# [ref] Version Control

Prior versions of an article can be viewed by clicking the  `History` button on the footer of the article. This will open the history navigator, by which you can select to view the article at any prior state. Every commit creates a new instance of the article. The article can be reverted to a prior state by clicking on the particular version, and then clicking the `Revert` button. This will create a new instance of the article (that is, of course, identical to the historical version in question) at the current time. In this way, intermediate states between the current instance and the revision instance are not lost.
