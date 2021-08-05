#! Completeness

The *completeness axiom* for [[preference_relation|text=preference relations]] states that any two objects can be compared. Being a necessary condition for a relation to be represented by a utility function, it is widely employed and stands as one of the fundamental axioms of rationality. Nonetheless, there is a large interest in understanding decision theory without completeness.

>>! axiom* [completeness|name=rt=completeness] A binary relation $\succcurlyeq$ over a set $X$ is *complete* if for all $x,y \in X$, either $x \succcurlyeq y$ or $y \succcurlyeq x$.

Completeness is an property of weak preferences: A decision maker who has complete preferences can make a decision between two alternatives, including  the possibility of indifference.

When completeness is not met, then there are some alternatives that are *incomparable*. The difference between incomparably and indifference is subtle but generally boils down to a condition on the knowledge of the decision maker: with the later, the decision maker knows she will receive the same utility from the consumption of $x$ or $y$, where as with incomparability, the decision maker does not know her preference between $x$ or $y$. This could stem from a lack of information, or because no preference exists.

As such, completeness is often relaxed in environments where complete knowledge of preference is implausible, for example with complicated choice objects, under probabilistic uncertainty, or under unawareness.