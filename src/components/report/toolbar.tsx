"use client";

import { Icon } from "../icons";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-secondary">
      <Icon name="printer" strokeWidth={2} className="h-4 w-4" /> Print / PDF
    </button>
  );
}
