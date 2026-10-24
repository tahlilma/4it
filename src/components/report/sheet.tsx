import type { ReactNode } from "react";
import type { CompanyRow } from "@/lib/company";
import { stamp } from "@/lib/dates";
import { fmtValue, isNumeric, sumRows } from "@/lib/reports/format";
import type { ReportOutput, TableData } from "@/lib/reports/types";

export function Sheet({ layout = "a4p", children, className = "", last = false }: { layout?: "a4p" | "a4l" | "legall" | "auto"; children: ReactNode; className?: string; last?: boolean }) {
  return <div className={`sheet doc ${layout} ${last ? "" : "page-break"} ${className}`}>{children}</div>;
}

export function CompanyHeader({ company, title, titleBn, subtitle, bn = false }: { company: CompanyRow; title?: ReactNode; titleBn?: string; subtitle?: ReactNode; bn?: boolean }) {
  return (
    <div className="mb-3 text-center">
      <div className={`text-lg font-bold ${bn ? "font-bn" : ""}`}>{bn ? company.nameBn || company.nameEn : company.nameEn}</div>
      <div className={`text-[11px] ${bn ? "font-bn" : ""}`}>{bn ? company.addressBn || company.addressEn : company.addressEn}</div>
      {title && <div className="mt-1.5 text-[14px] font-semibold underline underline-offset-4">{title}</div>}
      {titleBn && <div className="font-bn text-[13px] font-semibold">{titleBn}</div>}
      {subtitle && <div className="mt-0.5 text-[11px]">{subtitle}</div>}
    </div>
  );
}

export function Signatures({ labels }: { labels: string[] }) {
  return (
    <div className="avoid-break mt-12 flex justify-between gap-6 px-4">
      {labels.map((l) => (
        <div key={l} className="min-w-28 flex-1 border-t border-black pt-1 text-center text-[11px]">
          {l}
        </div>
      ))}
    </div>
  );
}

export function TableView({ t }: { t: TableData }) {
  const cols = t.columns;
  const span = cols.length + (t.serial ? 1 : 0);
  const totalCols = cols.some((c) => c.total);
  const all = t.groups.flatMap((g) => g.rows);
  let sl = 0;
  const totalRow = (rows: typeof all, label: string, strong: boolean) => {
    const s = sumRows(rows, cols);
    const firstNum = cols.findIndex((c) => c.total);
    return (
      <tr className={strong ? "bg-neutral-200 font-bold" : "bg-neutral-100 font-semibold"}>
        <td colSpan={(t.serial ? 1 : 0) + Math.max(1, firstNum)} className="text-right">
          {label} ({rows.length})
        </td>
        {cols.slice(Math.max(1, firstNum)).map((c) => (
          <td key={c.key} className={isNumeric(c) ? "num" : ""}>
            {c.total ? fmtValue(s[c.key], c.fmt) : ""}
          </td>
        ))}
      </tr>
    );
  };
  return (
    <table className="dt">
      <thead>
        <tr>
          {t.serial && <th>SL</th>}
          {cols.map((c) => (
            <th key={c.key} className={c.bn ? "font-bn" : ""}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {t.groups.map((g, gi) => (
          <GroupRows key={gi}>
            {g.title && (
              <tr>
                <td colSpan={span} className="bg-neutral-50 font-semibold">
                  {g.title}
                </td>
              </tr>
            )}
            {g.rows.map((r, ri) => {
              sl++;
              return (
                <tr key={ri}>
                  {t.serial && <td className="center">{sl}</td>}
                  {cols.map((c) => (
                    <td key={c.key} className={`${isNumeric(c) ? "num" : c.align === "center" ? "center" : ""} ${c.bn ? "font-bn" : ""} ${c.className ?? ""}`}>
                      {fmtValue(r[c.key], c.fmt)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {t.subtotals && totalCols && t.groups.length > 1 && g.rows.length > 0 && totalRow(g.rows, "Subtotal", false)}
          </GroupRows>
        ))}
        {(t.grandTotal ?? totalCols) && all.length > 0 && totalCols && totalRow(all, "Grand total", true)}
      </tbody>
    </table>
  );
}

function GroupRows({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function ReportSheet({ out, company, printedBy, tz }: { out: ReportOutput; company: CompanyRow; printedBy: string; tz: number }) {
  return (
    <Sheet layout={out.layout ?? "a4p"} last>
      <CompanyHeader company={company} title={out.title} titleBn={out.titleBn} subtitle={out.subtitle} />
      {out.table && <TableView t={out.table} />}
      {out.table?.notes && (
        <ul className="mt-2 list-disc pl-5 text-[10px] text-neutral-700">
          {out.table.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {out.signatures && <Signatures labels={out.signatures} />}
      <div className="mt-4 flex justify-between text-[9px] text-neutral-500">
        <span>Printed {stamp(new Date(), tz)} by {printedBy}</span>
        <span>{company.nameEn} · HR & Payroll</span>
      </div>
    </Sheet>
  );
}
