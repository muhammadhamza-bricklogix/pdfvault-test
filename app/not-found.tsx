import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-5xl font-bold tracking-tight">404</h1>
      <p className="text-lg text-default-500">
        This page doesn&apos;t exist or has been moved.
      </p>
      <Link
        className="inline-flex items-center justify-center rounded-full border px-6 py-2 text-sm font-medium transition hover:bg-default-100"
        href="/"
      >
        Go home
      </Link>
    </div>
  );
}
