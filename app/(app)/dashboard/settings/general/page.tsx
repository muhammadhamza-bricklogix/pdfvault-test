"use client";

import { useUser } from "@clerk/nextjs";
import { UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

export default function GeneralSettingsPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <p className="text-sm text-default-500">Loading…</p>;
  }

  const created = user?.createdAt ? new Date(user.createdAt) : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-semibold text-[var(--color-foreground)]">
          General
        </h2>
        <p className="text-sm text-default-500">
          A snapshot of your profile. Edit details under{" "}
          <Link
            className="underline underline-offset-2 hover:text-[var(--color-foreground)]"
            href={ROUTES.APP.SETTINGS_ACCOUNT}
          >
            Account
          </Link>
          .
        </p>
      </header>

      <div className="flex flex-col gap-4 rounded-xl border border-default-200 bg-[var(--color-background)] p-5">
        <div className="flex items-center gap-4">
          {user?.imageUrl ? (
            <img
              alt={user.fullName ?? "Avatar"}
              className="size-16 rounded-full object-cover"
              src={user.imageUrl}
            />
          ) : (
            <HugeiconsIcon icon={UserCircleIcon} size={64} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-[var(--color-foreground)]">
              {user?.fullName ?? "User"}
            </p>
            <p className="truncate text-sm text-default-500">
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-4 border-t border-default-200 pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-default-500">
              First name
            </dt>
            <dd className="mt-1 text-sm text-[var(--color-foreground)]">
              {user?.firstName ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-default-500">
              Last name
            </dt>
            <dd className="mt-1 text-sm text-[var(--color-foreground)]">
              {user?.lastName ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-default-500">
              Email
            </dt>
            <dd className="mt-1 truncate text-sm text-[var(--color-foreground)]">
              {user?.primaryEmailAddress?.emailAddress ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-default-500">
              Member since
            </dt>
            <dd className="mt-1 text-sm text-[var(--color-foreground)]">
              {created ? created.toLocaleDateString() : "—"}
            </dd>
          </div>
        </dl>

        <div className="flex justify-end border-t border-default-200 pt-4">
          <Link
            className="inline-flex items-center justify-center rounded-md border border-default-200 px-4 py-2 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-default-100"
            href={ROUTES.APP.SETTINGS_ACCOUNT}
          >
            Edit profile
          </Link>
        </div>
      </div>
    </div>
  );
}
