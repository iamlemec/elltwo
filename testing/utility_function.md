#! Utility Functions
\s:\succcurlyeq

A *utility function* is a numeric representation of preference, taking the form of a real-valued function over the set of alternatives. A utility function

$$* U: X \to \R

embodies the relative value of the elements of $X$: for $x,y \in X$, $x$ is preferred to $y$ exactly when $U(x) \geq U(y)$. Thus, every utility function defines a @[completeness:completeness|text=complete] and @[transitivity:transitivity|text=transitive] ordering over $X$.

# Interpretation of Utility

Utility functions are not directly observable. In decision theory, utility functions are often derived from more primitive objects such as [[preference_relation|preference relations]] or [[choice_correspondence|choice correspondences]].^[Nonetheless, in applied modeling, it is standard to take a utility function as given--generally under the assumption that model's agents will make choices so as to maximize their utility.] Thus, the usual interpretation is not that a decision maker actually entertains a numerical value for each alternative representing its desirability, but rather that (given restrictions on preference or choice) it is **as if** she does. That is, the DM is observationally equivalent to a DM who maximize a utility function.

Because of these considerations, utility functions are *identified* only up the choices they induce, and, in particular, a strictly monotone transformation of a utility function will yield the same observational restrictions. See @[preference_relation:mon_trans|text=this theorem].