export function TrustBar() {
  const items = [
    'Price Match Guarantee',
    'Fast Shipping',
    'All Original Manufacturer Parts',
    '1 Year Warranty',
  ];
  return (
    <div className="border-b border-gray-200 bg-gray-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-1 px-4 py-2 text-xs font-medium text-brand-ink/80 sm:justify-between">
        {items.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#347778" strokeWidth="2.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12l3 3 5-6" />
            </svg>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
