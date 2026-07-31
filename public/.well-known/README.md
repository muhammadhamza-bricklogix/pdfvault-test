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
