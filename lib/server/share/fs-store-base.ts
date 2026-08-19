import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Filesystem-backed persistence root for share metadata, bytes, passwords,
 * and the deny-list. Configurable via `SHARE_DATA_DIR`; defaults to a
 * subdirectory of the OS temp dir so a stock local dev install just works.
 *
 * The four stores in this folder (`metadata-store.ts`, `bytes-store.ts`,
 * `password.ts`, `deny-list.ts`) previously used in-memory `Map`s that
 * evaporated on every Next.js server restart / HMR reload — the recipient
 * of a share then hit `metadataStore.get(jti) === undefined` and saw
 * "This share link has expired." Filesystem persistence removes that
 * failure mode for single-instance deployments.
 *
 * Multi-instance production (Railway with >1 replica, serverless with
 * cold starts on separate workers) still needs a shared external store —
 * point `SHARE_DATA_DIR` at a mounted persistent volume, or swap the
 * implementations for a real backend (S3, KV, Postgres). The interfaces
 * are stable so caller code doesn't change.
 */
const SHARE_DATA_ROOT =
  process.env.SHARE_DATA_DIR?.trim() || join(tmpdir(), "pdfedits-share");

/** Lazily-created subdirectory paths, keyed by `subdir` name. */
const ensuredDirs = new Map<string, Promise<string>>();

async function ensureDir(subdir: string): Promise<string> {
  let existing = ensuredDirs.get(subdir);

  if (existing) return existing;

  const full = join(SHARE_DATA_ROOT, subdir);

  existing = mkdir(full, { recursive: true }).then(() => full);
  ensuredDirs.set(subdir, existing);

  return existing;
}

async function safeUnlink(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (err) {
    // ENOENT is the expected case (already deleted / never existed).
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/**
 * Write JSON atomically: write to a sibling `.tmp` then rename over the
 * target. `rename` is atomic on POSIX, so a partial write can never leave
 * a half-JSON file that a concurrent reader would choke on.
 */
async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;

  await writeFile(tmp, JSON.stringify(value));
  await rename(tmp, path);
}

async function writeBytesAtomic(
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;

  await writeFile(tmp, bytes);
  await rename(tmp, path);
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    const text = await readFile(path, "utf8");

    return JSON.parse(text) as T;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;

    if (code === "ENOENT" || code === "EISDIR") return undefined;
    // Corrupted / truncated file — treat as missing so the caller reports
    // the same "not found" UX instead of a 500. Best-effort cleanup.
    if (err instanceof SyntaxError) {
      await safeUnlink(path);

      return undefined;
    }
    throw err;
  }
}

async function readBytes(path: string): Promise<Uint8Array | undefined> {
  try {
    const buf = await readFile(path);

    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

export const shareFs = {
  ensureDir,
  readBytes,
  readJson,
  safeUnlink,
  writeBytesAtomic,
  writeJsonAtomic,
};
