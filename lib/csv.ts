function escapeCsvCell(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  const asString = String(value);
  if (/[",\n]/.test(asString)) {
    return `"${asString.replaceAll('"', '""')}"`;
  }

  return asString;
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [headers.join(",")];

  for (const row of rows) {
    const line = headers.map((header) => escapeCsvCell(row[header])).join(",");
    lines.push(line);
  }

  return lines.join("\n");
}
