export interface TabDef {
  key: string;
  label: string;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div role="tablist" className="flex border-b border-line">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`relative flex-1 px-4 py-3 text-sm font-bold transition ${
              isActive ? "text-brand" : "text-mute hover:text-ink"
            }`}
          >
            {tab.label}
            {isActive && (
              <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-brand" />
            )}
          </button>
        );
      })}
    </div>
  );
}
