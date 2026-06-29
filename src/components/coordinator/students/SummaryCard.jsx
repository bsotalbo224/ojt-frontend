// ─── SummaryCard ──────────────────────────────────────────────────────────────

const SummaryCard = ({ title, value, icon: Icon, colorClass, subtext, usePrimary }) => (
  <div className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow duration-200" style={{ border: `1px solid rgb(var(--primary-50))` }}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: `rgb(var(--primary-500))` }}>{title}</p>
        {usePrimary
          ? <p className="text-3xl font-bold" style={{ color: `rgb(var(--primary-800))` }}>{value}</p>
          : <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>}
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      </div>
      <div className="p-3 rounded-lg" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
        <Icon className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} />
      </div>
    </div>
  </div>
);

export default SummaryCard;