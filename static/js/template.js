export { htmlTemplate, latexTemplate }

function htmlTemplate(d) {
    return String.raw`
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html lang="en">

<head>

<meta name="viewport" content="width=device-width, initial-scale=1">

<link rel="icon" href="${d.prefix}/favicon/elltwo.svg" />

<link rel="stylesheet" href="${d.prefix}/css/article.css" />
<link rel="stylesheet" href="${d.prefix}/themes/white.css" />
<link rel="stylesheet" href="${d.prefix}/katex/katex.min.css" />

<script src="${d.prefix}/libs/jquery.min.js" ></script>
<script src="${d.prefix}/katex/katex.min.js"></script>

<title>External</title>

</head>

<body>

<script id="markdown" type="text/template">
${d.markdown}
</script>

<script type="module">
import { loadMarkdown } from '${d.prefix}/js/render.js'
loadMarkdown();
</script>

</body>

</html>
    `.trim();
}

function latexTemplate(d) {
    let packages = [
        ['babel', 'english'], 'amsmath', 'amsfonts', 'amsthm', 'amssymb', 'array',
        'fullpage', 'enumerate', 'enumitem', 'ulem', ['hyperref', 'unicode'], 'xcolor',
        'cleveref', 'newverbs', 'fancyvrb', 'fvextra', 'geometry'
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

    if (d.img.map(t => t.startsWith('image')).length > 0) {
        packages.push('graphicx');
    }
    if (d.img.map(t => t.startsWith('image/svg')).length > 0) {
        packages.push('svg');
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
