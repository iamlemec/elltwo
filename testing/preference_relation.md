#! Preference Relations
\R:\mathbb{R}
\s:\succcurlyeq
\f:\frac{#1}{#2}
\l:\downarrow\!

A *preference relation* is a binary relation symbolizing the preference of a decision maker (DM) over a set of alternatives, the typical notation for which is $\succcurlyeq$. If $x$ and $y$ are alternatives considered by the decision maker, then $x \succcurlyeq y$ is interpreted as the statement that the DM considers $x$ to at least as good as $y$. Formally, $\succcurlyeq$ is a subset of $X \times X$, but it is common practice to use infix notation, as above.

A preference relation is often taken as the primitive (i.e., observable data) in decision theoretic models. The objects under consideration depend on the model, and are commonly: consumption prospects, lotteries or probability distributions over consumption, state-contingent claims on consumption, dynamic streams, and menus or collections of consumption objects.  

A common theme of decision theoretic models is the examination of various restrictions, called axioms, on what preferences are admissible. These restrictions often characterize a utility-functional or choice theoretic model with a specific semantic interpretation. 

# Strict and Weak Preferences

'$x \s y$' is interpreted as the statement that the DM considers $x$ to at least as good as $y$: this permits the possibility that $x$ and $y$ are considered equally good.

Starting with $\succcurlyeq$, we can define *strict preference*, denoted by $\succ$, by taking the asymmetric component of the weak preference relation. That is $x \succ y$ iff $x \succcurlyeq y$ and not $y \succcurlyeq x$. Some models take $\succ$ as the primitive, and, assuming @[completeness:completeness|text=completeness] the corresponding weak preference can be recovered. 

A weak preference relation also defines an *indifference relation* via $x \sim y$ iff $x \succcurlyeq y$ and $y \succcurlyeq x$.

# Representation

Another way of formalizing a DM's preferences is via a [[utility_function|utility function]], a function $U: X \to \R$. Under this interpretation, the DM considers $x$ to at least as good as $y$ if and only if $U(x) \geq U(y)$.

>> definition [def_rep] A utility function $U: X \to \R$ *represents* a preference relation $\s$ over $X$ (equivalently, $\s$ is *represented by* $U$, or $U$ is a *representation* of $\s$) if,

$$[df] U(x) \geq U(y) \iff x \s y

<< for all $x,y \in X$.

A *representation theorem* ensures the existence of a representation, $U$, with specific properties by placing restriction (axioms) on $\s$. Often, this is accompanied by a uniqueness claim guaranteeing that this representation is unique in some meaningful way. While preference relations are theoretically observable, utility functions are often easier to work with in practice; representation theorems bridge this gap as well as provide insight into the choice behavior (embodied by $\s$) of a high level semantic model (embodied by $U$). 

The simplest representation theorem ensures the existence of a representation over finite domains:

>>! theorem [thm_rep] A preference relation $\s$, defined on a finite set $X$, is @[completeness:completeness|text=complete] and @[transitivity:transitivity|text=transitive] if and only if it is represented by a utility function $U:X\to\R$.

>> proof The if direction is obvious. Only if: For each $x \in X$ define $\l(x) = \{ y \in X \mid x \s y\}$. We claim: $U: x \mapsto \#(\l(x))$ represents^[For a set $A$, $\#(A)$ is the number of elements in $A$.] $\s$. 

First, notice that @[transitivity:transitivity] ensures that if $x\s y$ then $\l(x) \supseteq \l(y)$. It follows immediately that if $x\s y$ then $\#(\l(x)) \geq \#(\l(y))$.

<< Towards the other direction, let $\#(\l(x)) \geq \#(\l(y))$. Now it cannot be that $y \succ x$, as this would imply $\l(y) \supsetneq \l(x)$, contradicting our assumption. Thus by @[completeness:completeness] we have that $x \s y$.

When $X$ is countable, @[thm_rep] still holds, although the proof must be altered slightly. Instead of associating the cardinality of the lower contour set, we must first order the elements of $X$ by the natural numbers $o: X \to \mathbb{N}$, and then take some convergent series as our utilities. For instance

$$[id=order] U: x \mapsto \sum_{y \in \downarrow(x)} \frac{1}{2^{o(y)}}

## Ordinality 

The magnitude of the utilities in a representation are irrelevant (and indeed at times misleading), since $\s$ embodies only ordinal preference. Without additional assumptions on the interpretation of $\s$ (for example expected utility), there is no sense in which $x \s y$ measures how much *more preferred* $x$ is than $y$, only that it is preferred.

This fact is made formal through the following theorem:

>>! theorem [mon_trans] If $U: X \to \R$ represents $\s$ and $h: \R \to \R$ is strictly increasing then $V = h \circ U$ also represents $\s$.