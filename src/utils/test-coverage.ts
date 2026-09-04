export interface ApexCoverageRecord {
  Coverage?: string | { coveredLines?: number[]; uncoveredLines?: number[] };
}

export const getCoverageLines = (records: ApexCoverageRecord[]): { coveredLines: number[]; uncoveredLines: number[] } => {
  const coveredLines = new Set<number>()
  const uncoveredLines = new Set<number>()
  records.forEach(record => {
    const coverage = typeof record.Coverage === 'string'
      ? JSON.parse(record.Coverage)
      : record.Coverage
    coverage?.coveredLines?.forEach((line: number) => {
      if (Number.isInteger(line) && line > 0) coveredLines.add(line)
    })
    coverage?.uncoveredLines?.forEach((line: number) => {
      if (Number.isInteger(line) && line > 0) uncoveredLines.add(line)
    })
  })
  return {
    coveredLines: [...coveredLines].sort((a, b) => a - b),
    uncoveredLines: [...uncoveredLines].sort((a, b) => a - b)
  }
}
