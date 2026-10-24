import { describe, expect, it } from "vitest";
import { CODE128, code128Modules, code128Values } from "@/lib/barcode";
import { parseAttendanceText } from "@/lib/services/punches";

describe("code 128", () => {
  it("has 107 unique symbols of 11 modules (stop = 13)", () => {
    expect(CODE128).toHaveLength(107);
    expect(new Set(CODE128).size).toBe(107);
    CODE128.slice(0, 106).forEach((p) => {
      expect(p).toHaveLength(6);
      expect([...p].reduce((s, d) => s + Number(d), 0)).toBe(11);
    });
    expect([...CODE128[106]].reduce((s, d) => s + Number(d), 0)).toBe(13);
  });
  it("bars carry an even module count and spaces an odd count (parity rule)", () => {
    CODE128.slice(0, 106).forEach((p) => {
      const bars = Number(p[0]) + Number(p[2]) + Number(p[4]);
      expect(bars % 2).toBe(0);
    });
  });
  it("computes the mod-103 checksum", () => {
    // 104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7 = 879 → 879 mod 103 = 55
    const v = code128Values("PJJ123C");
    expect(v[0]).toBe(104);
    expect(v[v.length - 2]).toBe(55);
    expect(v[v.length - 1]).toBe(106);
  });
  it("encodes digits", () => {
    expect(code128Modules("10001").reduce((s, w) => s + w, 0)).toBe(11 * 7 + 13);
  });
});

describe("punch log parsing", () => {
  it("reads ZKTeco attlog, CSV and Bangladeshi date formats", () => {
    const { punches, errors } = parseAttendanceText(
      [
        "EnrollNo,DateTime",
        "   10001\t2026-10-21 07:55:12\t1\t0\t1\t0",
        "10002,2026-10-21 17:05",
        "10003,21/10/2026,07:58",
        "10004;21-Oct-2026;7:55 PM",
        "10005 2026-10-21 08:01:00",
        "garbage line",
      ].join("\n"),
    );
    expect(punches.map((p) => [p.punchId, p.time.toISOString()])).toEqual([
      [10001, "2026-10-21T07:55:12.000Z"],
      [10002, "2026-10-21T17:05:00.000Z"],
      [10003, "2026-10-21T07:58:00.000Z"],
      [10004, "2026-10-21T19:55:00.000Z"],
      [10005, "2026-10-21T08:01:00.000Z"],
    ]);
    expect(errors).toHaveLength(1);
  });
});
