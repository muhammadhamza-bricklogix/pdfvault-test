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

## Pitfall — do NOT hex-encode the file

The file Solidgate provides is a JSON envelope that starts with the
literal characters `{"pspId":"…"}`. It is roughly 4.5 KB and ends with
`"}` (no trailing newline).

If you open it in an editor that shows it as a hex dump and then save
what the editor displays, you will end up with a ~9 KB file whose bytes
are the ASCII characters `7B 22 70 73 70 …` (i.e. two hex digits per
original byte). Solidgate's verifier compares byte-for-byte against what
Apple hands back and reports "the 2 files are still not the same".

Sanity check before commit:

    head -c 20 public/.well-known/apple-developer-merchantid-domain-association

Must print `{"pspId":"88E04631` (JSON), NOT `7B22707370496422` (hex). If
you see the hex form, run:

    xxd -r -p public/.well-known/apple-developer-merchantid-domain-association \
      > /tmp/fixed && mv /tmp/fixed public/.well-known/apple-developer-merchantid-domain-association

That reverses the double-encoding. Re-run the sanity check to confirm.
This bug was fixed on 2026-08-03 — don't reintroduce it.
