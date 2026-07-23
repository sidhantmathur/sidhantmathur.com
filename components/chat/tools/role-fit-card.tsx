// RoleFitCard (04 §2.3). Mono "Fit for: {role}" label, then a list of rows
// (area in Sans medium, evidence in Sans --ink-soft below it, hairline divider
// between rows — same rhythm as the experience-table row pattern). Optional
// caveats render last in a hairline-topped block.
//
// Shape matches the roleFit tool's execute() return value. All content here is
// model-generated (grounded via the system prompt); this component only lays
// it out.
export type RoleFitCardData = {
  role: string;
  matches: { area: string; evidence: string }[];
  caveats?: string;
};

export function RoleFitCard({ data }: { data: RoleFitCardData }) {
  return (
    <div className="border border-ink bg-paper p-5">
      <span className="font-mono text-xs text-muted">Fit for: {data.role}</span>

      <div className="mt-4 border-t border-ink">
        {data.matches.map((m, i) => (
          <div
            key={`${m.area}-${i}`}
            className={i > 0 ? "border-t border-hairline" : ""}
          >
            <p className="pt-3 text-[15px] font-medium leading-snug text-ink">
              {m.area}
            </p>
            <p className="mb-3 mt-1 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft">
              {m.evidence}
            </p>
          </div>
        ))}
      </div>

      {data.caveats && (
        <div className="mt-4 border-t border-hairline pt-3">
          <span className="font-mono text-xs text-muted">Worth noting</span>
          <p className="mt-1 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft">
            {data.caveats}
          </p>
        </div>
      )}
    </div>
  );
}
