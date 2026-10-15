---
title: "About"
layout: "single"
ShowToc: false
ShowReadingTime: false
---

<div class="about-card"><img src="/images/me.jpg" alt="Hide"><span class="about-name">Hide</span></div>

One of the largest Istio deployments in the world runs across my desk. This is where I write down what it breaks.

I came up through the wire: network and VoIP engineering, where a dropped packet is a dropped phone call and you learn to read a tcpdump the way other people read logs. I took that into startups, building the infrastructure for products that had not yet earned the right to go down, and then into platform engineering at one of the world's largest e-commerce companies.

Today my team owns the service mesh for well over a thousand Kubernetes clusters, more than 600 of them production, spread across North America, Asia and Europe. Tens of thousands of services route through Envoy sidecars and gateways we operate, on top of a control plane and service registry we build ourselves. When something only breaks at that scale, it lands on my desk.

That is what this blog is about. Not tutorials, not "ten tips", but the actual incidents: HTTP/2 clients that violate the spec in ways nothing warns you about, two control planes quietly fighting over the same object, source IPs that vanish at the load balancer, and the cost of running all of it. Each post is a root-cause analysis written up after the fact, with the dead ends left in, because the dead ends are where the learning is.

Opinions are my own. Incidents are real; names and numbers are anonymized.

Find me on [LinkedIn](https://www.linkedin.com/in/hidetomo-morimoto-41b1168/).
