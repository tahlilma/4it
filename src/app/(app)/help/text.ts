import { isValidElement, type ReactNode } from "react";

/** Plain text inside a React tree (strings in children and other props) — used to index the guide for search. */
export function textOf(node: unknown, depth = 0): string {
  if (node === null || node === undefined || typeof node === "boolean" || depth > 40) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((n) => textOf(n, depth + 1)).join(" ");
  if (isValidElement(node)) {
    const props = (node.props ?? {}) as Record<string, unknown>;
    return Object.entries(props)
      .filter(([k]) => k !== "className" && k !== "href" && k !== "style" && k !== "id")
      .map(([, v]) => textOf(v as ReactNode, depth + 1))
      .join(" ");
  }
  return "";
}
