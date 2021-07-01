#! Expected Utility
\R:\mathbb{R}
\s:\succcurlyeq 

The *expected utility model* (EU) is a model of decision making over risky choice objects, i.e., the choice objects are probability distributions over final consumption outcomes. The defining characteristic of the expected utility model is that the utility of such risky objects is equal to the expectation of the utility of the final consumption outcomes. Due to its simplicity, both in terms of the mathematical representation and also its implications for choice behavior, the EU model is ubiquitous in economics, game theory, and other applications of decision theory. 

#[model] The Model

Let $X$ denote a set of final consumption outcomes. Then the objects of choice are finitely supported probability distributions over $X$, referred to as *lotteries*. Let $\Pi$ collect the set of lotteries. For $\pi \in \Pi$ and $x \in X$, let $\pi(x)$ denote the probability the lottery $\pi$ assigns to the outcome $x$.

>> definition [def_eu] A [[utility_function|utility function]] $U: \Pi \to \R$ is an *expected utility* functional if there exists a function $u: X \to \R$ such that 

$$ U(\pi) = \sum_{supp(\pi)} u(x)\pi(x)

<< where $supp(\pi) = \{x \in X \mid \pi(x) > 0\}$ is the support if $\pi$.

The function $u$ is generally referred to as a utility index, a Bernoulli utility index, or a vNM utility index.

The interpretation is that the value of a lottery is derived from the expected value of the possible outcomes, the later being represented by $u$. As such, the value of a lottery varies linearly in the probabilities of outcomes: the marginal value of increasing shifting probability from one outcome $x$ to the outcome $y$ is constant.

#[ax] Axiomatic Characterization 

The expected utility model was first axiomatized by @[morgenstern1953theory]. The primitive of the behavioral model is a [[preference_relation|preference relation]] over $\Pi$. The standard model has four axioms: 

>>! axiom (@[completeness:completeness|text=Completeness]) For all $\pi,\rho \in \Pi$, either $\pi \succcurlyeq \rho$ or $\rho \succcurlyeq \pi$.

>>! axiom (@[transitivity:transitivity|text=Transitivity]) For all $\pi,\rho,\sigma \in \Pi$, if $\pi \s \rho$ and $\rho \s \sigma$ then $\pi \s \sigma$.

>>! axiom (Archimedean)  For all $\pi,\rho,\sigma \in X$,   if  $\pi \succ \rho$ and $\rho \succ \sigma$  then  there  exist  $\alpha,\beta\in(0,1)$ such that $\alpha\pi + (1-\alpha)\sigma \succ \rho$ and $\rho \succ \beta\pi + (1-\beta)\sigma$.

>>! axiom (Independence) For all $\pi,\rho,\sigma \in X$, and $\alpha \in (0,1)$, $\pi \s \rho$ if and only if $\alpha\pi + (1-\alpha)\sigma \s \alpha\rho + (1-\alpha)\sigma$.