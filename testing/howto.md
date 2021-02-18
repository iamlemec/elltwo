#! Axiom L2

Axiom is a project with lots of stuff going on.

# Creating Content

>>! theorem

has rank less than $m$ as a linear transformation. If $k \geq \max \{n-m+1,1\}$, then Sard's theorem asserts that the image of $X$ has measure zero as a subset of $M$. This formulation of the result follows from the version for Euclidean spaces by taking a countable set of coordinate patches. The conclusion of the theorem is a local statement, since a countable union of sets of measure zero is a set of measure zero, and the property of a subset of a coordinate patch having zero measure is invariant under diffeomorphism.

# Variants

There are many variants of this lemma, which plays a basic role in singularity theory among other fields. The case $m=1$ was proven by Anthony P. Morse in 1939, and the general case by Arthur Sard in 1942.

A version for infinite-dimensional Banach manifolds was proven by Stephen Smale.

The statement is quite powerful, and the proof involves analysis. In topology it is often quoted — as in the Brouwer fixed-point theorem and some applications in Morse theory — in order to prove the weaker corollary that “a non-constant smooth map has **at least one** regular value”.

In 1965 Sard further generalized his theorem to state that if $f \colon \ N \rightarrow M$ is $C^{k}$ for $k \geq \max \{n-m+1,1\}$ and if $A_{r} \subseteq N$ is the set of points $x \in N$ such that $df_{x}$ has rank strictly less than $r$, then the r-dimensional Hausdorff measure of $f(A_{r})$ is zero. In particular the Hausdorff dimension of $f(A_{r})$ is at most r. Caveat: The Hausdorff dimension of $f(A_{r})$ can be arbitrarily close to r.
