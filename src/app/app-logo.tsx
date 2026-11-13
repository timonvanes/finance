// The app's own logo (the same drawing as public/icons/icon.svg), for screens that show it.
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="Finance">
      <rect width="512" height="512" rx="112" fill="#0f766e" />
      <rect x="140" y="270" width="64" height="112" rx="14" fill="#ffffff" fillOpacity="0.55" />
      <rect x="224" y="215" width="64" height="167" rx="14" fill="#ffffff" fillOpacity="0.8" />
      <rect x="308" y="160" width="64" height="222" rx="14" fill="#ffffff" />
      <circle cx="172" cy="170" r="34" fill="#fbbf24" />
    </svg>
  );
}
