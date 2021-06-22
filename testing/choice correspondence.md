#! Choice Correspondence
\R:\mathbb{R}
\C:\mathscr{C}
\s:\succcurlyeq 

A *choice correspondence* is a functions symbolizing the choices of a decision maker (DM) over various decision problems. If a set $X$ represents the set alternatives considered by the decision maker, then for a given choice problem, $A \subseteq X$, the choice correspondence, $C$, selects the set of chosen (or potentially chosen) alternatives from $A$. 

Formally, let $\C$ denote the non-empty subsets of $X$, called choice problems, or choice sets. Then a choice correspondence is a function $C: \C \to \C$ such that $C(A) \subseteq A$ for all $A \in \C$.

A choice correspondence is often taken as the primitive (i.e., observable data) in choice theoretic models. The objects under consideration (i.e., the elements of $X$) depend on the model, and are commonly: consumption prospects, lotteries or probability distributions over consumption, state-contingent claims on consumption, dynamic streams, and menus or collections of consumption objects.  

# Rationalization

There is a close connection between choice correspondences and [[preference_relation|preference relations]] made concrete by the following definition: 

>> definition [def_rat] Say $\s$ *rationalizes* $C$ (where both are  defined relative to the same $X$) if

$$ [eq_rat] C(A) = \{ x \in A \mid x \s y, \forall y \in A \}


<< for all $A \in \C$.

When $\s$ is represented by a [[utility_function|utility function]], $U: X\to\R$, then @[eq_rat] is equivalent to 

$$ [def_rat_u] C(A) = \textup{argmax}_{x \in A} \ U(x)

so that $C$ selects those elements of $A$ which maximize the utility function.

# Revealed Preference

Say that $x$ is *revealed preferred* to $y$ if $x \in C(\{x,y\})$. Clearly, this yields a binary relation over the set of alternatives.  We can write this as $x \s^C y$.  A natural restriction, *weak axiom of revealed preference* or WARP, ensures (in the finite setting) that $\s^C$ is @[completeness:completeness|text=complete] and @[transitivity:transitivity|text=transitive].

>>! axiom* [name=id=rt=WARP] If $x,y \in A \cap B$ and $x \in C(A)$ and $y \in C(B)$ then $x \in C(B)$.

In fact, @[WARP] goes further and ensures $\s^C$ rationalizes $C$. Then, since this relation satisfies the requirements to be represented by a utility function, we have that $C$ is itself rationalized as in @[def_rat_u].

>>! theorem [id=warp_rep] Let $X$ be a finite set and $C$ a choice correspondence thereon. If $C$ satisfies @[WARP] then it is rationalized by a utility function, $U:X\to\R$.

>> proof That $\s^C$ is @[completeness:completeness|text=complete] follows from the definition of $C$, namely that its image is non-empty. Now to show that $\s^C$ is also @[transitivity:transitivity|text=transitive], assume that $x \s^c y$ and $y \s^C z$. Since $C$ is non-empty, either $x$, $y$, or $z$ is in $C(\{x,y,z\})$. Thus there are three cases:

**Case 1**. $x \in C(\{x,y,z\})$. Then by @[WARP], $x \in C(\{x,z\})$, as we have established that $x \s^C z$. 

**Case 2**. $y \in C(\{x,y,z\})$. Then $x \in C(\{x,y,z\})$ by @[WARP], reducing the problem to Case 1.

**Case 3**. $z \in C(\{x,y,z\})$. Then $y \in C(\{x,y,z\})$ by @[WARP], reducing the problem to Case 2.

<< In any event, we have shown that $\s^C$ is complete and transitive and therefore, the the @[preference_relation:thm_rep|text=representation theorem for finite sets], $\s^C$ is represented by a utility function $U: X\to \R$.