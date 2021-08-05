#! Archimedean Axiom
\R:\mathbb{R}
\s:\succcurlyeq

The *Archimedean axiom*, for [[preference_relation|text=preferences]] over a mixture space, is a weak continuity axiom that states that no object is considered infinitely better or infinitely worse than any other object. It is the weakest continuity type conditio-n employed in the axiomatization of [[expected_utility]].

>>! axiom* [id=name=rt=Archimedean] For all $\pi,\rho,\sigma \in X$,   if  $\pi \succ \rho$ and $\rho \succ \sigma$  then  there  exist  $\alpha,\beta\in(0,1)$ such that $\alpha\pi + (1-\alpha)\sigma \succ \rho$ and $\rho \succ \beta\pi + (1-\beta)\sigma$.

For instance, let $\pi$ be the certain payoff of \$10, $\rho$ the payoff of \$0, and $\sigma$ the payoff of death by blunt force trauma. It seems reasonable that  $\pi \succ \rho$ and $\rho \succ \sigma$, so the axiom states that there must be be some $\epsilon > 0$, such that the DM is willing to risk death with probability $\epsilon$ to receive \$10 with the remaining probability: that is the risk  $(1-\epsilon)\pi + \epsilon \sigma$ is better than, $\rho$, doing nothing.

Put in these terms, the axiom may seem tenuous. Indeed, there may be outcomes so terrible that no chance of them is unacceptable, independent of the reward. Nonetheless, it seems likely most people would cross a street to pick up a \$10 bill, and thus perhaps (odd psychological framing notwithstanding), humans are more or less Archimedean. 

#[sec_cont] Relation to Other Continuity Axioms

Often axiomatizations of expected utility employ a different continuity axioms. The most common, which also does not rely of topological properties of $X$, is *mixture continuity*.

>>! axiom* [id=mixture_cont|name=rt=mixture continuity] For all $\pi,\rho,\sigma \in X$, the sets $\{\alpha \in [0,1] \mid \alpha\pi + (1-\alpha)\sigma \s \rho\}$ and $\{\beta \in [0,1] \mid \rho \s \beta\pi + (1-\beta)\sigma\}$ are closed in $\R$.

For a @[completeness:completeness|text=complete] preference relation, mixture continuity is strictly stronger than the Archimedean condition.