#! Axiom L2

Axiom L2 is a browser based platform for decentralized and collaborative technical documents. It has a wiki like structure with an emphasis on typesetting and intelligent referencing. Axiom L2 articles are written in a simple markup language barrowing elements of [Markdown](https://en.wikipedia.org/wiki/Markdown) and [LaTeX](https://www.latex-project.org/).

# Structure & Editing 

Each article (denoted by a URL) is a collection of cells. Cells contain text which can be styled and referenced individually. For example, a cell could be a paragraph of text (like this one), an equation, an SVG figure, a custom environment, etc. In the same way that articles can be references from other articles in any wiki-like platform, cells that contain a reference can be referenced elsewhere, including across articles. \`

Cells can be selected by clicking on them or by pressing `enter` and then navigating with the arrow keys. When a cell is selected, an addition click or `enter` with enter "edit mode." When in edit mode, the raw input of the cell is shown in an editable text box. When edit mode is escaped, by clicking elsewhere or pressing `esc`, changes will be rendered and the formatted text will be displayed. However, changes to the permanent (or global) until committed, either by pressing `shift + enter` while in edit mode or `ctrl + s` anytime (which will commit *all* uncommitted cells). Uncommitted cells are demarcated by a right border.

#[sec_form]Formatting 

Inline text formatting follows Markdown syntax: single `*italic*` renders as *Italic*, `**bold**` for **bold**, etc. Verbatim text is delimited by left quotes. Inline TeX typesetting is handled by KaTeX and delimited by single dollar signs: `$f: x \mapsto e^x$` renders as $f: x \mapsto e^x$.

##[env]Cell Level Formating

Formatting also takes place at the cell level. A cell is formated by use of a cell **prefix** or string of charecters at the beginging of the cell. 

 The most basic formated cell types are *section title cells*, with prefixes of between 1 and 6 `#`'s and *display style TeX cells*, with prefix `$$`. For example:

``$$[id=geo] \sum_{i=1}^\infty \frac{1}{2^n} = 1

renders as

$$[id=geo] \sum_{i=1}^\infty \frac{1}{2^n} = 1

As seen above, you can pass arguments to the cell by means of placing `key=value` pairs inside brackets directly after the cell prefix. Mutiple arguments are separated by `|`.

A list of cell prefixes:

- `$$` : display math
- `&svg` : svg (HTML5) code
- `!` : images
- `#` : section headings
- `>>` LaTeX style environments
- `<<` ending multi cell environments

##[env]Enviorments

Environments are used to format blocks of cells and function in a similar way to LaTeX enviorments. An enviorment is opened the prefix `>>` and closed by a subsequent cell with prefix `<<`. Single cell enviorments use the special prefix `>>!`. For example:

``>> theorem [id=primes|name=Borel Cantelli] If the sum of the probabilities of the events $\{E_n\}_{n\in \mathbb{N}}$ is finite, then

``$$ \mu(\bigcap_{n=1}^{\infty }\bigcup_{k\geq n}^{\infty }E_{k}) = 0

``<<that is, the probability that infinitely many of them occur is $0$.

will format as:

>> theorem [id=primes|name=Borel Cantelli] If the sum of the probabilities of the events $\{E_n\}{n\in \mathbb{N}}$ is finite, then

$$ \mu(\bigcap_{n=1}^{\infty }\bigcup_{k\geq n}^{\infty }E_{k}) = 0

<<that is, the probability that infinitely many of them occur is $0$.

Prebuilt envrioments include **theorem**, **lemma**, **proof**, and **example**; others can be constructed by augmenting the render.js file.

# [sec_fig] Figures

Cells can also contain figure and images. Images environments begin with an exclamation point `!` and can direct to external images via a URL or internal images using an image ID.

``! [id=img_torus] (https://mathworld.wolfram.com/images/eps-gif/torus_1000.gif)

to render the following figure.

! [id=torus|w=40|caption=An externally hosted image of a torus] (https://www.torus.co.uk/wp-content/themes/torus/images/torus_swoosh.png)

The size of the image can be controlled by passing a `width` or `w` argument, corresponding to percentage of the text width. The caption can be set with the `caption` argument and can be suppressed by setting `caption=none`.

Images can be stored locally, and assessed via an ID. To upload an image render a cell with two exclamation points `!!`. This will create a drag-and-drop image uploader (clicking the upload box will open a file browser).

Cells can also contain figure and images, including HTML5 SVG images. The `&SVG` prefix creates a 100x100 HTML canvas, rendering directly and HTML SVG elements the follow.

&svg [id=fig|caption=An SVG figure|w=100] 
<circle cx="50" cy="70" r="30", fill='tomato' opacity='.5'/>
<circle cx="40" cy="50" r="30", fill='goldenrod' opacity='.5'/>
<circle cx="60" cy="50" r="30", fill='steelblue' opacity='.5'/>

&svg [id=fig|caption=none|w=100]
<rect x="0" y="0" width="25" height="25", fill='#a0025e', stroke='none'/>
<rect x="0" y="25" width="25" height="25", fill='#a2075b', stroke='none'/>
<rect x="0" y="50" width="25" height="25", fill='#b22c52', stroke='none'/>
<rect x="0" y="75" width="25" height="25", fill='#bd454c', stroke='none'/>
<rect x="25" y="0" width="25" height="25", fill='#a1055e', stroke='none'/>
<rect x="25" y="25" width="25" height="25", fill='#ab1d58', stroke='none'/>
<rect x="25" y="50" width="25" height="25", fill='#c04e4b', stroke='none'/>
<rect x="25" y="75" width="25" height="25", fill='#d67940', stroke='none'/>
<rect x="50" y="0" width="25" height="25", fill='#B39442', stroke='none'/>
<rect x="50" y="25" width="25" height="25", fill='#AB6F57', stroke='none'/>
<rect x="50" y="50" width="25" height="25", fill='#A45069', stroke='none'/>
<rect x="50" y="75" width="25" height="25", fill='#E0B423', stroke='none'/>
<rect x="75" y="0" width="25" height="25", fill='#DA9031', stroke='none'/>
<rect x="75" y="25" width="25" height="25", fill='#D36541', stroke='none'/>
<rect x="75" y="50" width="25" height="25", fill='#CD404E', stroke='none'/>
<rect x="75" y="75" width="25" height="25", fill='#cc4150', stroke='none'/>

#[ref]Referencing 

To create a hyperlink to another article simply encode its static name (i.e., the name corresponding to its URL) in double brackets. `[[howto]]` creates the link [[howto]]. References to existing articles will generate hoverable popups containing the beginning of the article. 

Formatted cells or enviorments which has been passed an `id` argument can be referenced (n.b., id is the default argument, so `[geo]` is equivalent to `[id=geo]`). `@[id]` creates a reference (and, for most cell types, a hoverable popup). For example `@[geo]` creates the reference @[geo]; `@[ref]` creates a reference to this section; `@[primes]` creates a reference to @[primes].

References can also be passed arguments via the same syntax. For example `@[primes|format=plain]` creates a reference to Theorem @[primes|format=plain] but renders only the number.

References can be across articles. To reference an external article use `@[article_name:id]`; for example reference the above equation from a different page would require `@[howto:geo]`.

Typing an `@` will open a command completion window ranging over all extant reference in the current article and bibliographic entries (citekeys); `@:` will search over external article tiles and `@art_title:` will search over references in the article *art_title*.

#[ref] Version Control

Prior versions of an article can be viewed by clicking the  `History` button on the footer of the article. This will open the history navigator, by which you can select to view the article at any prior state. Every commit creates a new instance of the article. The article can be reverted to a prior state by clicking on the particular version, and then clicking the `Revert` button. This will create a new instance of the article (that is, of course, identical to the historical version in question) at the current time. In this way, intermediate states between the current instance and the revision instance are not lost.