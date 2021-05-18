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

$$ C(A) = \textup{argmax}_{x \in A} \ U(x)

so that $C$ selects those elements of $A$ which maximize the utility function. 