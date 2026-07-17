"use client";

import { useUser } from "@clerk/nextjs";
import { Mail01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";

import {
  PvFormRow,
  PvSectionHeading,
} from "@/components/sections/dashboard/settings/pv-settings-primitives";
import { PvPhotoUpload } from "@/components/sections/dashboard/settings/pv-photo-upload";
import { PvTextField } from "@/components/sections/dashboard/settings/pv-text-field";
import { toast } from "@/lib/shared/utils/toast";

/**
 * General tab — Personal info from Frame 2043684300. Rows are wired to
 * Clerk so edits actually save:
 *   - Photo   → `user.setProfileImage({ file })`
 *   - Name    → `user.update({ firstName, lastName })` (Save button
 *               appears once either field is dirty)
 *   - Email   → read-only here per the design; edits belong under Account
 *   - Member  → derived from `user.createdAt`, DD-MM-YYYY
 */
export default function GeneralSettingsPage() {
  const { user, isLoaded } = useUser();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFirstName(user?.firstName ?? "");

    setLastName(user?.lastName ?? "");
  }, [user?.firstName, user?.lastName]);

  if (!isLoaded) {
    return <p className="py-6 text-sm text-[var(--pv-text-muted)]">Loading…</p>;
  }

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const created = user?.createdAt ? new Date(user.createdAt) : null;
  const memberSince = created
    ? `${String(created.getDate()).padStart(2, "0")}-${String(
        created.getMonth() + 1,
      ).padStart(2, "0")}-${created.getFullYear()}`
    : "";

  const nameDirty =
    (user?.firstName ?? "") !== firstName ||
    (user?.lastName ?? "") !== lastName;

  const saveName = async () => {
    if (!user || !nameDirty) return;
    setSavingName(true);
    try {
      await user.update({ firstName, lastName });
      toast.success({ title: "Name updated" });
    } catch (err) {
      toast.error({
        title: "Couldn't update name",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingName(false);
    }
  };

  const savePhoto = async (file: File) => {
    if (!user) return;
    setSavingPhoto(true);
    try {
      await user.setProfileImage({ file });
      toast.success({ title: "Profile photo updated" });
    } catch (err) {
      toast.error({
        title: "Couldn't update photo",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingPhoto(false);
    }
  };

  return (
    <section>
      <PvSectionHeading
        description="You can setup your account, password and billing"
        title="Personal info"
      />

      <PvFormRow
        helpTip
        required
        description="This will be displayed on your profile."
        label="Your photo"
      >
        <PvPhotoUpload
          currentUrl={user?.imageUrl ?? null}
          onFileSelected={savePhoto}
        />
        {savingPhoto ? (
          <p className="mt-2 text-[12px] text-[var(--pv-text-muted)]">
            Uploading…
          </p>
        ) : null}
      </PvFormRow>

      <PvFormRow
        required
        description="The name shown across PDFVault and in the header of your saved PDFs."
        label="Name"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PvTextField
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <PvTextField
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        {nameDirty ? (
          <button
            className="mt-3 inline-flex h-9 items-center rounded-full bg-[var(--pv-brand-red)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--pv-brand-red-hover)] disabled:opacity-60"
            disabled={savingName || firstName.trim().length === 0}
            type="button"
            onClick={() => void saveName()}
          >
            {savingName ? "Saving…" : "Save name"}
          </button>
        ) : null}
      </PvFormRow>

      <PvFormRow
        required
        description="Change your email under Account."
        label="Email address"
      >
        <PvTextField
          disabled
          leadingIcon={Mail01Icon}
          type="email"
          value={email}
        />
      </PvFormRow>

      <PvFormRow
        last
        description="When you created your PDFVault account."
        label="Member Since"
      >
        <PvTextField disabled value={memberSince} />
      </PvFormRow>
    </section>
  );
}
