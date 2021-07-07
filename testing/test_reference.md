#! Testing: Reference

$$ [equation] \exp(\alpha)

!svg [svg_figure|caption=It's a box]
<rect x="5" y="5" width="90" height="90" stroke="black" fill="coral" />

>>! theorem [hello]
Hello world!

>>! theorem [hello_named|name=rt=Hello Theorem]
Hello world named!

# Article

[[howto]]

[[howto|The **Article**]]

[[unknown]]

[[unknown|The **Article**]]

# Internal

@[equation]

@[svg_figure]

@[hello]

## Renamed

@[equation|text=The **Equation**]

@[svg_figure|text=The **Figure**]

@[hello|text=The **Theorem**]

## Error

@[unknown]

@[unknown|text=The **Unknown**]

# External

@[howto:eq_geo]

@[test_reference:hello]

@[test_reference:hello_named]

## Renamed

@[howto:eq_geo|text=The **Equation**]

@[test_reference:hello|text=The **Theorem**]

@[test_reference:hello_named|text=The **Theorem**]

## Error

@[howto:unknown]

@[known:unknown]

@[known:unknown|text=The **Entity**]

# Citations

@[morgenstern1953theory]

@[morgenstern1953theory|text=The **Citation**]

@[somejoker2005]

@[somejoker2005|text=The **Citation**]

# Footnotes

Yep ^[Hello **world**!]. Hello!