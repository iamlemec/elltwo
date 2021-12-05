export { latexTemplate }

function latexTemplate(d) {
    return String.raw`
%
% This .tex file was created with elltwo ($\ell^2$)
% [201p // iamlemec]
%

\documentclass[12pt]{article}
\usepackage[english]{babel} % English language/hyphenation
\usepackage{amsmath,amsfonts,amsthm,amssymb} % Math packages
\usepackage{array}
\usepackage{fullpage}
\usepackage{enumerate}
\usepackage{enumitem}
\usepackage{ulem}
\usepackage[style=authoryear,natbib=true]{biblatex} % bib
\usepackage[unicode]{hyperref} % hyperlinks
\usepackage{xcolor} % colors
\usepackage{cleveref} % references
\usepackage{newverbs}
\usepackage{fancyvrb}
\usepackage{fvextra}
\usepackage{geometry}
\usepackage{graphicx}
\usepackage{filecontents} % for bib

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

% local bib entries

\begin{filecontents}{\jobname.bib}
${d.bib}
\end{filecontents}
\addbibresource{\jobname.bib}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\begin{document}

\title{\vspace{-3em}${d.title}\vspace{-3em}}
\date{}

\maketitle

${d.body}

\printbibliography

\end{document}
    `.trim();
}
