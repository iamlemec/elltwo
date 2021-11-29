# convert from other formats (mostly latex)

import re

brack = r'(\[[^\]]+\])?'
curly = r'{([^}]+)}'
strip = r'\s*(.+)\s*'

strats = {
    'documentclass': (rf'\\documentclass{brack}{curly}', r''),
    'title': (rf'\\title{curly}', r'#! \1'),
    'document': (rf'\\(?:begin|end){{document}}', r''),
    'equation': (rf'\\begin{{(equation)(\*?)}}{strip}\\end{{\1\2}}', r'$$\2\n\3'),
    'align': (rf'\\begin{{(align)(\*?)}}{strip}\\end{{\1\2}}', r'$$&\2\n\3'),
    'image': (rf'\\includegraphics{brack}{curly}', r'! [\2]'),
}

def convert_latex(tex):
    for name, (p, r) in strats.items():
        tex, n = re.subn(p, r, tex, flags=re.S)
        print(f'{name}: {n}')
    ret = re.sub('\n{3,}', '\n\n', tex)
    return ret.strip()
