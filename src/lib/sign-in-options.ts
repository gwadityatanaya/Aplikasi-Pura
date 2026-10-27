"use client";
import { useEffect, useState } from "react";

export interface SignInOptions {
  google: boolean;
  email: boolean;
  /** Development only: the sign-in link is shown on screen instead of emailed */
  emailDev: boolean;
  /** Daily digest emails can be sent (SMTP is set up) */
  digest: boolean;
}

/** What the server has set up (Google and email are both optional). null while loading. */
export function useSignInOptions() {
  const [o, setO] = useState<SignInOptions | null>(null);
  useEffect(() => {
    fetch("/api/auth/options")
      .then((r) => r.json())
      .then((j) => setO(j.ok ? j : null))
      .catch(() => {});
  }, []);
  return o;
}
