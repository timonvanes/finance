import type { ReactNode } from "react";
import { AppLogo } from "../app-logo";

// The look of the login pages: dark, with the logo, like the lock screen of the app.
// It fills the whole screen, also under the phone's status bar, and does not scroll or
// zoom: everything is sized to fit the height of the screen.
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] h-dvh touch-none overflow-hidden overscroll-none bg-[#212121] text-white">
      {/* soft light in the corners, clipped so it can never make the page wider */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>
      <div className="relative mx-auto flex h-full w-full max-w-sm flex-col justify-center gap-[min(2rem,4dvh)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex flex-col items-center gap-3 text-center">
          <AppLogo className="h-[min(6rem,12dvh)] w-[min(6rem,12dvh)] drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]" />
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
