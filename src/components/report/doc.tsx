// Building blocks for printed letters and statutory forms (mostly in Bangla).

import type { ReactNode } from "react";
import { bn } from "@/lib/bangla";
import type { CompanyRow } from "@/lib/company";

type AddrSrc = {
  presVillageBn: string; presPostBn: string; presThanaBn: string; presDistrictBn: string;
  permVillageBn: string; permPostBn: string; permThanaBn: string; permDistrictBn: string;
  presVillageEn: string; presPostEn: string; presThanaEn: string; presDistrictEn: string;
  permVillageEn: string; permPostEn: string; permThanaEn: string; permDistrictEn: string;
};

export function bnAddress(e: AddrSrc, which: "pres" | "perm"): string {
  const v = which === "pres" ? [e.presVillageBn, e.presPostBn, e.presThanaBn, e.presDistrictBn] : [e.permVillageBn, e.permPostBn, e.permThanaBn, e.permDistrictBn];
  const en = which === "pres" ? [e.presVillageEn, e.presPostEn, e.presThanaEn, e.presDistrictEn] : [e.permVillageEn, e.permPostEn, e.permThanaEn, e.permDistrictEn];
  const parts = v.map((x, i) => x || en[i]);
  const labels = ["গ্রামঃ ", "পোঃ ", "থানাঃ ", "জেলাঃ "];
  return bn(parts.map((x, i) => (x ? `${labels[i]}${x}` : "")).filter(Boolean).join(", "));
}

export function enAddress(e: AddrSrc, which: "pres" | "perm"): string {
  const v = which === "pres" ? [e.presVillageEn, e.presPostEn, e.presThanaEn, e.presDistrictEn] : [e.permVillageEn, e.permPostEn, e.permThanaEn, e.permDistrictEn];
  const labels = ["", "PO: ", "PS: ", "Dist: "];
  return v.map((x, i) => (x ? `${labels[i]}${x}` : "")).filter(Boolean).join(", ");
}

/** Bangla letterhead: company name, address and an optional passport-photo box. */
export function BnLetterHead({ company, photo, photoSrc, subtitle }: { company: CompanyRow; photo?: boolean; photoSrc?: string | null; subtitle?: ReactNode }) {
  return (
    <div className="relative mb-4 flex items-start justify-center font-bn">
      <div className="text-center">
        <div className="text-[20px] font-bold leading-tight">{company.nameBn || company.nameEn}</div>
        <div className="text-[12px]">{company.addressBn || company.addressEn}</div>
        {subtitle && <div className="mt-2">{subtitle}</div>}
      </div>
      {photo && (
        <div className="absolute right-0 top-0">
          <PhotoBox src={photoSrc} />
        </div>
      )}
    </div>
  );
}

export function EnLetterHead({ company, subtitle }: { company: CompanyRow; subtitle?: ReactNode }) {
  return (
    <div className="mb-4 border-b border-black pb-2 text-center">
      <div className="text-[19px] font-bold">{company.nameEn}</div>
      <div className="text-[12px]">{company.addressEn}</div>
      {subtitle && <div className="mt-1">{subtitle}</div>}
    </div>
  );
}

export function PhotoBox({ src, label = "ছবি", w = 25, h = 30 }: { src?: string | null; label?: string; w?: number; h?: number }) {
  return (
    <div className="flex flex-col items-center font-bn">
      <div className="flex items-center justify-center overflow-hidden border border-black bg-white" style={{ width: `${w}mm`, height: `${h}mm` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="mt-0.5 text-[11px]">{label}</div>
    </div>
  );
}

export function Boxed({ children }: { children: ReactNode }) {
  return <span className="inline-block border border-black px-3 py-0.5 font-semibold">{children}</span>;
}

/** Numbered "label : value" lines used on Bangla forms. */
export function FieldLines({ items, labelWidth = "45mm" }: { items: [ReactNode, ReactNode][]; labelWidth?: string }) {
  return (
    <table className="w-full font-bn text-[13px]">
      <tbody>
        {items.map(([k, v], i) => (
          <tr key={i}>
            <td className="py-[3px] align-top" style={{ width: labelWidth }}>
              {k}
            </td>
            <td className="w-4 py-[3px] align-top">:</td>
            <td className="py-[3px] align-top">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SigBlock({ left, right, center }: { left?: ReactNode; right?: ReactNode; center?: ReactNode }) {
  return (
    <div className="avoid-break mt-14 flex items-end justify-between gap-6 font-bn text-[12px]">
      <div className="min-w-48 text-center">{left && <div className="border-t border-black pt-1">{left}</div>}</div>
      {center !== undefined && <div className="min-w-40 text-center">{center && <div className="border-t border-black pt-1">{center}</div>}</div>}
      <div className="min-w-48 text-center">{right && <div className="border-t border-black pt-1">{right}</div>}</div>
    </div>
  );
}
