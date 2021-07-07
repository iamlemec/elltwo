#! Testing: Reference

$$ [equation] \exp(\alpha)

!svg [svg_figure|caption=It's a box]
<rect x="5" y="5" width="90" height="90" stroke="black" fill="coral" />

>>! theorem [hello]
Hello world!

>>! theorem [hello_named|name=ref_text=Hello Theorem]
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

@[equation|name=The **Equation**] — not working (should be renamed)

@[svg_figure|text=The **Figure**]

@[hello|text=The **Theorem**]

## Error

@[unknown]

@[unknown|text=The **Unknown**]

# External

@[howto:eq_geo]

@[test_reference:hello]

@[howto:thm_BC] — should have source article?

## Renamed

@[howto:eq_geo|text=The **Equation**]

@[test_reference:hello|name=The **Theorem**] — not working (should be renamed)

@[howto:thm_BC|text=The **Theorem**]

## Error

@[howto:unknown]

@[known:unknown]

@[known:unknown|name=The **Entity**] — not working (should be renamed)

# Citations

@[morgenstern1953theory]

@[morgenstern1953theory|text=The **Citation**]

@[somejoker2005]

@[somejoker2005|name=The **Citation**] — not working (should be renamed)