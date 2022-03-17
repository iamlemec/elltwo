#! How²
\R:\mathbb{R}

**elltwo** ($\ell^2$) is a browser based platform for decentralized and collaborative technical documents. It has a wiki like structure with an emphasis on typesetting and intelligent referencing. elltwo articles are written in a simple markup language barrowing elements of [Markdown](https://en.wikipedia.org/wiki/Markdown) and [LaTeX](https://www.latex-project.org/).

Each article (denoted by a URL) is a collection of cells. Cells contain text which can be styled and referenced individually. For example, a cell could be a paragraph of text (like this one), an equation, an SVG figure, a custom environment, etc. Cells can be referenced from elsewhere, including across articles; references create dynamic links containing the current contents of the reference cell in a popup. For example, @[eq_geo] is a reference to an equation cell below.

# [sec_editing] Structure & Editing

Cells can be selected by clicking while holding `alt` (`option`) or by pressing `enter` and then navigating with the arrow keys. When a cell is selected, an addition click or `enter` with enter "edit mode." When in edit mode, the raw input of the cell is shown in an editable text box. When edit mode is escaped, by clicking elsewhere or pressing `esc`, changes will be rendered and the formatted text will be displayed. Changes are automatically saved upon rendering, but in the event of a server error or disruption, uncommitted cells are demarcated by a right border.

# [sec_formatting] Formatting

Inline text formatting follows Markdown syntax: single `*italic*` renders as *Italic*, `**bold**` for **bold**, etc. Verbatim text is delimited by left quotes `` `. Inline TeX typesetting is handled by [KaTeX](https://katex.org/) and delimited by single dollar signs: `$f: x \mapsto e^x$` renders as $f: x \mapsto e^x$.

## [sec_cellFormatting] Cell Level Formatting

Formatting also takes place at the cell level. A cell is formated by use of a cell **prefix** or string of charecters at the beginging of the cell.

 The most basic formated cell types are *section title cells*, with prefixes of between 1 and 6 `#`'s and *display style TeX cells*, with prefix `$$`. For example:

`` $$ [id=eq_geo] \sum_{i=1}^\infty \frac{1}{2^n} = 1

renders as

$$ [id=eq_geo] \sum_{i=1}^\infty \frac{1}{2^n} = 1

## [sec_environments] Environments

Environments are used to format blocks of cells and function in a similar way to LaTeX environments. An environment is opened the prefix `>>` and closed by a subsequent cell with prefix `<<`. Single cell environments use the special prefix `>>!`. For example:

`` >> theorem [id=primes|name=Borel Cantelli] If the sum of the probabilities of the events $\{E_n\}_{n\in \mathbb{N}}$ is finite, then

`` $$ \mu\left(\bigcap_{n=1}^{\infty }\bigcup_{k\geq n}^{\infty }E_{k}\right) = 0

`` << that is, the probability that infinitely many of them occur is $0$.

will format as:

>> theorem [thm_BC|name=Borel Cantelli] If the sum of the probabilities of the events $\{E_n\}_{n\in \mathbb{N}}$ is finite, then

$$ \mu\left(\bigcap_{n=1}^{\infty }\bigcup_{k\geq n}^{\infty }E_{k}\right) = 0

<< that is, the probability that infinitely many of them occur is $0$.

Prebuilt envrioments include **theorem**, **lemma**, **proof**, **axiom**, **definition**, and **example**; others can be constructed by augmenting the render.js file.

## [sec_args] Passing Arguments

As seen above, you can pass arguments to the cell by means of placing `key=value` pairs inside brackets directly after the cell prefix. Mutiple arguments are separated by `|` or a newline.

Referencing is done through the `id` argument, so `id`s should be unique within articles. The `id` argument can be omitted so that `[geo]` will produce the same reference as `[id=geo]`. Multiple arguments can be set to the same via `[key1=key2=val]`. Keys (and the value for the `id` argument, must be alphanumeric (plus hyphens and underscores).

A partial list of helpful arguments:

- `id`: set the id for referencing
- `name`: used for environments to create a displayed name.
- `rt`: used to set the default display text when the environment is referenced.
- `number`: a boolean, to number the environment or not.
- `caption`: used for figures and images to set the caption text.
- `width`: size of images and figures (% of text width)

## [sec_macros] Macros

Simple TeX macros can be set (at the article level) by augmenting the title cell of the article. Below the title line (i.e., beginning with `#!`), enter one macro per line using `\name:\definition` syntax. For example, in this article `$\R$` will render $\R$ as the first cell includes `\R:\mathbb{R}`.

# [sec_fig] Figures

Cells can also contain figure and images. Images environments begin with an exclamation point `!` and can direct to external images via a URL or internal images using an image ID.

``! [id=img_torus|w=40|caption=An externally hosted image of a torus] (https://www.torus.co.uk/wp-content/themes/torus/images/torus_swoosh.png)

to render the following figure.

! [id=img_torus|w=40|caption=An externally hosted image of a torus] (https://www.torus.co.uk/wp-content/themes/torus/images/torus_swoosh.png)

The size of the image can be controlled by passing a `width` or `w` argument, corresponding to percentage of the text width. The caption can be set with the `caption` argument and can be suppressed by setting `caption=none`.

Images can be stored via elltwo, and assessed via an ID. To upload an image render, a cell with two exclamation points `!!`. This will create a drag-and-drop image uploader (clicking the upload box will open a file browser). Uploaded images are stored, and their IDs can be changed, in the [image library](/img).

Cells can also contain HTML5 SVG images. The `!SVG` prefix creates a 100x100 HTML canvas and will directly incorporate any HTML SVG elements that follow.

!svg [
id=svg_squares
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

To create a hyperlink to another article simply encode its static name (i.e., the name corresponding to its URL) in double brackets. `[[howto]]` creates the link [[howto|how²]]. References to existing articles will generate hoverable popups containing the beginning of the article.

Formatted cells or environments which has been passed an `id` argument can be referenced (n.b., id is the default argument, so `[geo]` is equivalent to `[id=geo]`). `@[id]` creates a reference (and, for most cell types, a hoverable popup). For example `@[eq_geo]` creates the reference @[eq_geo]; `@[ref]` creates a reference to this section; `@[thm_BC]` creates a reference to @[thm_BC].

Arguments can also be passed to references via the same syntax as for cell prefixes. For example: `@[thm_BC|format=plain]` creates a reference to Theorem @[thm_BC|format=plain] but renders only the number.

References can be across articles. To reference a cell of an external article use `@[articleName:id]`; to reference the above equation from a different page would require `@[howto:geo]`.

Typing `@` will open a command completion window ranging over all extant references in the current article; `@:` will search over external article tiles and `@artTitle:` will search over references in the article *artTitle*.

## [sec_citations] Citations

Bibliographic data is stored globally in the [$\ell^2$ Bibliography](/bib). New citations can be entered using the standard [bibTeX](https://en.wikipedia.org/wiki/BibTeX) formatting. Extant citations can be updated by clicking *update* on the relevant entry, changing the data, and clicking *create*. A (rudimentary) search function can find references and directly import the bibTex from Google Scholar.

Each reference has a *citekey*, which can be viewed by hovering over a bibliographic entry (clicking the entry copies the citekey to the clipboard). In text citations are created using `@@[citekey]`, for example @@[morgenstern1953theory]. Typing `@@` will open a command completion window that will search over bibliographic entries (i.e., citekeys).

# [sec_history] Version Control

Prior versions of an article can be viewed by clicking the  `History` button on the footer of the article. This will open the history navigator, by which you can select to view the article at any prior state. Every commit creates a new instance of the article. The article can be reverted to a prior state by clicking on the particular version, and then clicking the `Revert` button. This will create a new instance of the article (that is, of course, identical to the historical version in question) at the current time. In this way, intermediate states between the current instance and the revision instance are not lost.

Articles can be exported and saved locally in both the markdown (raw) format or as a .tex file. The file will include the necessary bibTeX and macros so that that can (usually) be compiled immediately.

# [sec_syntax] Shortcuts and Syntax

A help overlay with the following list of shortcuts and syntax can be viewed by pressing `F1`.

## [sec_hotkeys] Keyboard shortcuts

 - `Escape`: Exit editing / navigation
 - `Alt + Click`:  Activate / edit specific cell
 - `⇑`: Move one cell up
 - `⇓`: Move one cell down
 - `Ctrl + Home`: Move to first cell
 - `Ctrl + End`: Move to last cell
 - `a`: Create cell above
 - `b`: Create cell below
 - `Shift + Enter`: Save and create below
 - `Shift + D`: Delete selected cell
 - `Ctrl + c`: Copy selected cells
 - `Ctrl + v`: Paste cells in clipboard
 - `Shift + ⇑`: Extend selection up
 - `Shift + ⇓`: Extend selection down
 - `Shift + F`: Fold environment cells
 - `Ctrl + Shift + F`: Unfold all cells
 - `Ctrl + ?`: Toggle sidebar options
 - `Ctrl + Enter`: Toggle history explorer
 - `F1`: Toggle help overlay

## [sec_prefixes] Cell prefixes

- `#!` : article title (and preamble)
- `#` : section headings
- `$$` : display math
- `!svg` : svg (HTML5) code
- `!` : images
- `!!`: image upload
- `>>` LaTeX style environments (multi-cell)
- `<<` ending multi cell environments
- `>>!` LaTeX style environments (single-cell; no need for `<<`)
- ` `` ` code (verbatim) blocks

## [sec_inlineFormatting] Inline formatting

- `$...$` Inline math (ctrl + m)
- `*...*` Italic text (ctrl + i)
- `**...**` Bold text (ctrl + b)
-  ```...` `` Code text (ctrl + ` ` `)
- `^[...]`Footnote (ctrl + n)
- `[[...]]` Article link
- `@[...]` Reference internal/external

# [sec_about] About

elltwo was a lockdown project of [Doug Hanley](https://doughanley.com/) and [Evan Piermont](https://evanpiermont.github.io/). It is named after [Ellsworth Avenue](https://en.wikipedia.org/wiki/Ellsworth_Avenue) in Pittsburgh.