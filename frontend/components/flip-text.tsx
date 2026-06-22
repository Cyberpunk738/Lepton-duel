interface FlipTextProps {
  word: string;
  baseClassName: string;
  revealClassName: string;
}

export function FlipText({ word, baseClassName, revealClassName }: FlipTextProps) {
  return (
    <span className="flip-word">
      {Array.from(word).map((char, index) => (
        <span key={`${char}-${index}`}>
          <span className={`flip-base ${baseClassName}`}>{char}</span>
          <span className={`flip-reveal ${revealClassName}`} aria-hidden>
            {char}
          </span>
        </span>
      ))}
    </span>
  );
}
