#! Y-Combinator Demo

This is demo a **Elltwo** ($\ell^2$) article, created especially for you.  Elltwo streamlines writing, editing and hosting technical documents with lots of @[pi2|text=equations], @[revenue|text=figures], @[gumtext|text=code blocks], @[primes|text=references], citations, and the like. You can edit this page however you like. Changes are persistent and so you can return to this URL later or share it with others to edit simultaneously.

Cells can be selected by clicking or by pressing `enter` and then navigating with the arrow keys. When a cell is selected, an additional click or `enter` will enter "edit mode." When in edit mode, the raw input of the cell is shown in an editable text box. You can also view the raw text and the output side by side by toggling the view button in the footer.

Add new cells using the `a` (above) or `b` (below) keys when in active mode. Commit changes and create a new cell when editing with `shift + enter`. For a complete overview of keyboard shortcuts press `F1`. You can move cells around by grabbing the left hand margin and dragging them around.

# Formatting and Equations

Inline text formatting follows Markdown syntax. Single `*italic*` renders as *Italic*, `**bold**` for **bold**, etc.^[Footnotes (well, hover-notes) can be added with a carrot `^`.] Verbatim text is delimited by backticks `` ` ``. Inline TeX typesetting is delimited by single dollar signs. For instance, `$f: x \mapsto e^x$` renders as $f: x \mapsto e^x$. To create display equations, start a cell with `$$`

$$ [id=pi2] \sqrt{\pi} = \int_{-\infty}^{\infty} \exp \left( - x^2 \right) dx

These equations can be referenced later @[pi2]. References create popup boxes and work across articles.

Command completion will help you recall all those pesky latex commands: try opening a new cell and typing `$$\gamma \leftrightarrow \lambda`.

# Environments

Environments are special syntax that allow for higher-level, potentially multi-cell constructs like theorems. You start them with `>>` and end them with `<<`, using `>>!` for a single-cell environment. Here's an example:

>>! theorem [id=primes] There are an infinite number of prime numbers.

>> proof Consider any finite list of primes, $p_1 \ldots p_n$, for $n \in \mathbb{N}$. Then

$$ p = 1 + \prod_{i \leq n} p_i

<< is either prime or divisible by a prime strictly larger than $\max\{p_1 \ldots p_n\}$, implying the existence of a prime number not in our original list.

As with equations, you can references these by their ID and get an automatically generated link and popup @[primes]. Notice that when you type `@`, an auto-complete popup will appear.

# Images and Figures

You can upload or link to images or include them inline as SVG code with the `!` or `!svg` environments. Below is a simple SVG example:

!svg [
id=svg_squares
caption=An SVG figure rendered using HTML SVG styling.
w=40
]
<g><g>
<rect x="0" y="0" width="125" height="125" stroke="none" fill="hsl(0.000, 60%, 50%)" />
<rect x="125" y="0" width="125" height="125" stroke="none" fill="hsl(33.333, 60%, 50%)" />
<rect x="250" y="0" width="125" height="125" stroke="none" fill="hsl(66.667, 60%, 50%)" />
<rect x="375" y="0" width="125" height="125" stroke="none" fill="hsl(100.000, 60%, 50%)" />
</g>
<g>
<rect x="0" y="125" width="125" height="125" stroke="none" fill="hsl(50.000, 60%, 50%)" />
<rect x="125" y="125" width="125" height="125" stroke="none" fill="hsl(83.333, 60%, 50%)" />
<rect x="250" y="125" width="125" height="125" stroke="none" fill="hsl(116.667, 60%, 50%)" />
<rect x="375" y="125" width="125" height="125" stroke="none" fill="hsl(150.000, 60%, 50%)" />
</g>
<g>
<rect x="0" y="250" width="125" height="125" stroke="none" fill="hsl(100.000, 60%, 50%)" />
<rect x="125" y="250" width="125" height="125" stroke="none" fill="hsl(133.333, 60%, 50%)" />
<rect x="250" y="250" width="125" height="125" stroke="none" fill="hsl(166.667, 60%, 50%)" />
<rect x="375" y="250" width="125" height="125" stroke="none" fill="hsl(200.000, 60%, 50%)" />
</g>
<g>
<rect x="0" y="375" width="125" height="125" stroke="none" fill="hsl(150.000, 60%, 50%)" />
<rect x="125" y="375" width="125" height="125" stroke="none" fill="hsl(183.333, 60%, 50%)" />
<rect x="250" y="375" width="125" height="125" stroke="none" fill="hsl(216.667, 60%, 50%)" />
<rect x="375" y="375" width="125" height="125" stroke="none" fill="hsl(250.000, 60%, 50%)" />
</g></g>

As with equations and environments, these can also be referenced later on: @[svg_squares]. There are also display options such as `caption` and `width`.

Clicking on the box to reveal to SVG code used to generate this simple square showcases the tedium of working directly with SVG. Luckily, there is a better way!

Elltwo comes equipped with a SVG creation library called [[gum]], built around the idea of contextual positioning and object inheritance: gum objects define a context relative to which child elements are positioned and styled. To recreate @[svg_squares] above in GUM requires the relatively simple:

``[id=gumtext|lang=gum] !gum
let n = 4
let rows = [...Array(n).keys()];
let vt = rows.map((r) => {
		let cols = interpolateVectorsPallet([r*50],[r*50+100], n)
		let t = cols.map((c) => {
		return Square({stroke:'none', fill:`hsl(${c[0]}, 60%, 50%)`})
	})
	return HStack(t)
})
return VStack(vt)

Moreover, since the image is produce programmatically, we can easily scale up the number of colored boxes by changing the `n`. In fact, we can even make this interactive:

!gum [width=40|caption=An Interactive SVG figure created using GUM.]
let box = function(args){
let n = parseInt(args.n)
let rows = [...Array(n).keys()];
let vt = rows.map((r) => {
		let cols = interpolateVectorsPallet([r*50],[r*50+100], n)
		let t = cols.map((c) => {
		return Square({stroke:'none', fill:`hsl(${c[0]}, 60%, 50%)`})
	})
	return HStack(t)
})
return VStack(vt)
}
return InterActive({
    n: new Slider(3, {min:2, max: 10, title: 'rows/cols'})
}, box);

For a slightly more *practical* demonstration of GUM, below is an interactive bar breakdown of our revenue proposal (from the application). Given our per-user intake you can examine our monthly revenue for different level of engagement:

!gum [id=revenue|caption=Revenue as a function a user base assuming per-user revenue listed above. Both users and monthly revenue denominated in thousands.]
function guu(vars) {
    let indv = 8*vars.x;
    let inst = 2*vars.y;
    let free = 0.02*vars.z;
    let d = {
        'total': {stacked: [[indv, '#e07a5f'], [inst, '#f2cc8f'],[free, '#81b29a']]},
        'indv': {value:indv, color:'#e07a5f'},
        'inst': {value:inst, color:'#f2cc8f'},
        'ad views': {value:free, color:'#81b29a'},
    };
    let b = BarPlot(d, {
        ylim: [0, 1000], aspect: phi, title: 'Monthly Revenue (thousands)'
    });
    return Frame(b, {
        padding: [0.15, 0.15, 0.15, 0.1]
    });
}
return InterActive({
    x: Slider(20, {
        min: 0, max: 30, title: 'individual users (thousands)'
    }),
    y: Slider(200, {
        min: 0, max: 300, title: 'instituional users (thousands)'
    }),
    z: Slider(3000, {
        min: 0, max: 5000, title: 'passive users (thousands)'
    })
}, guu);

# Advanced

For further details on the above topics and more, head over to [[howto]] or the [[gum|text=gum documentation]].
