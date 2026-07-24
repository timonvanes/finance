const BOM = "﻿";

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Leading BOM so Excel (still the most common consumer) detects UTF-8
// correctly instead of mangling accented characters.
export function toCsv(rows: string[][]): string {
  return BOM + rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}
