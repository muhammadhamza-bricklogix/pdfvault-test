# .well-known

Files here are served under `https://<domain>/.well-known/…` by Next.js
straight from the `public/` folder. Clerk middleware is configured in
`proxy.ts` to skip this path (matcher excludes `\.well-known`), so no
redirect wraps requests to it.

## Apple Pay domain verification

Filename (no extension, exact name required by Apple):

    apple-developer-merchantid-domain-association

To generate:

1. Solidgate Hub → Developers → Apple Pay → Domains → Add domain.
2. Solidgate returns a domain-association file. Download it.
3. Drop it in this folder as `apple-developer-merchantid-domain-association`
   (rename if the download adds a `.txt` suffix — Apple Pay explicitly
   rejects the `.txt` variant per Solidgate docs).
4. Deploy. Verify with:

       curl -sI https://pdfvault.ai/.well-known/apple-developer-merchantid-domain-association
       # expect: HTTP/2 200 + content-type: text/plain

5. Back in Solidgate Hub, click "Verify domain". Apple Pay button will
   start rendering once verification passes.

Repeat per env (staging domain needs its own verification).

`next.config.ts` sets `text/plain` on requests to this path — required
by Solidgate/Apple; without it Apple silently rejects the file.

## Format — hex-encoded ASCII, 9118 bytes exact

Solidgate's aggregator hands you a file whose bytes are the UPPERCASE
ASCII hex representation of the underlying signed JSON. It starts with
the literal characters `7B 22 70 73 70 49 64 22 3A 22 …` (i.e. `"7B22707370496422…"`
when read as text) — NOT with the literal `{`.

This looks like a "double-encoded" mistake but it is intentional.
Solidgate's verifier fetches the file, byte-compares it against the
copy in their internal store (which is also hex-encoded), then decodes
before forwarding to Apple. If you save the raw-JSON decoded form,
Solidgate's byte-compare fails with "the 2 files are still not the
same" — even though the underlying content is equivalent. Do not
`xxd -r -p` this file.

Sanity check before commit:

    head -c 20 public/.well-known/apple-developer-merchantid-domain-association

Must print `7B22707370496422223A22` (ASCII hex, uppercase). If it prints
literal `{"pspId":"88E04631` instead, you accidentally decoded the file —
re-encode with:

    xxd -p -c 999999 public/.well-known/apple-developer-merchantid-domain-association \
      | tr 'a-z' 'A-Z' | tr -d '\n' > /tmp/fixed \
      && mv /tmp/fixed public/.well-known/apple-developer-merchantid-domain-association

Expected size: exactly 9118 bytes, no trailing newline. See spec
`.claude/specs/2026-08-03-apple-pay-diagnostic.md` for the incident
trail — we flipped this format twice in one day before Solidgate
clarified which side they want.
