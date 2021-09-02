#! Demo

This is demo a **elltwo** ($\ell^2$) article, created especially for you. You can edit this page however you like. Changes are persistent and so you can return to this URL later or share it with others to edit simultaneously.

Cells can be selected by clicking or by pressing `enter` and then navigating with the arrow keys. When a cell is selected, an additional click or `enter` will enter "edit mode." When in edit mode, the raw input of the cell is shown in an editable text box. You can also view the raw text and the output side by side by toggling the view button in the footer.

Add new cells using the `a` (above) or `b` (below) keys when in active mode. Commit changes and create a new cell when editing with `shift + enter`. For a complete overview of keyboard shortcuts press `F1`.

# Formatting and Equations

Inline text formatting follows Markdown syntax. Single `*italic*` renders as *Italic*, `**bold**` for **bold**, etc.^[Footnotes (well, hover-notes) can be added with a carrot `^`.] Verbatim text is delimited by backticks `` ` ``. Inline TeX typesetting is delimited by single dollar signs. For instance, `$f: x \mapsto e^x$` renders as $f: x \mapsto e^x$. To create display equations, start a cell with `$$`

$$ [id=pi2] \sqrt{\pi} = \int_{-\infty}^{\infty} \exp \left( - x^2 \right) dx

These equations can be referenced later @[pi2]. References create popup boxes and work across articles. Errors are reported inline when possible $x^{\kapa}$ and with an error message otherwise:

$$ \frac{x}{y

Let's see if any of you LaTeX aficionados out there can fix the error. 😎

# Environments 

Environments are special syntax that allow for higher-level, potentially multi-cell constructs like theorems. You start them with `>>` and end them with `<<`, using `>>!` for a single-cell environment. Here's an example:

>>! theorem [id=primes] There are an infinite number of prime numbers.

>> proof Consider any finite list of primes, $p_1 \ldots p_n$, for $n \in \mathbb{N}$. Then

$$ p = 1 + \prod_{i \leq n} p_i

<< is either prime or divisible by a prime strictly larger than $\max\{p_1 \ldots p_n\}$, implying the existence of a prime number not in our original list.

As with equations, you can references these by their ID and get an automatically generated link and popup @[primes]. Notice that when you type `@`, an auto-complete popup will appear.

# Images

You can upload or link to images or include them inline as SVG code with the `!` or `!svg` environments. Below is a simple SVG example:

!svg [id=svg_figure|caption=Hey, it's a green box!|width=40]
<rect x="5" y="5" width="90" height="90" stroke="black" fill="#5D9D68" />

As with equations and environments, these can also be referenced later on @[svg_figure]. There are also display options such as `caption` and `width`.

# Advanced

For further details on the above topics and more, head over to [[howto]].