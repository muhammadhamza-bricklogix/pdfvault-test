// OAuth provider marks + the shared white pill styling used by the auth
// cards (login/signup). Icons are decorative; labels live on the buttons.

export const OAUTH_BUTTON_CLASS =
  "flex h-[46px] w-full items-center justify-center gap-3.5 rounded-[12px] border border-[#e1ebed] bg-white text-[16px] text-[#5f5f5f] shadow-[0_5px_12px_rgba(24,39,45,0.08)] transition-colors hover:bg-[#fafbfb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] disabled:opacity-60";

export function AppleIcon() {
  return (
    <svg
      aria-hidden
      fill="currentColor"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.9-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.85 1.41-2.92-.03-.01-2.71-1.04-2.74-4.13ZM14.53 4.42c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44Z" />
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg aria-hidden height="20" viewBox="0 0 24 24" width="20">
      <path
        d="M23.06 12.25c0-.86-.07-1.5-.22-2.16H12.24v3.92h6.19c-.12 1-.8 2.5-2.3 3.51l-.02.14 3.34 2.59.23.02c2.12-1.96 3.34-4.85 3.34-8.02Z"
        fill="#4285F4"
      />
      <path
        d="M12.24 24c3.03 0 5.57-1 7.43-2.72l-3.54-2.75c-.95.66-2.22 1.12-3.89 1.12-2.97 0-5.49-1.96-6.39-4.67l-.13.01-3.47 2.69-.05.13C4.58 21.3 8.13 24 12.24 24Z"
        fill="#34A853"
      />
      <path
        d="M5.85 14.98c-.24-.7-.37-1.45-.37-2.23s.13-1.53.36-2.23l-.01-.15-3.51-2.73-.11.05A11.99 11.99 0 0 0 0 12.75c0 1.94.46 3.77 1.29 5.4l4.56-3.17Z"
        fill="#FBBC05"
      />
      <path
        d="M12.24 4.75c2.11 0 3.53.91 4.34 1.67l3.17-3.09C17.8 1.44 15.27 0 12.24 0 8.13 0 4.58 2.7 1.29 6.35l4.55 3.4c.91-2.71 3.43-5 6.4-5Z"
        fill="#EA4335"
      />
    </svg>
  );
}
