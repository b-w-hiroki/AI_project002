# Sangoku route decision preview — v1.1

Issue: #250

Added a route preview that keeps existing expedition mechanics unchanged while making the fork decision readable.

At each fork the runtime now compares:
- win chance
- expected next loot
- squad fit

Fit states:
- Stable: road/default risk profile
- Squad Fit +: strategist/scout support offsets mountain danger
- High Risk: mountain chance materially trails road chance

No reward multipliers, combat probabilities, route timing, or save keys were changed.
