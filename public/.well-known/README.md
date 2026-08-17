# .well-known

Files here are served under `https://<domain>/.well-known/…` by Next.js
straight from the `public/` folder. Clerk middleware is configured in
`proxy.ts` to skip this path (matcher excludes `\.well-known`), so no
redirect wraps requests to it.

## Apple Pay domain verification

Filename (no extension, exact name required by Apple):

    apple-developer-merchantid-domain-association

### Canonical source (single source of truth)

Solidgate's aggregator publishes ONE file that every merchant under their
umbrella must host verbatim:

    https://cdn.solidgate.com/apple/apple-developer-merchantid-domain-association.txt

Documented at <https://docs.solidgate.com/payments/integrate/payment-form/apple-pay-button/>.
To refresh our copy:

    curl -s https://cdn.solidgate.com/apple/apple-developer-merchantid-domain-association.txt \
      > public/.well-known/apple-developer-merchantid-domain-association

Expected bytes (verify BEFORE committing):

- Exactly **9118 bytes**, no trailing newline
- MD5 `022ab7b28e7cb3ea45d82c3f69b62dc0` (as of 2021-10-27 — Solidgate rarely rotates)
- First 20 chars: `7B22707370496422223A22` (uppercase ASCII hex)

Do NOT transcribe this file by hand from a support-ticket message. Do NOT
edit it in place. Do NOT `xxd -r -p` (decode) it. Any of those has already
bitten us — see spec `.claude/specs/2026-08-03-apple-pay-diagnostic.md`.
Always re-`curl` from the CDN.

### Format explanation

The file's bytes are the UPPERCASE ASCII hex representation of an
underlying signed JSON envelope `{"pspId":"...","version":1,"createdOn":...,"signature":"..."}`.
Solidgate's verifier fetches the file, byte-compares against their
internal copy (also hex-encoded), then decodes before forwarding to
Apple. Hosting the raw-JSON decoded form fails Solidgate's byte-compare
even though the content is equivalent.

### Verification steps

1. Solidgate Hub → Developers → Apple Pay → Domains → Add domain.
2. Confirm the copy in this repo matches the CDN (`md5` above).
3. Deploy. `curl -sI` the domain — expect `HTTP/2 200`, `content-type: text/plain`, `content-length: 9118`.
4. Back in Solidgate Hub, click "Verify domain".
5. Repeat per env (staging + prod both need to be added in Solidgate Hub).

`next.config.mjs` sets `text/plain` on requests to this path — Solidgate/Apple
silently reject any other content-type.
