export function parseProductSearch(value) {
  const match = value.trim().match(/^(\d+)\s*\*\s*(.*)$/)
  if (!match) return { quantity: 1, query: value.trim() }

  return { quantity: Math.max(1, Number(match[1])), query: match[2].trim() }
}