interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "left" | "center";
}

export function SectionHeading({ eyebrow, title, body, align = "left" }: SectionHeadingProps) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">{eyebrow}</p>
      <h2 className="mt-4 whitespace-pre-line font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        {title}
      </h2>
      {body ? <p className="mt-5 text-lg leading-relaxed text-muted">{body}</p> : null}
    </div>
  );
}
