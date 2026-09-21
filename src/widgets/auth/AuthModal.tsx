"use client";

import { useState } from "react";
import { useAuthStore } from "@/entities/auth";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";

type Mode = "SIGN_IN" | "SIGN_UP";

/**
 * Global auth modal — mounted once from the root layout, opened from
 * anywhere via `useAuthStore().openAuthModal()`. Ports fe-v3's split
 * sign-in/sign-up screens (design-reference) instead of the single
 * tabbed form this used to render.
 */
export function AuthModal() {
  const isOpen = useAuthStore((state) => state.isAuthModalOpen);
  const close = useAuthStore((state) => state.closeAuthModal);

  const [mode, setMode] = useState<Mode>("SIGN_IN");

  if (!isOpen) return null;

  const handleClose = () => {
    close();
    setMode("SIGN_IN");
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[400px] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-8 shadow-[0px_8px_24px_0px_rgba(53,65,80,0.12)]"
        onClick={(event) => event.stopPropagation()}
      >
        {mode === "SIGN_IN" ? (
          <SignInForm onSuccess={handleClose} onSwitchToSignUp={() => setMode("SIGN_UP")} />
        ) : (
          <SignUpForm onSuccess={handleClose} onSwitchToSignIn={() => setMode("SIGN_IN")} />
        )}
      </div>
    </div>
  );
}
