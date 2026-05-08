const variants = {
  primary: "bg-white text-zinc-900 hover:bg-zinc-100",
  ghost: "border border-zinc-600 bg-zinc-900/50 text-zinc-100 hover:bg-zinc-800",
  muted: "border border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-900",
  danger: "border border-rose-400/25 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25",
};

const Button = ({ variant = "primary", className = "", disabled, ...props }) => (
  <button
    disabled={disabled}
    className={`rounded-xl px-4 py-2 text-sm font-semibold transition duration-200 ${variants[variant]} ${className} ${
      disabled ? "cursor-not-allowed opacity-60" : ""
    }`}
    {...props}
  />
);

export default Button;
