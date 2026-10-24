// Parses FormData according to a field list (used by master data and policy forms).

import { FieldErrors } from "./action";
import { parseDate } from "./dates";
import type { MasterField } from "./masters";

export function parseFields(fields: MasterField[], fd: FormData): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const raw = fd.get(f.name);
    const s = raw === null ? "" : String(raw).trim();
    switch (f.type) {
      case "text":
      case "textarea":
        if (f.required && !s) errors[f.name] = "Required";
        data[f.name] = s;
        break;
      case "number":
      case "int": {
        if (!s) {
          if (f.required) errors[f.name] = "Required";
          data[f.name] = typeof f.default === "number" ? f.default : 0;
          break;
        }
        const n = Number(s.replace(/,/g, ""));
        if (!Number.isFinite(n)) errors[f.name] = "Enter a number";
        else if (f.type === "int" && !Number.isInteger(n)) errors[f.name] = "Enter a whole number";
        else if (n < 0) errors[f.name] = "Cannot be negative";
        data[f.name] = n;
        break;
      }
      case "bool":
        data[f.name] = raw === "on" || raw === "true";
        break;
      case "select":
        if (!s) {
          if (f.required) errors[f.name] = "Required";
          data[f.name] = null;
        } else if (f.options && !f.options.some((o) => o.value === s)) errors[f.name] = "Invalid choice";
        else data[f.name] = s;
        break;
      case "ref":
        if (!s && f.required) errors[f.name] = "Required";
        data[f.name] = s ? Number(s) : null;
        break;
      case "date": {
        const d = parseDate(s);
        if (!d && (f.required || s)) errors[f.name] = "Enter a valid date";
        data[f.name] = d;
        break;
      }
      case "time": {
        if (!s && f.allowBlank) {
          data[f.name] = "";
          break;
        }
        const m = /^(\d{1,2}):(\d{2})$/.exec(s);
        if (!m || +m[1] > 23 || +m[2] > 59) errors[f.name] = "Use HH:MM (24-hour)";
        else data[f.name] = `${m[1].padStart(2, "0")}:${m[2]}`;
        break;
      }
    }
  }
  if (Object.keys(errors).length) throw new FieldErrors(errors);
  return data;
}
