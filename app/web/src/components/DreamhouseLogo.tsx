/** Inline version of the `dreamhouselogosquare` content asset. */
export function DreamhouseLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Dreamhouse logo"
    >
      <rect width="64" height="64" rx="12" fill="#86BD4A" />
      <path d="M32 14 12 32h6v18h12V38h4v12h12V32h6z" fill="#fff" />
    </svg>
  );
}
