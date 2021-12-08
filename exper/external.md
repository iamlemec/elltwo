#! External Test

Hello world $x^2$

$$ [test] \int_0^{\infty} \exp(-x^2) dx

See @[test] for more info

! [so_long_snake|caption=So long *Snake*...|width=100]

!svg [id=box|caption=It's a box|width=50]
<rect x="10" y="10" width="80" height="80" stroke="white" stroke-width="0.5" fill="#5D9D68" />

!gum [id=gum|caption=Gum.js test]
let b = Scatter([
    [Rect({stroke: 'red'}), [0.25, 0.25, 0.2]],
    [Rect({stroke: 'blue'}), [0.75, 0.75, 0.2]]
]);
return Frame(b, {margin: 0.1, padding: 0.1, border: 1});

See the box at @[gum] or @[box1]. Also [[other]] and @[test:world].

I am the MEC

$$* \fr{x}{y}

And some errors

$$* \frc{x}{y}
