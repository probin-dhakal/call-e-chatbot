// eslint-disable-next-line react/prop-types -- internal-only presentational helper, not part of the public API
export const Field = ({ label, error, helper, children }) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {label}
    </label>
    {children}
    {helper && !error && (
      <p className="mt-1.5 text-xs text-slate-500">{helper}</p>
    )}
    {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
  </div>
);

// eslint-disable-next-line react-refresh/only-export-components -- small shared helper, not worth a separate file
export const inputClasses = (hasError) =>
  `w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:bg-white ${
    hasError
      ? "border-red-400 focus:border-red-500"
      : "border-slate-200 focus:border-indigo-400"
  }`;
