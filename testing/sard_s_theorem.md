#! Sard's Theorem

In mathematics, Sard's theorem, also known as Sard's lemma or the Morse–Sard theorem, is a result in mathematical analysis that asserts that the set of critical values (that is, the image of the set of critical points) of a smooth function f from one Euclidean space or manifold to another is a null set, i.e., it has Lebesgue measure 0. This makes the set of critical values "small" in the sense of a generic property. The theorem is named for Anthony Morse and Arthur Sard.

# Statement

More explicitly, let

$$* f \colon \ \mathbb{R}^{n} \rightarrow \mathbb{R}^{m}

be $C^{k}$ (that is, $k$ times continuously differentiable), where $k \geq \max \{n-m+1,1\}$. Let $X$ denote the *critical set* of $f$, which is the set of points $x \in \mathbb{R}^{n}$ at which the Jacobian matrix of $f$ has rank $< m$. Then the image $f(X)$ has Lebesgue measure 0 in $\mathbb{R}^{m}$.

Intuitively speaking, this means that although $X$ may be large, its image must be small in the sense of Lebesgue measure: while $f$ may have many critical points in the domain $\mathbb{R}^{n}$, it must have few critical values in the image $\mathbb{R}^{m}$.

More generally, the result also holds for mappings between differentiable manifolds $M$ and $N$ of dimensions $m$ and $n$, respectively. The critical set $X$ of a $C^{k}$ function

$$* f \colon \ N \rightarrow M

consists of those points at which the differential

$$* df \colon \ TN \rightarrow TM

has rank less than $m$ as a linear transformation. If $k \geq \max \{n-m+1,1\}$, then Sard's theorem asserts that the image of $X$ has measure zero as a subset of $M$. This formulation of the result follows from the version for Euclidean spaces by taking a countable set of coordinate patches. The conclusion of the theorem is a local statement, since a countable union of sets of measure zero is a set of measure zero, and the property of a subset of a coordinate patch having zero measure is invariant under diffeomorphism.

# Variants

There are many variants of this lemma, which plays a basic role in singularity theory among other fields. The case $m=1$ was proven by Anthony P. Morse in 1939, and the general case by Arthur Sard in 1942.

A version for infinite-dimensional Banach manifolds was proven by Stephen Smale.

The statement is quite powerful, and the proof involves analysis. In topology it is often quoted — as in the Brouwer fixed-point theorem and some applications in Morse theory — in order to prove the weaker corollary that “a non-constant smooth map has **at least one** regular value”.

In 1965 Sard further generalized his theorem to state that if $f \colon \ N \rightarrow M$ is $C^{k}$ for $k \geq \max \{n-m+1,1\}$ and if $A_{r} \subseteq N$ is the set of points $x \in N$ such that $df_{x}$ has rank strictly less than $r$, then the r-dimensional Hausdorff measure of $f(A_{r})$ is zero. In particular the Hausdorff dimension of $f(A_{r})$ is at most r. Caveat: The Hausdorff dimension of $f(A_{r})$ can be arbitrarily close to r.