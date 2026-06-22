const LAYERS = [0, 1, 2, 3, 4, 5] as const;

export function ProgressiveBlur() {
  return (
    <div aria-hidden className="progressive-blur">
      {LAYERS.map((layer) => (
        <div key={layer} />
      ))}
    </div>
  );
}
