function latexTemplate(d) {
    let packages = [
        ['babel', 'english'], 'amsmath', 'amsfonts', 'amsthm', 'amssymb', 'array',
        'fullpage', 'enumerate', 'enumitem', 'ulem', ['hyperref', 'unicode'], 'xcolor',
        'cleveref', 'newverbs', 'fancyvrb', 'fvextra', 'geometry', 'graphicx'
    ];
    let head = [];
    let tail = [];

    if (d.bib != null) {
        let bibpack = [
            ['biblatex', 'style=authoryear,natbib=true'], 'filecontents'
        ];
        packages.push(...bibpack);

        head.push(
            '% local bib entries',
            '\\begin{filecontents}{\\jobname.bib}',
            d.bib,
            '\\end{filecontents}',
            '\\addbibresource{\\jobname.bib}',
        );

        tail.push(
            '\\printbibliography',
        );
    }

    let packstr = packages.map(p => {
        let o = '';
        if (p instanceof Array) {
            [p, o] = p;
            o = `[${o}]`;
        }
        return `\\usepackage${o}{${p}}`;
    }).join('\n');

    let headstr = head.join('\n');
    let tailstr = tail.join('\n');

    return String.raw`
%
% This .tex file was created with elltwo ($\ell^2$)
% [201p // iamlemec]
%

\documentclass[12pt]{article}
${packstr}

\geometry{margin=1.25in}
\setlength{\parindent}{0cm}
\setlength{\parskip}{0.3cm}
\renewcommand{\baselinestretch}{1.1}

%% colors
\definecolor{lam1}{HTML}{127DFF}
\definecolor{lam2}{HTML}{95B204}
\definecolor{err}{HTML}{B30000}
\definecolor{code}{HTML}{95B204}

\hypersetup{
colorlinks=true,
linkcolor=lam1,
urlcolor=lam1,
citecolor=lam1
}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%% stock new commands
\renewcommand{\blacksquare}{\vrule height7pt width4pt depth1pt}
\newcommand{\hl}[1]{\textcolor{err}{\textsc{#1}} }
\newverbcommand{\cverb}{\color{code}}{}
\DefineVerbatimEnvironment{blockcode}
  {Verbatim}
  {fontsize=\small,formatcom=\color{blue},breaklines=true}

%% user created newcommands
${d.macros}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

${d.envs}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

${headstr}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\begin{document}

\title{\vspace{-3em}${d.title}\vspace{-3em}}
\date{}

\maketitle

${d.body}

${tailstr}

\end{document}
    `.trim();
}

export { latexTemplate };