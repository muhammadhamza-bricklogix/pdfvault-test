# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing/paywall-flow.spec.ts >> Public landing — no paywall >> landing page hits the backend /billing/plans endpoint successfully
- Location: tests/billing/paywall-flow.spec.ts:48:3

# Error details

```
Error: apiRequestContext.get: connect ECONNREFUSED ::1:7403
Call log:
  - → GET http://localhost:7403/billing/plans
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.96 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br

```