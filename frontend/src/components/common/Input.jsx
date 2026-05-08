const Input = ({ label, className = "", wrapperClassName = "", ...props }) => (
  <label className={`block space-y-1 ${wrapperClassName}`}>
    {label ? <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span> : null}
    <input {...props} className={`w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-400 ${className}`} />
  </label>
);

export default Input;
