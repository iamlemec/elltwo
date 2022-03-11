#! GUM 

Gum is a JavaScript library for SVG creation. Gum is built around the idea of contextual positioning and object inheritance: gum objects define a context relative to which child elements are positioned and styled. 

#[basic] Basic Elements

Gum defines a set of js classes that create basic SVG elements: `rect`, `circle` `line` etc. The simplest gum code simply returns one of these elements. For example

``[lang=gum] return Rect({fill:'goldenrod'})

will return the SVG element:

``[lang=svg] <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
<rect x="0" y="0" width="500" height="500" fill="goldenrod" />
</svg>

Ultimately rendering the square below.

!gum [id=sqr|caption=none|width=20]
return new Rect({fill:'goldenrod'})

As seen, attributes passed to the gum element will be passed to the constructed SVG.

!gum [caption=Some of the basic gum elements: `Text`, `Rect`, `Circle`, `Line`, and `Tex`] a = Text('A');
let b = Rect({fill:'goldenrod'})
let c = Circle({fill:'steelblue'})
let d = Tex('\\sum_{i=1}^{\\infty}')
let e = Line({stroke_width: 4, class:'theme_hl'})
x = [a,b,c,e,d].map((x) => Frame(x, {margin:.1}))
let n2 = HStack(x);
return n2

#[container] Container Elements

Container elements are gum objects that can contain other objects. The simplest example is `Group` which creates a SVG group: a `<g>` tag. Adding properties to the the container propagates them downward (as specified by style inheritance of the DOM). For example

``[lang=gum] r1 = Rect({fill:'goldenrod'})
r2 = Circle({fill:'steelblue'})
return Group([r1,r2], {stroke:'none'})

outputs

!gum [w=20|caption=none] r1 = Rect({fill:'goldenrod'})
r2 = Circle({fill:'steelblue'})
return Group([r1,r2], {stroke:'none'})

Elements can also be grouped *next to* one another, either vertically or horizontally using `VStack` and `HStack`, respectively. 

``[lang=gum] let a = Node(Text('A', {class:'theme_hl'}), {stroke_width:3});
let n1 = VStack([a, a]);
let n2 = HStack([n1, a]);
let f = Frame(n2, {margin: 0.1});
return f

!gum [w=50|caption=none] let a = Node(Text('A', {class:'theme_hl'}), {stroke_width:3});
let n1 = VStack([a, a]);
let n2 = HStack([n1, a]);
let f = Frame(n2, {margin: 0.1});
return f

#[plot] Plotting

Gum contexts can have can be entertain a coordinate representation by which other objects can be placed. This is primarily of interest in creating plots or graphs. The `Sympath` object creates symbolic paths:

To plot a function parameterized by $f: x \mapsto f(x)$ we can write

``[lang=gum] let s = SymPath({f: x => f(x), xlim: [-1, 2*pi])

which can then by plotted via `Plot` object. The boundaries of both the `Plot` itself and the `Sympath` are specified with `xlim` and `ylim`. Putting these together, we can plot a sin curve:

``[lang=gum] let s = SymPath({fy: x => sin(x), xlim: [0, 2*pi], stroke_width: 2});
let p = Plot([s], {xlim: [-1, 2*pi], ylim: [0, 1], stroke_width: .5});
let f = Frame(p, {margin: 0.1});
return f;

yeilds

!gum[sin|caption=none|w=70]
let s = SymPath({fy: x => sin(x), xlim: [0, 2*pi], stroke_width: 2});
let p = Plot([s], {xlim: [0, 2*pi], ylim: [-1, 1], stroke_width: .5});
let f = Frame(p, {margin: 0.1});
return f;

#[interactive] Interactive Objects

Gum objects can depend on variables set up the user through interactions with HTML inputs. For example:

!gum[w=100|caption=none] function guu(vars) {
  let a = vars.a / 50;
  let b = vars.b / 50;
  let grid0 = linspace(-1, 1, 15);
  let grid = Array.prototype.concat(...grid0.map(x => grid0.map(y => [x, y])));
  let fshape = ([x, y]) => {
  let z = interpolateVectors([70, 50, 50],[140, 50, 50], (x*a/2))
  let c = `hsl(${z[0]}, ${z[1]}%, ${z[2]}%)`
  let o = ((a*x)**2 + (b*y)**2)
  return  Group([
  Circle({cx: 0.5+(a*x), cy: 0.5-(b*y), r: 0.1, stroke: c, fill: c, opacity: o}),
  Line({x1: 0.5, y1: 0.5, x2: 0.5+(a*x), y2: 0.5-(b*y), stroke_width: 2.5, stroke: c, opacity: o})
  ])};
  let field = Scatter(
    grid.map(p => [fshape(p), p]),
    {radius: 0.04}
  );
  let p = Plot(field, {
    xlim: [-1.2, 1.2], ylim: [-1.2, 1.2],
    xticks: linspace(-1, 1, 5), yticks: linspace(-1, 1, 5)
  });
  let f = Frame(p, {margin: 0.13});
  return f;
}
return InterActive({
  a: Slider(50, {min: 1, max: 100, title: 'x-dispersion'}),
  b: Slider(50, {min: 1, max: 100, title: 'y-dispersion'}),
}, guu);

The `Interactive` class is used to construct interactive objects. An `Interactive` is a wrapper that takes two arguments, (i) a dictionary variables that whose keys are the variable names and values are of the gum `Variable` class and (ii) a function that returns gum objects. This function will be automatically be passed the current values of the variables whenever they are updated.

For example, to create an interactive output from the @[sin|text=sin curve] above, we can create a function out of the generating code that places a circle on the curve at a user specifed point:

``[lang=gum] function sin_curve(vars){
let a = (vars.a/100)*2*pi
let s = SymPath({fy: x => sin(x), xlim: [0, 2*pi], stroke_width: 2});
let r = Scatter([
  [Circle({fill:'goldenrod'}), [a, sin(a)]]
], {radius: 0.1});
let p = Plot([s,r], {xlim: [0, 2*pi], ylim: [-1, 1], stroke_width: .5});
let f = Frame(p, {margin: 0.1});
return f;}

The function `sin_curve` take a dictionary of variables as an input, and a `Circle` at the location $(a, sin(a))$, where $a$ is set by the input variable. We can then pass this function, and the slider that determines $a$, to an `Interactive` wrapper as:

``[lang=gum] return InterActive({
    a: new Slider(10, {min:0, max: 100, title: 'x pos'})
}, sin_curve);

resulting in the output:

!gum [caption=none|w=70] function sin_curve(vars){
let a = (vars.a/100)*2*pi
let s = SymPath({fy: x => sin(x), xlim: [0, 2*pi], stroke_width: 2});
let r = Scatter([
  [Circle({fill:'goldenrod'}), [a, sin(a)]]
], {radius: 0.1});
let p = Plot([s,r], {xlim: [0, 2*pi], ylim: [-1, 1], stroke_width: .5});
let f = Frame(p, {margin: 0.1});
return f;}
//
return InterActive({
    a: new Slider(10, {min:0, max: 100, title: 'x pos'})
}, sin_curve);

##[vars] Gum Variables

Gum variables are constructed by passing a default value and a dictionary of arguments. There are kinds of built-in gum variables. 

- `Slider`: as seen above, provides a numeric variable, and slidable input 
- `Toggle`: provides a Boolean variable, and toggle input
- `List`: provides an arbitrary variable, with a drop down list input

An example of a `Toggle`:

``[lang=gum] 
function guu(vars) {
let letter = vars.a ? 'C': 'U';
let a = Node(Text(letter, {class:'theme_hl'}), {stroke_width:3});
let n1 = VStack([a, a]);
let n2 = HStack([n1, a]);
return Frame(n2, {margin: 0.1});
}
//
return InterActive({
    a: Toggle(true, {title: 'Toggle checked/unchecked'}),
}, guu);

!gum [caption=none|w=60] 
function guu(vars) {
let letter = vars.a ? 'C': 'U';
let a = Node(Text(letter, {class:'theme_hl'}), {stroke_width:3});
let n1 = VStack([a, a]);
let n2 = HStack([n1, a]);
return Frame(n2, {margin: 0.1});
}
//
return InterActive({
    a: Toggle(true, {title: 'Toggle checked/unchecked'}),
}, guu);

And of a `List`:

``[lang=gum] function pallet(vars){
  let l = parseInt(vars.color) || 0;
  let x = interpolateVectorsPallet([l],[l+50], 6)
  let t= x.map((c) => {
     return Square({stroke:'none', fill:`hsl(${c[0]}, 50%, 50%)`})
  })
return HStack(t)
}
//
return InterActive({
    color : List('red', {choices:{'red':0, 'green':70,'blue':200}})
}, pallet);

!gum [caption=none|width=70]
function pallet(vars){
  let l = parseInt(vars.color) || 0;
  let x = interpolateVectorsPallet([l],[l+50], 6)
  let t= x.map((c) => {
     return Square({stroke:'none', fill:`hsl(${c[0]}, 50%, 50%)`})
  })
return HStack(t)
}
//
return InterActive({
    color : List('red', {choices:{'red':0, 'green':70,'blue':200}})
}, pallet);

#[elltwo] Integration with $\ell^2$

Gum is integrated into elltwo, as evidence by this document. You can creating global (i.e., cross article) gum objects using the live editor, either in an article, using the `!!gum` env or in the [image library](/img). Constructed gum objects are given keys which can be references just like other images in elltwo, and updates to these objects are globally propagation.

To edit a global gum object in an article, open the gum editor by pressing `shift + enter` on a gum cell, or by clicking the editor button when hovering over it. Changes in the editor must be committed to be saved.

Gum code can in exist locally, directly in cells of an elltwo article using the ``!gum`` environment. For example

``*[lang=elltwo|number=false] !gum return Rect({fill:'goldenrod'})

constructs the @[sqr|text=figure] above.