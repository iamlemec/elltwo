#! Demo

This is demo elltwo article. You can edit this page however you like. Changes are persistent and so you can return to this URL later.

Cells can be selected by clicking or by pressing `enter` and then navigating with the arrow keys. When a cell is selected, an addition click or `enter` with enter "edit mode." When in edit mode, the raw input of the cell is shown in an editable text box. You can also view the raw text and the output side by side by toggling the view button in the footer. 

Add new cells using the `a` (above) or `b` (below) keys when in active mode. Commit changes and create a new cell when editing with `shift + enter`.

# Formatting and Equations

Inline text formatting follows Markdown syntax: single `*italic*` renders as *Italic*, `**bold**` for **bold**, etc.^[Footnotes (well, hover-notes) can be added with a carrot `^`.] Verbatim text is delimited by left quotes `` `. Inline TeX typesetting is delimited by single dollar signs: `$f: x \mapsto e^x$` renders as $f: x \mapsto e^x$. Create display equations by starting a cell with `$$`:

$$ [id=eq_taylor] f(a)+{\frac {f'(a)}{1!}}(x-a)+{\frac {f''(a)}{2!}}(x-a)^{2}+{\frac {f'''(a)}{3!}}(x-a)^{3}+\cdots

These equations can be referenced later: @[eq_taylor]. References create popup boxes and work across articles.  

# Environments 

Add environments like theorems and proofs:

>>! theorem* [id=thm_primes] There are an infinite number of prime numbers.

>> proof Consider any finite list of primes, $p_1 \ldots p_n$, for $n \in \mathbb{N}$. Then 

$$ p = 1 + \prod_{i \leq n} p_i

<< is either prime or divisible by a prime strictly larger than $\max\{p_1 \ldots p_n\}$, implying the existence of a prime number not in our original list.

You can add images and svg elements:

!svg [svg_figure|caption=It's a box|width=60]
<rect x="5" y="5" width="90" height="90" stroke="black" fill="#5D9D68" />