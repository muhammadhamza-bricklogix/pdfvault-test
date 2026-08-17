# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing/paywall-flow.spec.ts >> Backend security smoke >> checkout intent requires authentication
- Location: tests/billing/paywall-flow.spec.ts:72:3

# Error details

```
Error: apiRequestContext.post: connect ECONNREFUSED ::1:7403
Call log:
  - → POST http://localhost:7403/billing/checkout-intent
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.96 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - content-type: application/json
    - content-length: 37

```