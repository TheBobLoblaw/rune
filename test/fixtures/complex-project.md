# Complex Project Discussion

User: The project is called Heimdall. It's a monitoring dashboard.
Assistant: Good name. What's the stack?
User: Backend is Go with Chi router, frontend is Svelte with TypeScript. Database is Postgres 16.
Assistant: Solid choices. Deployment?
User: Kubernetes on AWS EKS. CI with GitHub Actions, deploy with ArgoCD.
Assistant: GitOps, nice.
User: The API runs on port 8080, health check endpoint is /healthz.
Assistant: Standard.
User: We're targeting 99.9% uptime SLA. Current response time p95 is 230ms, goal is under 100ms.
Assistant: Ambitious but doable.
User: One lesson from last project: never run migrations during peak hours. Cost us 2 hours of downtime.
Assistant: Painful lesson. Noted.
User: Budget is $2000/month for infra. We're at $1400 now.
