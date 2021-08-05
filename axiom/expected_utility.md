#! Expected Utility
\R:\mathbb{R}
\s:\succcurlyeq 

The *expected utility model* (EU) is a model of decision making over risky choice objects, i.e., the choice objects are probability distributions over final consumption outcomes. The defining characteristic of the expected utility model is that the utility of such risky objects is equal to the expectation of the utility of the final consumption outcomes. Due to its simplicity, both in terms of the mathematical representation and also its implications for choice behavior, the EU model is ubiquitous in economics, game theory, and other applications of decision theory. 

#[model] The Model

Let $X$ denote a set of final consumption outcomes. Then the objects of choice are finitely supported probability distributions over $X$, referred to as *lotteries*. Let $\Pi$ collect the set of lotteries. For $\pi \in \Pi$ and $x \in X$, let $\pi(x)$ denote the probability the lottery $\pi$ assigns to the outcome $x$.

The set $\pi$ can be viewed as a *mixture space* under point-wise mixtures. For $\alpha \in (0,1)$, and $\pi, \rho \in \Pi$, let $\alpha\pi + (1-\alpha)\rho$ denote the lottery that yields $x\in X$ with probability $\alpha\pi(x) + (1-\alpha)\rho(x)$.

>> definition [def_eu] A [[utility_function|utility function]] $U: \Pi \to \R$ is an *expected utility* functional if there exists a function $u: X \to \R$ such that 

$$ U(\pi) = \sum_{supp(\pi)} u(x)\pi(x)

<< where $supp(\pi) = \{x \in X \mid \pi(x) > 0\}$ is the support of $\pi$.

The function $u$ is generally referred to as a utility index, a Bernoulli utility index, or a vNM utility index.

The interpretation is that the value of a lottery is derived from the expected value of the possible outcomes, the later being represented by $u$. As such, the value of a lottery varies linearly in the probabilities of outcomes: the marginal value of increasing shifting probability from one outcome $x$ to the outcome $y$ is constant.

#[id=ax] Characterization 

The expected utility model was first axiomatized by @@[vonNeumann1944theory]. The primitive of the behavioral model is a [[preference_relation|preference relation]] over $\Pi$. The standard model has four axioms.

>>! axiom[ax-c] (@[completeness:completeness|text=Completeness]) For all $\pi,\rho \in \Pi$, either $\pi \succcurlyeq \rho$ or $\rho \succcurlyeq \pi$.

>>! axiom (@[transitivity:transitivity|text=Transitivity]) For all $\pi,\rho,\sigma \in \Pi$, if $\pi \s \rho$ and $\rho \s \sigma$ then $\pi \s \sigma$.

>>! axiom (@[archimedean_axiom:Archimedean|text=Archimedean])  For all $\pi,\rho,\sigma \in X$,   if  $\pi \succ \rho$ and $\rho \succ \sigma$  then  there  exist  $\alpha,\beta\in(0,1)$ such that $\alpha\pi + (1-\alpha)\sigma \succ \rho$ and $\rho \succ \beta\pi + (1-\beta)\sigma$.

>>! axiom [ax-i] (Independence) For all $\pi,\rho,\sigma \in X$, and $\alpha \in (0,1)$, $\pi \s \rho$ if and only if $\alpha\pi + (1-\alpha)\sigma \s \alpha\rho + (1-\alpha)\sigma$.

The completeness and transitivity axioms are necessary for any utility representation and the Archimedean axiom, a weak form of continuity applicable in mixture spaces, requires that no outcome is infinitely more desirable than any other outcome. The linear structure, central to the EU model, arises from the independence axiom. 

>>! theorem [eu_rep] A preference relations $\s$ satisfies Axioms @[ax-c|f=plain]-@[ax-i|f=plain] if and only if it has an EU representation. Moreover if $u$ and $v$ are two utility indices that represent $\s$ then $u = av+b$ for some $a \in \R_+$ and $b \in \R$.

## [id=sec_geo] Geometric Interpretation 

We can represent the set of all lotteries over three outcome ($x$, $y$, and $z$) via the two-dimensional simplex. The $x$-axis coordinate represents the probability of $x$, the $y$-axis the probability of $y$, with any remaining probability allotted to $z$. This is represented in @[fig_EUInd].

The indifference curves of an expected utility maximizer are linear and parallel in this space. In fact, these two properties characterize expected utility.

!svg [id=fig_EUInd|caption=Indifference curves in the expected utility model are linear and parallel.|w=80]
  <line class=theme_col y2="84.72955" x2="18.66666" y1="10.49999" x1="18.66666"/>
  <line class=theme_col y2="77.49999" x2="91.17777" y1="77.49999" x1="11.16666"/>
  <line class=theme_col y2="77.66666" x2="79.83332" y1="22.49999" x1="18.99999"/>
  <ellipse ry="1.66667" rx="1.66667" id="svg_12" cy="77.33332" cx="18.83333"  stroke-width="0" stroke="#000" fill="#CE7975"/>
  <ellipse ry="1.66667" rx="1.66667" id="svg_14" cy="61.83332" cx="62.49999"  stroke-width="0" stroke="#000" fill="#CE7975"/>
  <line id="svg_15" y2="62.16666" x2="62.16666" y1="76.83332" x1="19.16666"  stroke-dasharray="2,2" stroke="#CE7975" fill="none"/>
  <line id="svg_16" y2="48.49999" x2="47.83332" y1="57.99999" x1="19.16666" stroke-dasharray="2,2" stroke="#619E73" fill="none"/>
  <ellipse ry="1.66667" rx="1.66667" id="svg_17" cy="58.49999" cx="18.66666"  stroke-width="0" stroke="#CE7975" fill="#529D94"/>
  <ellipse ry="1.66667" rx="1.66667" id="svg_18" cy="48.33333" cx="47.49999"  stroke-width="0" stroke="#CE7975" fill="#529D94"/>
<foreignObject y="42" x="22" width="50" height="50">
    <span class='latex' style='font-size:15%'>
      \beta z + (1-\beta) y
    </span>
  </foreignObject>
<foreignObject y="23" x="47" width="50" height="50">
    <span class='latex' style='font-size:15%'>
      \beta(\alpha x + (1-\alpha)y) + (1-\beta)y
    </span>
  </foreignObject>
<foreignObject y="40" x="67" width="50" height="50">
    <span class='latex' style='font-size:15%'>
      \alpha x + (1-\alpha)y
    </span>
  </foreignObject>
  <foreignObject y="1.66666" x="10.66666" width="50" height="50">
    <span class='latex' style='font-size:20%'>
      y
    </span>
  </foreignObject>
    <foreignObject y="63" x="81" width="50" height="50">
    <span class='latex' style='font-size:20%'>
      x
    </span>
  </foreignObject>
  <foreignObject y="63" x="21.33333" width="50" height="50">
    <span class='latex' style='font-size:20%'>
      z
    </span>
  </foreignObject>

To see this, notice that if $x \succ z \succ y$, then there exists an $\alpha \in (0,1)$ such that $\alpha x + (1-\alpha)y \sim z$. Then by the independence axiom, $\gamma z + (1-\gamma)(\alpha x + (1-\alpha)y) \sim z$ for all $\gamma \in (0,1)$, hence the indifference curve running between $\alpha x + (1-\alpha)y$ and $z$ is simply the line between them (the pink line in @[fig_EUInd]).

Applying the independence axiom again, mixing both $\alpha x + (1-\alpha)y$ and $z$ with $y$, we see: 

$$* \beta(\alpha x + (1-\alpha)y) + (1-\beta) y \sim \beta z + (1-\beta)y

By the above argument, the indifference curve between these two lotteries is again linear, and thus, an affine translation of the first indifference curve (this is the green line in @[fig_EUInd]).