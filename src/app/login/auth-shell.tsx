import type { ReactNode } from "react";
import { AppLogo } from "../app-logo";

// The look of the login pages: dark, with the logo, like the lock screen of the app.
// It covers the whole screen, also under the phone's status bar.
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#212121] text-white">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-teal-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-8 px-6 py-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AppLogo className="h-24 w-24 drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-white/65">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
