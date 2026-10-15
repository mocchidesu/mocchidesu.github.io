---
title: "When Two Istio Revisions Fight Over the Same ServiceEntry"
date: 2026-10-15
draft: true
tags: ["istio", "envoy", "kubernetes", "service-mesh", "rca"]
summary: "A canary upgrade of a mesh-config controller produced intermittent 503 UH with nothing obviously wrong. The root cause was an ownership problem the Istio revision model never promises to solve for you."
---

Istio's revision model is well documented for the two things it was built for: running two control planes side by side, and moving sidecars from one to the other. What it does *not* cover is everything else in your cluster that writes mesh configuration. If you have a controller that generates ServiceEntries and DestinationRules, and you run two copies of it during a canary, you have a second thing to upgrade and the revision model will not protect you.

This is the story of how that bit us, what the failure looked like from the outside, and the two small changes that fixed it.

## The setup

We run Istio across several hundred production clusters. On top of it sits an in-house controller, call it the *mesh config controller*, that takes a service-registry model (who talks to whom, in which environment, with which failover policy) and renders it into Istio objects: VirtualServices, ServiceEntries, DestinationRules and a handful of EnvoyFilters.

The controller is revision-aware in the same way istiod is. We deploy it in two colours, `blue` and `green`. Each colour labels the objects it creates with `istio.io/rev: <colour>`, so each istiod only reads the configuration produced by its own controller. Upgrading means standing up the new colour, letting it render, moving workloads over, and tearing the old colour down.

To make that safe, the object *names* are also suffixed by colour: `my-route-green`, `my-route-blue`. Two colours, two sets of objects, no overlap. That has been the rule for years and it has worked.

Until one feature forgot the rule.

## The symptom

On a staging cluster, a consumer service started getting `503` from a provider it had been calling happily for months. Envoy's response flag was `UH`: *no healthy upstream*. Roughly 1,700 failures per pod over about ten hours, then it stopped on its own.

The timeline was suspicious from the start:

- Failures began at 03:48Z. A second copy of the mesh config controller, the `blue` canary, had been created at 03:46Z.
- Failures stopped at 14:15Z. That is the minute `blue` was scaled to zero.

So the canary was involved. But the canary was not supposed to touch anything `green` owned, and nothing was being deleted. The objects were all still there.

## What `UH` was telling us

The important detail is `UH` rather than `NC` (no cluster). `NC` would mean Envoy had no cluster at all for the destination. `UH` means the cluster exists but has no healthy endpoints.

The provider in question uses a failover topology: traffic goes to a primary slice, and falls back to a base environment if the primary is unavailable. The controller renders this as an Envoy *aggregate cluster* (via an EnvoyFilter) whose members are two plain clusters, each backed by its own ServiceEntry and DestinationRule subset.

`UH` on an aggregate cluster means the aggregate is there but its member clusters are not. The EnvoyFilter had survived. The ServiceEntries and DestinationRules behind it had not, at least not as far as `green` istiod was concerned.

## The fight

Pulling the ServiceEntry out of the cluster showed something odd:

```
metadata:
  generation: 1
  labels:
    istio.io/rev: blue
```

A few seconds later:

```
metadata:
  generation: 1
  labels:
    istio.io/rev: green
```

Generation never moved. The spec never changed. Only the labels were flapping, every few seconds, between `blue` and `green`.

Here is what was happening:

1. The failover feature (added some months earlier) names its member ServiceEntry and DestinationRule after the upstream cluster and workload only. **No colour suffix.** Both controllers compute the same name.
2. Each controller's reconcile loop compares the live object with what it wants. The spec matches. The labels do not, because the other colour was there last. The controller "fixes" the labels and moves on.
3. istiod filters every config object by `istio.io/rev`. While the object says `blue`, `green` istiod drops it. The member clusters disappear from the `green` sidecars' CDS; the aggregate cluster, whose EnvoyFilter *was* correctly suffixed, stays.
4. A request arrives. The aggregate has zero healthy members. `503 UH`.
5. The `green` controller takes the label back. Endpoints return. A few seconds later `blue` takes it again.

From the application's point of view this looked like a provider that was flapping between healthy and dead several times a minute, with nothing in the provider's own logs to explain it.

Note what did *not* help: nothing was ever deleted, nothing was ever rejected by the webhook, and `kubectl get` at any instant showed a perfectly valid object. The bug only exists in the time dimension.

## Why nobody noticed earlier

The feature had been in production for six months. It had never been exercised during a canary of the controller itself, and the controller is upgraded far less often than the applications it serves. The first time two colours ran with this feature enabled on a cluster that used failover, it broke.

There is a broader lesson in that. A revision-aware system is only as revision-aware as its least careful code path, and the easiest way to find the careless one is to actually run two revisions with every feature turned on. We now do that in a lab cluster as a standard pre-release step.

## The fix

Two changes, and we wanted both.

**Put the colour back in the name.** The member ServiceEntry and DestinationRule now carry the revision suffix like everything else. This is the "correct" fix: two colours, two objects, no shared state. It needs a migration, because renaming an object means the old name must be deleted after the new one is live, so we used the same deferred-delete pattern the controller already uses for other renames.

**Refuse to overwrite another revision's object.** Independently, the reconcile loop now checks `istio.io/rev` before updating. If the object is labelled with a revision other than its own, it leaves it alone and logs a warning. This is the belt to the first change's braces. The name fix prevents this class of bug for the paths we know about; the ownership guard catches the ones we do not know about yet, and turns a silent flap into a visible log line.

The ownership guard is the one I would recommend to anyone writing a controller that emits Istio config, regardless of whether you have a naming problem today. It is a few lines and it converts a time-dimension bug into a point-in-time one.

## Debugging recipe

If you run Istio with revisions and something between you and istiod generates configuration, here is what to check when you see unexplained `UH`:

1. **Response flag.** `UH` with an aggregate or multi-subset cluster suggests members have vanished, not the whole cluster.
2. **Generation versus timestamps.** An object whose `generation` is stuck at a low number but whose `managedFields` or `resourceVersion` keeps changing is being rewritten without a spec change. That is almost always a label or annotation fight.
3. **Watch the `istio.io/rev` label.** `kubectl get se <name> -w -o jsonpath='{.metadata.labels.istio\.io/rev}{"\n"}'` makes the flap obvious in seconds.
4. **Compare what each istiod sees.** `istioctl proxy-config cluster <pod> --revision <rev>` from each side; the one that is missing the member clusters is the one losing the fight.
5. **Correlate with controller lifecycle events.** Creation and scale-down of a second controller colour bracketing the incident is the tell.

## Takeaways

- Istio's revision label decides **who reads** an object. It says nothing about **who writes** it. If you have more than one writer, that is your problem to solve.
- Any object your controller emits needs the revision in its *name*, not just its labels. Labels can be overwritten; names cannot collide.
- Add an ownership guard anyway. It is cheap and it makes the next naming mistake loud instead of silent.
- Run two revisions of *everything* in the control path, with every feature enabled, before you do it in production.

The Istio upgrade guide will tell you how to canary istiod. It will not tell you how to canary the things you built on top of it. That part is on you.
