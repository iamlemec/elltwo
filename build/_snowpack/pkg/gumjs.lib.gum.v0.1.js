import render from '/_snowpack/pkg/katex.v0.15.2.js';

// gum.js

/**
 ** defaults
 **/

// namespace
let ns_svg = 'http://www.w3.org/2000/svg';

// sizing
let size_base = 500;
let rect_base = [0, 0, size_base, size_base];
let frac_base = [0, 0, 1, 1];
let prec_base = 13;

// styling
let svg_props_base = {
    stroke: 'black',
    fill: 'none'
};

// fonts
let font_family_base = 'sans-serif';
let font_size_base = 12;

// plot defaults
let plot_font_base = 'IBMPlexSans';
let num_ticks_base = 5;
let tick_size_base = 0.03;
let tick_label_size_base = 1.5;
let axis_label_size_base = 0.06;
let axis_label_offset_base = 0.15;
let title_size_base = 0.1;
let grid_color_base = '#CCC';
let limit_base = [0, 1];

// text sizer
let textSizer = null;

// use canvas sizer
function canvasTextSizer(ctx, text, args) {
    let {family, size, actual} = args ?? {};
    family = family ?? font_family_base;
    size = size ?? font_size_base;
    actual = actual ?? false;

    ctx.font = `${size}px ${family}`;
    let met = ctx.measureText(text);

    let x, y, w, h;
    if (actual) {
        x = -met.actualBoundingBoxLeft;
        y = -met.actualBoundingBoxDescent;
        w = met.actualBoundingBoxRight - x;
        h = met.actualBoundingBoxAscent - y;
    } else {
        x = 0;
        y = 0;
        w = met.width;
        h = size;
    }

    return [x, y, w, h];
}

function sideRenderTextSizer(html, args) {
    let {family, size, actual} = args ?? {};
    family = family ?? font_family_base;
    size = size ?? font_size_base;
    actual = actual ?? false;

    let textDiv = document.createElement('div');
    document.body.appendChild(textDiv);

    textDiv.style.fontSize = `${size}px`;
    textDiv.style.position = 'absolute';
    textDiv.style.fontFamily = family;
    textDiv.style.visibility = 'hidden';

    textDiv.innerHTML = html;
    let rect = textDiv.getBoundingClientRect();

    let x, y, w, h;
    if (actual) {
        x = rect.left;
        y = rect.top;
        w = rect.width;
        h = rect.height;
    } else {
        x = 0;
        y = 0;
        w = rect.width;
        h = size;
    }

    document.body.removeChild(textDiv);

    return [x, y, w, h];
}


// try for browser environment
try {
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    textSizer = function(text, args) {
        return canvasTextSizer(ctx, text, args);
    };
} catch (error) {
    console.log(error);
}

/**
 ** general utils
 **/

function* gzip(...iterables) {
    if (iterables.length == 0) {
        return;
    }
    let iterators = iterables.map(i => i[Symbol.iterator]());
    while (true) {
        let results = iterators.map(iter => iter.next());
        if (results.some(res => res.done)) {
            return;
        } else {
            yield results.map(res => res.value);
        }
    }
}

function zip(...iterables) {
    return [...gzip(...iterables)];
}

function sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
}

function range(i0, i1, step) {
    step = step ?? 1;
    [i0, i1] = (i1 === undefined) ? [0, i0] : [i0, i1];
    let n = floor((i1-i0)/step);
    return [...Array(n).keys()].map(i => i0 + step*i);
}

function linspace(x0, x1, n) {
    let step = (x1-x0)/(n-1);
    return [...Array(n).keys()].map(i => x0 + step*i);
}

function is_scalar(x) {
    return typeof(x) == 'number';
}

function is_string(x) {
    return typeof(x) == 'string';
}

function is_element(x) {
    return x instanceof Element;
}

/**
 ** core math
 **/

// to be used in functions
class NamedNumber extends Number {
    constructor(name, value) {
        super(value);
        this.name = name;
    }
}

// constants
let pi = new NamedNumber('pi', Math.PI);

// functions
let exp = Math.exp;
let log = Math.log;
let sin = Math.sin;
let cos = Math.cos;
let tan = Math.tan;
let min = Math.min;
let max = Math.max;
let abs = Math.abs;
let sqrt = Math.sqrt;
let floor = Math.floor;
let ceil = Math.ceil;
let round = Math.round;

/**
 ** coordinate utils
 **/

// convenience mapper for rectangle positions
function pos_rect(r) {
    if (r == null) {
        return frac_base;
    } else if (is_scalar(r)) {
        return [0, 0, r, r];
    } else if (r.length == 2) {
        let [rx, ry] = r;
        return [0, 0, rx, ry];
    } else {
        return r;
    }
}

function pad_rect(p) {
    if (p == null) {
        return frac_base;
    } else if (is_scalar(p)) {
        return [p, p, p, p];
    } else if (p.length == 2) {
        let [px, py] = p;
        return [px, py, px, py];
    } else {
        return p;
    }
}

// map padding/margin into internal boxes
function map_rect(p) {
    let [pxa, pya, pxb, pyb] = p;
    let [ptxa, ptya, ptxb, ptyb] = [
        pxa/(1+pxa), pya/(1+pya), pxb/(1+pxb), pyb/(1+pyb)
    ];
    return [ptxa, ptya, 1-ptxb, 1-ptyb];
}

function rad_rect(p, r0) {
    let x, y, r, rx, ry;
    if (p.length == 1) {
        [r, ] = p;
        [x, y] = [0.5, 0.5];
        [rx, ry] = [r, r];
    } else if (p.length == 2) {
        [x, y] = p;
        [rx, ry] = is_scalar(r0) ? [r0, r0] : r0;
    } else if (p.length == 3) {
        [x, y, r] = p;
        [rx, ry] = [r, r];
    } else if (p.length == 4) {
        [x, y, rx, ry] = p;
    }
    return [x-rx, y-ry, x+rx, y+ry];
}

function merge_rects(rects) {
    let [xa, ya, xb, yb] = range(4)
        .map(i => rects.map(r => r[i]));
    return [
        min(...xa), min(...ya), max(...xb), max(...yb)
    ];
}

function rect_dims(rect) {
    let [xa, ya, xb, yb] = rect;
    let [w, h] = [xb - xa, yb - ya];
    return [w, h];
}

function rect_aspect(rect) {
    let [w, h] = rect_dims(rect);
    return w/h;
}

function aspect_invariant(value, aspect) {
    if (is_scalar(value)) {
        let afact = sqrt(aspect ?? 1);
        return [value*afact, value/afact];
    } else {
        return value;
    }
}

/**
 ** attributes
 **/

function prefix_attr(pres, attr) {
    let attr1 = {...attr};
    let pres1 = pres.map(p => `${p}_`);
    let out = pres.map(p => Object());
    let keys = Object.keys(attr).map(k => {
        pres.forEach((p, i) => {
            if (k.startsWith(pres1[i])) {
                let k1 = k.slice(p.length+1);
                out[i][k1] = attr1[k];
                delete attr1[k];
            }
        });
    });
    return [...out, attr1];
}

/**
 ** string formatters
 **/

function demangle(k) {
    return k.replace('_', '-');
}

function rounder(x, prec) {
    prec = prec ?? prec_base;

    let suf;
    if (is_string(x) && x.endsWith('px')) {
        x = Number(x.substr(0, x.length-2));
        suf = 'px';
    } else {
        suf = '';
    }

    let ret;
    if (is_scalar(x)) {
        ret = x.toFixed(prec);
        ret = ret.replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '');
    } else {
        ret = x;
    }

    return ret + suf;
}

function props_repr(d, prec) {
    return Object.entries(d)
        .map(([k, v]) => `${demangle(k)}="${rounder(v, prec)}"`)
        .join(' ');
}

/**
 ** color handling
 **/

// Converts a #ffffff hex string into an [r,g,b] array
function hex2rgb(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
}

function rgb2hex(rgb) {
    let r = round(rgb[0]).toString(16).padStart(2, '0');
    let g = round(rgb[1]).toString(16).padStart(2, '0');
    let b = round(rgb[2]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

function interpolateVectors(c1, c2, alpha) {
    let len = min(c1.length, c2.length);
    return range(len).map(i => {
        let x = c1[i] + alpha*(c2[i]-c1[i]);
        return x.toFixed(3);
    });
}

function interpolateHex(c1, c2, alpha) {
    let v1 = hex2rgb(c1);
    let v2 = hex2rgb(c2);
    let v = interpolateVectors(v1, v2, alpha);
    return rgb2hex(v);
}

function interpolateVectorsPallet(c1, c2, n) {
    return linspace(0, 1, n)
        .map(alpha => interpolateVectors(c1, c2, alpha));
}

/**
 ** core classes
 **/

class Context {
    constructor(args) {
        let {rect, frac, prec} = args ?? {};
        this.rect = rect ?? rect_base;
        this.frac = frac;
        this.prec = prec;
    }

    coord_to_frac(pos) {
        let [fx1, fy1, fx2, fy2] = this.frac ?? frac_base;
        let [fw, fh] = [fx2 - fx1, fy2 - fy1];
        let [fix, fiy] = [fx2 < fx1, fy2 < fy1];
        return pos.map(([zx, zy]) => [
            fix ? (fx1-zx)/abs(fw) : (zx-fx1)/fw,
            fiy ? (fy1-zy)/abs(fh) : (zy-fy1)/fh
        ]);
    }

    rect_to_frac(rec) {
        let [x1, y1, x2, y2] = zip(...rec);
        let rec0 = zip(x1, y1);
        let rec1 = zip(x2, y2);
        rec0 = this.coord_to_frac(rec0);
        rec1 = this.coord_to_frac(rec1);
        return zip(rec0, rec1).map(([r0, r1]) => [...r0, ...r1]);
    }

    frac_to_pixel(pos) {
        let [px1, py1, px2, py2] = this.rect;
        let [pw, ph] = [px2 - px1, py2 - py1];
        return pos.map(([zx, zy]) => [
            px1 + zx*pw,
            py1 + zy*ph
        ]);
    }

    // map using both domain (frac) and range (rect)
    coord_to_pixel(pos) {
        pos = this.coord_to_frac(pos);
        pos = this.frac_to_pixel(pos);
        return pos;
    }

    size_to_pixel(siz) {
        let [fx1, fy1, fx2, fy2] = this.frac ?? frac_base;
        let [px1, py1, px2, py2] = this.rect;

        let [fw, fh] = [fx2 - fx1, fy2 - fy1];
        let [pw, ph] = [px2 - px1, py2 - py1];

        return siz.map(([zw, zh]) => [
            zw*abs(pw)/abs(fw),
            zh*abs(ph)/abs(fh)
        ]);
    }

    // project fractional coordinates
    // prect — outer rect (absolute)
    // frect — inner rect (fraction)
    map(frect, aspect, scale) {
        let [pxa, pya, pxb, pyb] = this.rect;
        let [fxa, fya, fxb, fyb] = frect;

        let [pw, ph] = [pxb - pxa, pyb - pya];
        let [fw, fh] = [fxb - fxa, fyb - fya];

        let [pxa1, pya1] = [pxa + fxa*pw, pya + fya*ph];
        let [pxb1, pyb1] = [pxa + fxb*pw, pya + fyb*ph];

        if (aspect != null) {
            let [pw1, ph1] = [fw*pw, fh*ph];
            let asp1 = pw1/ph1;

            if (asp1 == aspect) ; else if (asp1 > aspect) { // too wide
                let pw2 = aspect*ph1;
                let dpw = pw1 - pw2;
                pxa1 += 0.5*dpw;
                pxb1 -= 0.5*dpw;
            } else if (asp1 < aspect) { // too tall
                let ph2 = pw1/aspect;
                let dph = ph2 - ph1;
                pya1 -= 0.5*dph;
                pyb1 += 0.5*dph;
            }
        }

        let rect1 = [pxa1, pya1, pxb1, pyb1];
        return new Context({rect: rect1, frac: scale, prec: this.prec});
    }
}

class Element {
    constructor(tag, unary, args) {
        let {aspect, ...attr} = args ?? {};
        this.tag = tag;
        this.unary = unary;
        this.aspect = aspect ?? null;
        this.attr = Object.fromEntries(Object.entries(attr).filter(([k, v]) => v != null));
    }

    props(ctx) {
        return this.attr;
    }

    inner(ctx) {
        return '';
    }

    svg(ctx) {
        ctx = ctx ?? new Context();

        let props = props_repr(this.props(ctx), ctx.prec);
        let pre = props.length > 0 ? ' ' : '';

        if (this.unary) {
            return `<${this.tag}${pre}${props} />`;
        } else {
            return `<${this.tag}${pre}${props}>${this.inner(ctx)}</${this.tag}>`;
        }
    }
}

// non-unary | variable-aspect | graphable
class Container extends Element {
    constructor(children, args) {
        let {tag, aspect, scale, clip, ...attr} = args ?? {};
        tag = tag ?? 'g';
        clip = clip ?? true;

        // handle singleton
        if (children instanceof Element) {
            children = [children];
        }

        // handle default positioning
        children = children
            .map(c => c instanceof Element ? [c, null] : c)
            .map(([c, r]) => [c, pos_rect(r)]);

        // get data limits
        let xlim, ylim;
        if (children.length > 0) {
            let [xmins, ymins, xmaxs, ymaxs] = zip(...children.map(([c, r]) => r));
            xlim = [min(...xmins), max(...xmaxs)];
            ylim = [min(...ymins), max(...ymaxs)];
        }

        // inherit aspect of clipped contents
        if (aspect == null && clip) {
            let ctx = new Context({rect: frac_base});
            let rects = children
                .filter(([c, r]) => c.aspect != null)
                .map(([c, r]) => ctx.map(r, c.aspect).rect);
            if (rects.length > 0) {
                let total = merge_rects(rects);
                aspect = rect_aspect(total);
            }
        }

        // pass to Element
        let attr1 = {aspect: aspect, ...attr};
        super(tag, false, attr1);
        this.children = children;
        this.scale = scale;
        this.xlim = xlim;
        this.ylim = ylim;
    }

    inner(ctx) {
        if (this.children.length == 0) {
            return '\n';
        }

        // for when the parent has a scale (ctx.frac)
        let children = this.children;
        if (ctx.frac != null) {
            let [childs, rects0] = zip(...children);
            let rects1 = ctx.rect_to_frac(rects0);
            children = zip(childs, rects1);
        }

        // for when this has a scale
        let inside = children
            .map(([c, r]) => c.svg(ctx.map(r, c.aspect, this.scale)))
            .join('\n');
        return `\n${inside}\n`;
    }
}

class SVG extends Container {
    constructor(children, args) {
        let {clip, size, prec, ...attr} = args ?? {};
        clip = clip ?? true;
        size = size ?? size_base;
        prec = prec ?? prec_base;

        let attr1 = {tag: 'svg', clip: clip, ...svg_props_base, ...args};
        super(children, attr1);

        if (is_scalar(size)) {
            if (this.aspect == null) {
                size = [size, size];
            } else if (this.aspect >= 1) {
                size = [size, size/this.aspect];
            } else {
                size = [size*this.aspect, size];
            }
        }

        this.size = size;
        this.prec = prec;
    }

    props(ctx) {
        let [w, h] = this.size;
        let box = `0 0 ${w} ${h}`;
        let base = {viewBox: box, xmlns: ns_svg};
        return {...base, ...this.attr};
    }

    svg(args) {
        let rect = [0, 0, ...this.size];
        let ctx = new Context({rect: rect, prec: this.prec});
        return super.svg(ctx);
    }
}

/**
 ** layout classes
 **/

class Group extends Container {
    constructor(children, args) {
        super(children, args);
    }
}

class Frame extends Container {
    constructor(child, args) {
        let {padding, margin, border, aspect, adjust, ...attr0} = args ?? {};
        let [border_attr, attr] = prefix_attr(['border'], attr0);
        padding = padding ?? 0;
        margin = margin ?? 0;
        adjust = adjust ?? true;

        // convenience boxing
        padding = pad_rect(padding);
        margin = pad_rect(margin);

        // aspect adjusted padding/margin
        if (adjust && child.aspect != null) {
            let x = sqrt(child.aspect);
            let [pl, pt, pr, pb] = padding;
            let [ml, mt, mr, mb] = margin;
            padding = [pl/x, pt*x, pr/x, pb*x];
            margin = [ml/x, mt*x, mr/x, mb*x];
        }

        // get box sizes
        let padmar = zip(padding, margin).map(([p, m]) => p + m);
        let mrect = map_rect(margin);
        let trect = map_rect(padmar);

        // gather children
        let children = [[child, trect]];
        if (border != null) {
            let rargs = {stroke_width: border, aspect: aspect, ...border_attr};
            let rect = new Rect(rargs);
            children.push([rect, mrect]);
        }

        // compute eventual aspect
        if (aspect == null && child.aspect != null) {
            let [tw, th] = rect_dims(trect);
            aspect = child.aspect*(th/tw);
        }

        // pass to Container
        let attr1 = {aspect: aspect, ...attr};
        super(children, attr1);
    }
}

class VStack extends Container {
    constructor(children, args) {
        let {expand, aspect, attr} = args ?? {};
        expand = expand ?? true;

        if (children.length == 0) {
            return super([], {aspect: aspect, ...attr});
        }

        // get children, heights, and aspects
        let n = children.length;
        let [elements, heights] = zip(...children
            .map(c => (c instanceof Element) ? [c, 1/n] : c)
        );
        let aspects = elements.map(c => c.aspect);

        // adjust for aspects
        if (expand) {
            heights = zip(heights, aspects).map(([h, a]) => h/(a ?? 1));
            let total = sum(heights);
            heights = heights.map(h => h/total);
        }

        // convert to cumulative intervals
        let pos = 0;
        let inter = heights.map(y =>
            is_scalar(y) ? [pos, pos += y] : [y[0], pos = y[1]]
        );

        // compute child boxes
        children = zip(elements, inter)
            .map(([c, [fh0, fh1]]) => [c, [0, fh0, 1, fh1]]);

        // use imputed aspect if null
        if (aspect == null) {
            let aspects0 = zip(heights, aspects)
                .filter(([h, a]) => a != null)
                .map(([h, a]) => h*a);
            aspect = (aspects0.length > 0) ? max(...aspects0) : null;
        }

        // pass to Container
        let attr1 = {aspect: aspect, ...attr};
        super(children, attr1);
    }
}

class HStack extends Container {
    constructor(children, args) {
        let {expand, aspect, attr} = args ?? {};
        expand = expand ?? true;

        if (children.length == 0) {
            return super([], {aspect: aspect, ...attr});
        }

        // get children, heights, and aspects
        let n = children.length;
        let [elements, widths] = zip(...children
            .map(c => (c instanceof Element) ? [c, 1/n] : c)
        );
        let aspects = elements.map(c => c.aspect);

        // adjust for aspects
        if (expand) {
            widths = zip(widths, aspects).map(([w, a]) => w*(a ?? 1));
            let total = sum(widths);
            widths = widths.map(w => w/total);
        }

        // convert to cumulative intervals
        let pos = 0;
        let inter = widths.map(x =>
            is_scalar(x) ? [pos, pos += x] : [x[0], pos = x[1]]
        );

        // find child boxes
        children = zip(elements, inter)
            .map(([c, [fw0, fw1]]) => [c, [fw0, 0, fw1, 1]]);

        // use imputed aspect if null
        if (aspect == null) {
            let aspects0 = zip(widths, aspects)
                .filter(([w, a]) => a != null)
                .map(([w, a]) => a/w);
            aspect = (aspects0.length > 0) ? max(...aspects0) : null;
        }

        // pass to Container
        let attr1 = {aspect: aspect, ...attr};
        super(children, attr1);
    }
}

class Point extends Container {
    constructor(child, rect, attr) {
        rect = rad_rect(rect);
        super([[child, rect]], attr);
    }
}

class Place extends Container {
    constructor(child, rect, attr) {
        rect = pos_rect(rect);
        super([[child, rect]], attr);
    }
}

/**
 ** basic geometry
 **/

// this can have an aspect, which is utilized by layouts
class Spacer extends Element {
    constructor(args) {
        super(null, null, args);
    }

    svg(ctx) {
        return '';
    }
}

// unary | aspect
class Ray extends Element {
    constructor(theta, attr) {
        theta = theta ?? -45;

        // map into (-90, 90];
        if (theta == -90) {
            theta = 90;
        } else if (theta < -90 || theta > 90) {
            theta = ((theta + 90) % 180) - 90;
        }

        // map theta into direction and aspect
        let direc;
        let aspect;
        if (theta == 90) {
            direc = Infinity;
            aspect = null;
        } else if (theta == 0) {
            direc = 0;
            aspect = null;
        } else {
            let direc0 = tan(theta*(pi/180));
            direc = direc0;
            aspect = 1/abs(direc0);
        }

        // pass to Element
        super('line', true, {aspect: aspect, ...attr});
        this.direc = direc;
    }

    props(ctx) {
        let [x1, y1, x2, y2] = ctx.rect;
        let [w, h] = [x2 - x1, y2 - y1];

        if (!isFinite(this.direc)) {
            x1 = x2 = x1 + 0.5*w;
        } else if (this.direc == 0) {
            y1 = y2 = y1 + 0.5*h;
        } else if (this.direc > 0) {
            [y1, y2] = [y2, y1];
        }

        let base = {x1: x1, y1: y1, x2: x2, y2: y2};
        return {...base, ...this.attr};
    }
}

// unary | null-aspect | graphable
class Line extends Element {
    constructor(args) {
        let {x1, y1, x2, y2, ...attr} = args ?? {};
        x1 = x1 ?? 0;
        y1 = y1 ?? 0;
        x2 = x2 ?? 1;
        y2 = y2 ?? 1;

        super('line', true, attr);
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.xlim = [x1, x2];
        this.ylim = [y1, y2];
    }

    props(ctx) {
        let [[x1, y1], [x2, y2]] = ctx.coord_to_pixel(
            [[this.x1, this.y1], [this.x2, this.y2]]
        );
        let base = {x1: x1, y1: y1, x2: x2, y2: y2};
        return {...base, ...this.attr};
    }
}

// unary | null-aspect | graphable
class VLine extends Line {
    constructor(pos, args) {
        let attr = args ?? {};
        pos = pos ?? 0.5;
        let attr1 = {x1: pos, x2: pos, ...attr};
        super(attr1);
    }
}

// unary | null-aspect | graphable
class HLine extends Line {
    constructor(pos, args) {
        let attr = args ?? {};
        pos = pos ?? 0.5;
        let attr1 = {y1: pos, y2: pos, ...attr};
        super(attr1);
    }
}

// unary | null-aspect | graphable
class Rect extends Element {
    constructor(args) {
        let {x1, y1, x2, y2, ...attr} = args ?? {};
        x1 = x1 ?? 0;
        y1 = y1 ?? 0;
        x2 = x2 ?? 1;
        y2 = y2 ?? 1;

        super('rect', true, attr);
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.xlim = [x1, x2];
        this.ylim = [y1, y2];
    }

    props(ctx) {
        let [[x1, y1], [x2, y2]] = ctx.coord_to_pixel(
            [[this.x1, this.y1], [this.x2, this.y2]]
        );
        let [x, y] = [x1, y1];
        let [w, h] = [x2 - x1, y2 - y1];

        if (w < 0) { x += w; w *= -1; }
        if (h < 0) { y += h; h *= -1; }
        let base = {x: x, y: y, width: w, height: h};
        return {...base, ...this.attr};
    }
}

// unary | unit-aspect | graphable
class Square extends Rect {
    constructor(args) {
        let {cx, cy, r, ...attr} = args ?? {};
        cx = cx ?? 0.5;
        cy = cy ?? 0.5;
        r = r ?? 0.5;

        let [x1, y1] = [cx - r, cy - r];
        let [x2, y2] = [cx + r, cy + r];

        let base = {x1: x1, y1: y1, x2: x2, y2: y2, aspect: 1};
        super({...base, ...attr});
    }
}

// unary | null-aspect | graphable
class Ellipse extends Element {
    constructor(args) {
        let {cx, cy, rx, ry, ...attr} = args ?? {};
        cx = cx ?? 0.5;
        cy = cy ?? 0.5;
        rx = rx ?? 0.5;
        ry = ry ?? 0.5;

        super('ellipse', true, attr);
        this.cx = cx;
        this.cy = cy;
        this.rx = rx;
        this.ry = ry;
        this.xlim = [cx - rx, cx + rx];
        this.ylim = [cy - ry, cy + ry];
    }

    props(ctx) {
        let [[cx, cy]] = ctx.coord_to_pixel([[this.cx, this.cy]]);
        let [[rx, ry]] = ctx.size_to_pixel([[this.rx, this.ry]]);
        let base = {cx: cx, cy: cy, rx: rx, ry: ry};
        return {...base, ...this.attr};
    }
}

// unary | unit-aspect | graphable
class Circle extends Ellipse {
    constructor(args) {
        let {cx, cy, r, ...attr} = args ?? {};
        cx = cx ?? 0.5;
        cy = cy ?? 0.5;
        r = r ?? 0.5;

        let base = {cx: cx, cy: cy, rx: r, ry: r, aspect: 1};
        super({...base, ...attr});
    }
}

let black_dot = () => new Circle({fill: 'black'});

/**
 ** path builder (not graphable)
 **/

class Pointstring extends Element {
    constructor(tag, points, args) {
        let {xlim, ylim, ...attr} = args ?? {};
        super(tag, true, attr);
        this.points = points;
        if (points.length > 0) {
            let [xvals, yvals] = zip(...points);
            this.xlim = xlim ?? [min(...xvals), max(...xvals)];
            this.ylim = ylim ?? [min(...yvals), max(...yvals)];
        }
    }

    props(ctx) {
        let points = ctx.coord_to_pixel(this.points);
        let str = points.map(([x, y]) => `${x},${y}`).join(' ');
        return {points: str, ...this.attr};
    }
}

class Polyline extends Pointstring {
    constructor(points, attr) {
        super('polyline', points, attr);
    }
}

class Polygon extends Pointstring {
    constructor(points, attr) {
        super('polygon', points, attr);
    }
}

function arg(s, d, ctx) {
    let [x1, y1, x2, y2] = ctx.rect;
    let [w, h] = [x2 - x1, y2 - y1];
    if (s == 'xy') {
        let [fx, fy] = d;
        let [x, y] = [x1 + w*fx, y1 + h*fy];
        return `${x},${y}`;
    } else if (s == 'x') {
        let x = x1 + w*d;
        return `${x}`;
    } else if (s == 'y') {
        let y = y1 + h*d;
        return `${y}`;
    } else {
        return `${d}`;
    }
}

class Command {
    constructor(cmd, spec, data) {
        this.cmd = cmd;
        this.spec = spec;
        this.data = data;
    }

    string(ctx) {
        let args = zip(this.spec, this.data)
            .map(([s, d]) => arg(s, d, ctx))
            .join(' ');
        return `${this.cmd} ${args}`;
    }
}

class MoveTo extends Command {
    constructor(x, y) {
        let point = [x, y];
        super('M', ['xy'], [point]);
    }
}

class LineTo extends Command {
    constructor(x, y) {
        let point = [x, y];
        super('L', ['xy'], [point]);
    }
}

class Bezier2 extends Command {
    constructor(x, y, x1, y1) {
        let point = [x, y];
        if (x1 == null || y1 == null) {
            super('T', ['xy'], [point]);
        } else {
            let point1 = [x1, y1];
            super('Q', ['xy', 'xy'], [point1, point]);
        }
    }
}

class Bezier3 extends Command {
    constructor(x, y, x2, y2, x1, y1) {
        let point = [x, y];
        let point2 = [x2, y2];
        if (x1 == null || y1 == null) {
            super('S', ['xy', 'xy'], [point2, point]);
        } else {
            let point1 = [x1, y1];
            super('C', ['xy', 'xy', 'xy'], [point1, point2, point]);
        }
    }
}

class Arc extends Command {
    constructor(x, y, rx, ry, angle, args) {
        let {large, sweep} = args ?? {};
        large = large ?? 1;
        sweep = sweep ?? 1;
        let point = [x, y];
        super('A', ['x', 'y', '', '', '', 'xy'], [rx, ry, angle, large, sweep, point]);
    }
}

class Close extends Command {
    constructor() {
        super('Z', [], []);
    }
}

class Path extends Element {
    constructor(commands, attr) {
        super('path', true, attr);
        this.commands = commands;
    }

    props(ctx) {
        let cmd = this.commands.map(c => c.string(ctx)).join(' ');
        return {d: cmd, ...this.attr};
    }
}

/**
 ** text elements (not graphable)
 **/

class Text extends Element {
    constructor(text, args) {
        let {family, size, rotate, actual, calc_family, vshift, ...attr} = args ?? {};
        size = size ?? font_size_base;
        actual = actual ?? false;
        rotate = (rotate ?? 0) % 360;
        vshift = vshift ?? 0;

        // select fonts
        let font_disp, font_calc;
        if (calc_family != null) {
            font_calc = calc_family;
        } else {
            font_disp = family ?? font_family_base;
            font_calc = font_disp;
        }

        // compute text box
        let fargs = {family: font_calc, size: size, actual: actual};
        let [xoff, yoff, width0, height0] = textSizer(text, fargs);
        [xoff, yoff, size] = [xoff/height0, yoff/height0, size/height0];

        // account for rotation
        let theta = (pi/180)*rotate;
        let width = abs(cos(theta))*width0 + abs(sin(theta))*height0;
        let height = abs(sin(theta))*width0 + abs(cos(theta))*height0;
        let [wfact, hfact] = [width0/width, height0/height];

        // pass to element
        let aspect = width/height;
        let attr1 = {aspect: aspect, font_family: font_disp, fill: 'black', ...attr};
        super('text', false, attr1);

        // store metrics
        this.xoff = xoff;
        this.yoff = yoff + vshift;
        this.size = size;
        this.text = text;
        this.wfact = wfact;
        this.hfact = hfact;
        this.rotate = rotate;
    }

    props(ctx) {
        let [x1, y1, x2, y2] = ctx.rect;
        let [w, h] = [x2 - x1, y2 - y1];

        // get unrotated height
        let w0 = this.wfact*w;
        let h0 = this.hfact*h;
        let h1 = this.size*h0;

        // get unrotated origin
        let cx = x1 + 0.5*w;
        let cy = y1 + 0.5*h;
        let x = cx - 0.5*w0 - this.xoff*h1;
        let y = cy + 0.5*h0 + this.yoff*h1;

        let rprop = (this.rotate != 0) ? {transform: `rotate(${this.rotate} ${cx} ${cy})`} : {};
        let base = {
            x: x, y: y, font_size: `${h1}px`, ...rprop
        };
        return {...base, ...this.attr};
    }

    inner(ctx) {
        return this.text;
    }
}

class Tex extends Element {
    constructor(text, args) {
        let {family, size, actual, calc_family, vshift, xover, yover, rotate, ...attr} = args ?? {};
        size = size ?? font_size_base;
        rotate = (rotate ?? 0) % 360;
        actual = actual ?? true;
        vshift = vshift ?? 0;
        yover = yover ?? 1.0;
        xover = xover ?? 0.5;

        // render with katex
        let katex = render.renderToString(text, {output: 'html'});

        // compute text box
        let fargs = {size: size, actual: actual};
        let [xoff, yoff, width0, height0] = sideRenderTextSizer(katex, fargs);
        [xoff, yoff, size] = [xoff/width0, yoff/height0, size/height0];

        // account for rotation
        let theta = (pi/180)*rotate;
        let width = abs(cos(theta))*width0 + abs(sin(theta))*height0;
        let height = abs(sin(theta))*width0 + abs(cos(theta))*height0;
        let [wfact, hfact] = [width0/width, height0/height];

        // pass to element
        let aspect = width/height;
        let attr1 = {aspect: aspect, ...attr};
        super('foreignObject', false, attr1);

        // store metrics
        this.xoff = xoff;
        this.yoff = yoff + vshift;
        this.size = size;
        this.xover = xover;
        this.yover = yover;
        this.wfact = wfact;
        this.hfact = hfact;
        this.rotate = rotate;
        this.katex = katex;

    }

    props(ctx) {
        let [x1, y1, x2, y2] = ctx.rect;
        let [w, h] = [x2 - x1, y2 - y1];

        let w0 = this.wfact*w;
        let h0 = this.hfact*h;

        let w1 = w0;
        let h1 = this.size*h0;
        let fs = this.size*h0;

        let w2 = (1+this.xover)*w1;
        let h2 = (1+this.yover)*h1;

        // get unrotated origin
        let cx = x1 + 0.5*w;
        let cy = y1 + 0.5*h;
        let x = cx - 0.5*w0 - this.xoff*w1;
        let y = cy - 0.5*h0 + this.yoff*h1;

        let rprop = (this.rotate != 0) ? {transform: `rotate(${this.rotate} ${cx} ${cy})`} : {};
        let base = {
            x: x, y: y, width: w2, height: h2, font_size: `${fs}px`, ...rprop
        };
        return {...base, ...this.attr};
    }

    inner(ctx) {
        return this.katex;
    }
}

class Node extends Container {
    constructor(text, args) {
        let {padding, shape, aspect, ...attr} = args ?? {};
        padding = padding ?? 0.1;
        shape = shape ?? Rect;

        // convenience padding
        padding = pad_rect(padding);

        // generate core elements
        if (is_string(text)) {
            text = new Text(text);
        }
        let outer = new shape();

        // auto-scale padding
        if (aspect == null) {
            let x = sqrt(text.aspect);
            let [pl, pt, pr, pb] = padding;
            padding = [pl/x, pt*x, pr/x, pb*x];
            aspect = text.aspect*(1+(pl+pr)/x)/(1+(pt+pb)*x);
        }

        // pass to container
        let rect = map_rect(padding);
        let children = [[text, rect], outer];
        let attr1 = {aspect: aspect, ...attr};
        super(children, attr1);
    }
}

/**
 ** parametric paths
 **/

function sympath(args) {
    let {fx, fy, xlim, ylim, tlim, N, ...attr} = args ?? {};
    N = N ?? 100;
    tlim = tlim ?? limit_base;

    // make index path
    let tvals = linspace(...tlim, N);

    // compute path points
    let xvals, yvals;
    if (fx != null && fy != null) {
        xvals = tvals.map(fx);
        yvals = tvals.map(fy);
    } else if (fy != null) {
        xvals = linspace(...xlim, N);
        yvals = xvals.map(fy);
    } else if (fx != null) {
        yvals = linspace(...ylim, N);
        xvals = yvals.map(fx);
    }

    return [tvals, xvals, yvals];
}

class SymPath extends Element {
    constructor(args) {
        let {fx, fy, xlim, ylim, tlim, N, ...attr} = args ?? {};

        // compute point values
        let [tvals, xvals, yvals] = sympath({
            fx: fx, fy: fy, xlim: xlim, ylim: ylim, tlim: tlim, N: N
        });

        // pass to element
        super('polyline', true, attr);

        // normalize coordinates
        this.xlim = xlim ?? [min(...xvals), max(...xvals)];
        this.ylim = ylim ?? [min(...yvals), max(...yvals)];
        this.points = zip(xvals, yvals);
    }

    props(ctx) {
        let points = ctx.coord_to_pixel(this.points);
        let pstr = points.map(([x, y]) => `${x},${y}`).join(' ');
        let base = {points: pstr};
        return {...base, ...this.attr};
    }
}

class SymPoints extends Container {
    constructor(args) {
        let {fx, fy, fs, fr, radius, shape, xlim, ylim, tlim, N, ...attr} = args ?? {};
        shape = shape ?? black_dot();
        radius = radius ?? 0.05;
        fr = fr ?? (() => radius);
        fs = fs ?? (() => shape);

        // compute point values
        let [tvals, xvals, yvals] = sympath({
            fx: fx, fy: fy, xlim: xlim, ylim: ylim, tlim: tlim, N: N
        });

        // make points
        let points = zip(tvals, xvals, yvals);
        let children = points.map(([t, x, y]) =>
            [fs(t, x, y), rad_rect([x, y], fr(t, x, y))]
        );

        // pass to element
        let attr1 = {clip: false, ...attr};
        super(children, attr1);
    }
}

// non-unary | variable-aspect | graphable
class Scatter extends Container {
    constructor(points, args) {
        let {shape, radius, xlim, ylim, ...attr} = args ?? {};
        shape = shape ?? black_dot();
        radius = radius ?? 0.05;

        // handle different forms
        points = points.map(p => (p[0] instanceof Element) ? p : [shape, p]);

        // pass to container
        let children = points.map(([s, p]) => [s, rad_rect(p, radius)]);
        let attr1 = {clip: false, ...attr};
        super(children, attr1);
    }
}

/**
 ** plotting elements
 **/

function make_ticklabel(s, prec) {
    let t = rounder(s, prec);
    return new Text(t, {
        calc_family: plot_font_base, font_weight: 100, vshift: -0.15
    });
}

function make_axislabel(s, attr) {
    attr = attr ?? {};
    return new Text(s, {
        calc_family: plot_font_base, font_weight: 100, ...attr
    });
}

function ensure_tick(t, prec) {
    prec = prec ?? 3;
    if (is_scalar(t)) {
        return [t, make_ticklabel(t, prec)];
    } else {
        let [p, x] = t;
        if (x instanceof Element) {
            return t;
        } else {
            return [p, make_ticklabel(x, prec)];
        }
    }
}

class XScale extends Container {
    constructor(ticks, args) {
        let {ylim, ...attr} = args ?? {};
        let [ymin, ymax] = ylim ?? limit_base;
        let children = ticks.map(t =>
            new VLine(t, {y1: ymin, y2: ymax})
        );
        super(children, attr);
    }
}

class YScale extends Container {
    constructor(ticks, args) {
        let {xlim, ...attr} = args ?? {};
        let [xmin, xmax] = xlim ?? limit_base;
        let children = ticks.map(t =>
            new HLine(t, {x1: xmin, x2: xmax})
        );
        super(children, attr);
    }
}

// the tick classes extend well outside their bounds (so don't clip)
class XTicks extends Container {
    constructor(ticks, args) {
        let {labelsize, lim, ...attr} = args ?? {};
        labelsize = labelsize ?? tick_label_size_base;
        lim = lim ?? limit_base;

        let [xmin, xmax] = lim;
        let labelwidth = (xmax-xmin)*labelsize;

        let children = ticks.map(ensure_tick).map(([t, x]) => [
            x, [t-labelwidth/2*x.aspect, 0, t+labelwidth/2*x.aspect, 1]
        ]);
        let attr1 = {clip: false, ...attr};
        super(children, attr1);
    }
}

class YTicks extends Container {
    constructor(ticks, args) {
        let {labelsize, lim, ...attr} = args ?? {};
        labelsize = labelsize ?? tick_label_size_base;
        lim = lim ?? limit_base;

        let [ymin, ymax] = lim;
        let labelheight = (ymax-ymin)*labelsize;

        let children = ticks.map(([t, x]) => [
            x, [1-labelsize*x.aspect, t-labelheight/2, 1, t+labelheight/2]
        ]);
        let attr1 = {clip: false, ...attr};
        super(children, attr1);
    }
}

class XAxis extends Container {
    constructor(ticks, args) {
        let {labelsize, prec, lim, ...attr} = args ?? {};
        labelsize = labelsize ?? tick_label_size_base;
        lim = lim ?? limit_base;

        // fill out tick text
        let locs = ticks.map(([t, x]) => t);
        let [xmin, xmax] = lim;

        // accumulate children
        let verti = new HLine(0.5, {x1: xmin, x2: xmax});
        let lines = new XScale(locs);
        let label = new XTicks(ticks, {labelsize: labelsize, lim: lim});

        // accumulate children
        let children = [verti, lines, [label, [0, 1, 1, 1+labelsize]]];
        let tscale = [xmin, 0, xmax, 1];
        let attr1 = {font_family: plot_font_base, scale: tscale, ...attr};
        super(children, attr1);
    }
}

class YAxis extends Container {
    constructor(ticks, args) {
        let {labelsize, prec, lim, ...attr} = args ?? {};
        labelsize = labelsize ?? tick_label_size_base;
        lim = lim ?? limit_base;

        // fill out tick text
        ticks = ticks.map(ensure_tick);
        let locs = ticks.map(([t, x]) => t);
        let [ymin, ymax] = lim;

        // accumulate children
        let horiz = new VLine(0.5, {y1: ymin, y2: ymax});
        let lines = new YScale(locs);
        let label = new YTicks(ticks, {labelsize: labelsize, lim: lim});

        // accumulate children
        let children = [horiz, lines, [label, [-1, 0, 0, 1]]];
        let tscale = [0, ymax, 1, ymin];
        let attr1 = {font_family: plot_font_base, scale: tscale, ...attr};
        super(children, attr1);
    }
}

class Axes extends Container {
    constructor(args) {
        let {
            xticks, yticks, ticksize, labelsize, xlim, ylim, xanchor, yanchor,
            aspect, prec, ...attr
        } = args ?? {};
        xticks = xticks ?? num_ticks_base;
        yticks = yticks ?? num_ticks_base;
        ticksize = ticksize ?? tick_size_base;
        labelsize = labelsize ?? tick_label_size_base;
        xlim = xlim ?? limit_base;
        ylim = ylim ?? limit_base;

        // handle ticksize cases
        let [xticksize, yticksize] = aspect_invariant(ticksize, aspect);

        // collect limits
        let [xmin, xmax] = xlim;
        let [ymin, ymax] = ylim;

        // determine axis locations
        xanchor = xanchor ?? ymin;
        yanchor = yanchor ?? xmin;
        xanchor = (xanchor-ymax)/(ymin-ymax);
        yanchor = (yanchor-xmin)/(xmax-xmin);

        // get xaxis ticks
        xticks = is_scalar(xticks) ? linspace(xmin, xmax, xticks) : xticks;
        xticks = (xticks != null) ? xticks.map(t => ensure_tick(t, prec)) : [];

        // get yaxis ticks
        yticks = is_scalar(yticks) ? linspace(ymin, ymax, yticks) : yticks;
        yticks = (yticks != null) ? yticks.map(t => ensure_tick(t, prec)) : [];
        let yticklocs = yticks.map(([y, t]) => y);

        // collect children
        let children = [];

        // make xaxis scale
        if (xticks != null) {
            let xaxis = new XAxis(xticks, {lim: xlim, labelsize: labelsize});
            children.push([
                xaxis, [0, xanchor-xticksize/2, 1, xanchor+xticksize/2]
            ]);
        }

        // make yaxis scale
        if (yticks != null) {
            let yaxis = new YAxis(yticks, {lim: ylim, labelsize: labelsize});
            children.push([
                yaxis, [yanchor-yticksize/2, 0, yanchor+yticksize/2, 1]
            ]);
        }

        // pass to container
        let attr1 = {aspect: aspect, ...attr};
        super(children, attr1);
        this.xticks = xticks;
        this.yticks = yticks;
        this.xticksize = xticksize;
        this.yticksize = yticksize;
    }
}

class XLabel extends Container {
    constructor(text, attr) {
        let label = is_element(text) ? text : make_axislabel(text);
        let attr1 = {font_family: plot_font_base, font_weight: 100, ...attr};
        super(label, attr1);
    }
}

class YLabel extends Container {
    constructor(text, attr) {
        let label = is_element(text) ? text : make_axislabel(text, {rotate: -90});
        let attr1 = {font_family: plot_font_base, font_weight: 100, ...attr};
        super(label, attr1);
    }
}

class Title extends Container {
    constructor(text, attr) {
        let label = is_element(text) ? text : make_axislabel(text);
        let attr1 = {font_family: plot_font_base, font_weight: 100, ...attr};
        super(label, attr1);
    }
}

class Grid extends Container {
    constructor(args) {
        let {xgrid, ygrid, xlim, ylim, gridcolor, ...attr} = args ?? {};
        xlim = xlim ?? limit_base;
        ylim = ylim ?? limit_base;
        gridcolor = gridcolor ?? grid_color_base;

        let [xmin, xmax] = xlim;
        let [ymin, ymax] = ylim;
        let grids = [];

        if (xgrid != null) {
            let xgridlines = new XScale(xgrid, {ylim: ylim, stroke: gridcolor});
            grids.push(xgridlines);
        }
        if (ygrid != null) {
            let ygridlines = new YScale(ygrid, {xlim: xlim, stroke: gridcolor});
            grids.push(ygridlines);
        }

        let scale = [xmin, ymax, xmax, ymin];
        let attr1 = {scale: scale, ...attr};
        super(grids, attr1);
        this.xlim = xlim;
        this.ylim = ylim;
    }
}

class Graph extends Container {
    constructor(lines, args) {
        let {xlim, ylim, xgrid, ygrid, aspect, ...attr} = args ?? {};
        aspect = aspect ?? 'auto';

        // handle singleton line
        if (lines instanceof Element) {
            lines = [lines];
        }

        // collect line ranges
        let [xmins, xmaxs] = zip(...lines
            .filter(c => 'xlim' in c).map(c => c.xlim)
        );
        let [ymins, ymaxs] = zip(...lines
            .filter(c => 'ylim' in c).map(c => c.ylim)
        );

        // determine coordinate limits
        xlim = xlim ?? [min(...xmins), max(...xmaxs)];
        ylim = ylim ?? [min(...ymins), max(...ymaxs)];
        let [xmin, xmax] = xlim;
        let [ymin, ymax] = ylim;

        // get scale and aspect
        if (aspect == 'auto') {
            let [xrange, yrange] = [abs(xmax-xmin), abs(ymax-ymin)];
            aspect = xrange/yrange;
        }

        // pass to container
        let scale = [xmin, ymax, xmax, ymin];
        let attr1 = {aspect: aspect, scale: scale, ...attr};
        super(lines, attr1);
        this.xlim = xlim;
        this.ylim = ylim;
    }
}

class Plot extends Container {
    constructor(lines, args) {
        let {
            xlim, ylim, xticks, yticks, xanchor, yanchor, xgrid, ygrid, gridcolor, xlabel, ylabel,
            title, ticksize, labelsize, labeloffset, ticklabelsize, titlesize, prec, aspect,
            margin, ...attr
        } = args ?? {};
        labelsize = labelsize ?? axis_label_size_base;
        labeloffset = labeloffset ?? axis_label_offset_base;
        titlesize = titlesize ?? title_size_base;

        // create graph from lines
        let graph = new Graph(lines, {
            xlim: xlim, ylim: ylim, xgrid: xgrid, ygrid: ygrid, aspect: aspect
        });

        // create axes to match
        let axes = new Axes({
            xticks: xticks, yticks: yticks, ticksize: ticksize, labelsize: ticklabelsize,
            xanchor: xanchor, yanchor: yanchor, xlim: graph.xlim, ylim: graph.ylim,
            aspect: graph.aspect, prec: prec
        });

        // create base layout
        let children = [axes, graph];

        // create gridlines
        if (xgrid != null || ygrid != null) {
            let xticklocs = axes.xticks.map(([x, t]) => x);
            let yticklocs = axes.yticks.map(([y, t]) => y);
            xgrid = (xgrid == true) ? xticklocs : xgrid;
            ygrid = (ygrid == true) ? yticklocs : ygrid;
            let grid = new Grid({
                xgrid: xgrid, ygrid: ygrid, xlim: graph.xlim, ylim: graph.ylim,
                gridcolor: gridcolor, aspect: graph.aspect
            });
            children.unshift(grid);
        }

        // optional axis labels
        let [xaxislabelsize, yaxislabelsize] = aspect_invariant(labelsize, graph.aspect);
        let [xaxislabeloffset, yaxislabeloffset] = aspect_invariant(labeloffset, graph.aspect);
        if (xlabel != null) {
            xlabel = new XLabel(xlabel);
            let xlabelrect = [0, 1+xaxislabeloffset, 1, 1+xaxislabeloffset+xaxislabelsize];
            children.push([xlabel, xlabelrect]);
        }
        if (ylabel != null) {
            ylabel = new YLabel(ylabel);
            let ylabelrect = [-yaxislabeloffset-yaxislabelsize, 0, -yaxislabeloffset, 1];
            children.push([ylabel, ylabelrect]);
        }

        // optional plot title
        if (title != null) {
            title = new Title(title);
            let titleoffset = 0.1;
            let titlerect = [0, -titleoffset-titlesize, 1, -titleoffset];
            children.push([title, titlerect]);
        }

        // pass to container
        let attr1 = {aspect: graph.aspect, ...attr};
        super(children, attr1);
    }

    inner(ctx) {
        return super.inner(ctx);
    }
}

//// INTERACTIVE

class InterActive {
    constructor(vars, func) {
        this.gumify = func;
        this.vars = vars;
    }

    create(redraw) {
        let vals = Object.fromEntries(
            Object.entries(this.vars).map(([k, v]) => [k, v.value])
        );
        if (redraw != null) {
            let elem = this.gumify(vals);
            if (elem instanceof Element) {
                elem = (elem instanceof SVG) ? elem : new SVG(elem);
                elem = elem.svg();
            }
            redraw.innerHTML = elem;
        }
        return this.gumify(vals);
    }

    createAnchors(redraw) { // tag is where to append anc, redraw is where to redraw
        let i = this;
        let ancs = Object.entries(this.vars).map(([v, k]) => {
            try {
                let z = k.anchor(v, i, redraw);
                return z;
            } catch {
                return null;
            }
        });
        return ancs;
    }
}

class Variable {
    constructor(init, args) {
        args = args ?? {};
        this.value = init;
        this.attr = Object.fromEntries(
            Object.entries(args).filter(([k, v]) => v != null)
        );
    }

    updateVal(val, ctx, redraw) {
        this.value = val;
        ctx.create(redraw);
    }
}

class Slider extends Variable {
    constructor(init, args) {
        args = args ?? {};
        args.min = args.min ?? 0;
        args.max = args.max ?? 100;

        super(init, args);
    }

    // ctx is an interactive context
    anchor(name, ctx, redraw) {
        let v = this;
        let [min, max] = [v.attr.min, v.attr.max];

        let cont = document.createElement('div');
        cont.className = 'var_cont slider_cont';

        let slider = document.createElement('div');
        slider.className = 'slider';

        let title = document.createElement('div');
        title.className = 'var_title';
        title.innerHTML = v.attr.title ?? `Slider: ${name}`;

        let valInd = document.createElement('span');
        valInd.id = `sliderVal_${name}`;
        valInd.className = 'slider_label';
        valInd.innerHTML = this.value;

        let phantomTrack = document.createElement('div');
        phantomTrack.className = 'phantom_track';

        let trackWrap = document.createElement('div');
        trackWrap.className = 'phantom_track_wrap';

        let min_lim = document.createElement('div');
        min_lim.innerHTML = min;
        min_lim.className = 'min_lim';
        let max_lim = document.createElement('div');
        max_lim.innerHTML = max;
        max_lim.className = 'max_lim';

        trackWrap.append(min_lim, phantomTrack, max_lim);

        let input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.value = this.value;
        input.className = 'slider_input'; // set the CSS class
        input.id = `InterActive_${name}`;

        slider.append(trackWrap, valInd, input);
        cont.append(title, slider); // slider in cont in targ!

        updateSliderValue(input);
        input.addEventListener('input', function() {
            updateSliderValue(this);
            v.updateVal(this.value, ctx, redraw);
        }, false);

        return cont;
    }
}


class Toggle extends Variable {
    constructor(init, args) {
        init = init == undefined ? true : init;
        args = args ?? {};
        super(init, args);
    }

    // ctx is an interactive context
    anchor(name, ctx, redraw) {
        let v = this;

        let checkinner = `
<span class="toggle-indicator">
    <span class="checkMark">
        <svg width="20" height="20">
            <use xlink:href="icons.svg#svg-check"></use>
        </svg>
    </span>
</span>
`.trim();

        let cont = document.createElement('div');
        cont.className = 'var_cont toggle_cont';

        let toggle = document.createElement('label');
        toggle.className = 'toggle';

        let track = document.createElement('span');
        track.className = 'toggle-track';
        track.innerHTML = checkinner;

        let title = document.createElement('div');
        title.className = 'var_title';
        title.innerHTML = v.attr.title ?? `Toggle: ${name}`;

        let input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'toggle__input';
        input.checked = this.value;
        input.id = `InterActive_${name}`;

        toggle.append(input, track);
        //targ.appendChild(cont).append(title, toggle); // slider in cont in targ!
        cont.append(title, toggle); // slider in cont in targ!
        input.addEventListener('input', function() {
            v.updateVal(this.checked, ctx, redraw);
        }, false);

        return cont
    }
}

class List extends Variable {
    constructor(init, args) {
        args = args ?? {};
        args.choices = args.choices ?? {};

        if (args.choices instanceof Array) {
            args.choices = args.choices.reduce((a, v) => ({ ...a, [v]: v}), {});
        }

        super(init, args);
    }

    // ctx is an interactive context
    anchor(name, ctx, redraw) {
        let v = this;

        let wrap = document.createElement('div');
        wrap.className = 'custom-select-wrapper';

        let source = document.createElement('div');
        source.className = 'custom-select sources';

        let trigger = document.createElement('span');
        trigger.className = 'custom-select-trigger';
        trigger.innerHTML = v.value;

        let opts = document.createElement('div');
        opts.className = 'custom-options';


        wrap.appendChild(source).append(trigger, opts);

        Object.entries(v.attr.choices).forEach(([label, value]) => {

        let o  = document.createElement('div');
        o.className = 'custom-option';
        o.innerHTML = label;
        o.setAttribute('data-value', value);
        opts.append(o);
        o.addEventListener('click', function() {
                let opt = this.closest('.custom-select');
                let opt_txt = this.textContent;
                let opt_val = this.getAttribute('data-value');
                opt.querySelector('.custom-select-trigger').innerHTML = opt_txt;
                v.updateVal(opt_val, ctx, redraw);
                opt.classList.toggle("opened");
            }, false);
        });


        let cont = document.createElement('div');
        cont.className = 'var_cont list_cont';

        let list = document.createElement('div');
        list.className = 'list';
        list.appendChild(wrap);

        let title = document.createElement('div');
        title.className = 'var_title';
        title.innerHTML = v.attr.title ?? `List: ${name}`;

        cont.append(title, list); // slider in cont in targ!

        list.querySelector('.custom-select-trigger').addEventListener('click', function() {
                this.parentElement.classList.toggle("opened");
            }, false);

        return cont
    }
}

/// shit for making interactive bits beautiful

function updateSliderValue(slider) {
    let pos = (slider.value - slider.min) / (slider.max - slider.min);
    let len = slider.getBoundingClientRect().width;
    let lab = slider.parentNode.querySelector('.slider_label');
    let lef = (100*pos*(len-30))/len;
    lab.innerHTML = slider.value;
    lab.style.left = `${lef}%`; //in prec for window resize events
}

/**
 ** expose
 **/

let Gum = [
    Context, Element, Container, Group, SVG, Frame, VStack, HStack, Point, Place, Spacer, Ray,
    Line, HLine, VLine, Rect, Square, Ellipse, Circle, Polyline, Polygon, Path, Text, Tex, Node,
    MoveTo, LineTo, Bezier2, Bezier3, Arc, Close, SymPath, SymPoints, Scatter, XScale, YScale,
    XAxis, YAxis, Axes, Graph, Plot, InterActive, Variable, Slider, Toggle, List, XTicks, YTicks,
    range, linspace, hex2rgb, rgb2hex, interpolateVectors, interpolateHex, interpolateVectorsPallet,
    zip, exp, log, sin, cos, min, max, abs, sqrt, floor, ceil, round, pi, rounder,
    make_ticklabel
];

// detect object types
function detect(g) {
    if ('prototype' in g) {
        let [t, ...x] = g.toString().split(' ');
        return t;
    } else {
        return 'value';
    }
}

// interface mapper
let gums = Gum.map(g => g.name);
let mako = Gum.map(g => {
    let t = detect(g);
    if (t == 'class') {
        return function(...args) {
            return new g(...args);
        };
    } else if (t == 'function') {
        return function(...args) {
            return g(...args);
        }
    } else {
        return g;
    }
});

// main parser entry
function parseGum(src) {
    let expr = new Function(gums, src);
    return expr(...mako);
}

function renderGum(src, args) {
    let elem = parseGum(src);
    if (is_element(elem)) {
        elem = (elem instanceof SVG) ? elem : new SVG(elem, args);
        return elem.svg();
    } else {
        return String(elem);
    }
}

function parseHTML(str) {
    let tmp = document.implementation.createHTMLDocument('');
    tmp.body.innerHTML = str;
    return tmp.body.children[0];
}

// image injection for static viewing
function injectImage(img) {
    let src = img.getAttribute('src');
    let request = new XMLHttpRequest();
    request.open('GET', src, true);
    request.onload = function() {
        if (this.status >= 200 && this.status < 400) {
            let cls = img.classList;
            let alt = img.getAttribute('alt');
            let svg = parseHTML(this.response);
            svg.classList = cls;
            svg.setAttribute('alt', alt);
            img.parentNode.replaceChild(svg, img);
        }
    };
    request.send();
}

function injectImages(elem) {
    elem = elem ?? document;
    elem.querySelectorAll('img').forEach(img => {
        if (img.classList.contains('gum')) {
            injectImage(img);
        }
    });
}

export { Arc, Axes, Bezier2, Bezier3, Circle, Close, Container, Context, Element, Ellipse, Frame, Graph, Group, Gum, HStack, InterActive, Line, LineTo, List, MoveTo, Node, Path, Place, Plot, Point, Polygon, Polyline, Ray, Rect, SVG, Scatter, Slider, Spacer, Square, SymPath, SymPoints, Tex, Text, Toggle, VStack, Variable, XAxis, XScale, XTicks, YAxis, YScale, YTicks, abs, ceil, cos, demangle, exp, floor, gums, gzip, hex2rgb, injectImage, injectImages, interpolateHex, interpolateVectors, interpolateVectorsPallet, linspace, log, make_ticklabel, mako, max, min, pad_rect, parseGum, pi, pos_rect, props_repr, rad_rect, range, renderGum, rgb2hex, round, rounder, sin, sqrt, zip };
