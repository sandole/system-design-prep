export default function Paragraphs({
  text,
  className = "text-slate-300 leading-relaxed",
}: {
  text: string;
  className?: string;
}) {
  return (
    <>
      {text.split("\n\n").map((p, i) => (
        <p key={i} className={`${className} mb-4 last:mb-0`}>
          {p}
        </p>
      ))}
    </>
  );
}
