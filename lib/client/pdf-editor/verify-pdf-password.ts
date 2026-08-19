import { loadPdfJs } from "./load-pdfjs";
import { PDFJS_WORKER_SRC } from "./pdfjs-worker";

export type VerifyPasswordResult =
  | { status: "ok" }
  | { status: "not-encrypted" }
  | { status: "incorrect-password" }
  | { status: "load-failed"; error: unknown };

// pdf.js PasswordResponses.INCORRECT_PASSWORD === 2 (NEED_PASSWORD === 1).
const INCORRECT_PASSWORD_CODE = 2;

/**
 * Client-side check that `password` really unlocks `file` before we hand
 * the bytes to the decrypt endpoint. This is a security requirement — the
 * remove-password flow otherwise trusts whatever the caller submits.
 *
 * Runs two passes:
 *   1. Load without a password. If it succeeds the file isn't encrypted.
 *   2. Load with the supplied password. If pdf.js throws
 *      PasswordException/INCORRECT_PASSWORD the password is wrong.
 */
export async function verifyPdfPassword(
  file: File,
  password: string,
): Promise<VerifyPasswordResult> {
  const pdfjs = await loadPdfJs();

  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

  const source = await file.arrayBuffer();

  try {
    const task = pdfjs.getDocument({ data: source.slice(0) });
    const doc = await task.promise;

    doc.destroy();

    return { status: "not-encrypted" };
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;

    if (name !== "PasswordException") {
      return { status: "load-failed", error: err };
    }
  }

  try {
    const task = pdfjs.getDocument({ data: source.slice(0), password });
    const doc = await task.promise;

    doc.destroy();

    return { status: "ok" };
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    const code = (err as { code?: number } | null)?.code;

    if (name === "PasswordException" && code === INCORRECT_PASSWORD_CODE) {
      return { status: "incorrect-password" };
    }
    if (name === "PasswordException") {
      return { status: "incorrect-password" };
    }

    return { status: "load-failed", error: err };
  }
}
