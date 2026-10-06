/** The `dreamhouselogosquare` content asset, copied 1:1 to public/dreamhouse-logo-square.png. */
export function DreamhouseLogo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/dreamhouse-logo-square.png"
      width={size}
      height={size}
      alt="Dreamhouse logo"
      style={{ borderRadius: size / 5, display: 'block' }}
    />
  );
}
