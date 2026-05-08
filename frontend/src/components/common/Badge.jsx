const toneStyles = {
  neutral: "border border-zinc-700 bg-zinc-950 text-zinc-200",
  success: "border border-emerald-400/25 bg-emerald-400/15 text-emerald-200",
  warning: "border border-amber-400/25 bg-amber-400/15 text-amber-200",
  danger: "border border-rose-400/25 bg-rose-400/15 text-rose-200",
};

const Badge = ({ children, tone = "neutral" }) => (
  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneStyles[tone]}`}>
    {children}
  </span>
);

export default Badge;
