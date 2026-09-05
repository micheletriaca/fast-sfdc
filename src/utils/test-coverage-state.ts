export interface TestCoverageLines {
  coveredLines: number[]
  uncoveredLines: number[]
}

export default class TestCoverageState {
  private readonly enabledDocuments = new Map<string, TestCoverageLines>()

  has (documentId: string): boolean {
    return this.enabledDocuments.has(documentId)
  }

  get (documentId: string): TestCoverageLines | undefined {
    return this.enabledDocuments.get(documentId)
  }

  enable (documentId: string, lines: TestCoverageLines): void {
    this.enabledDocuments.set(documentId, lines)
  }

  clear (documentId: string): void {
    this.enabledDocuments.delete(documentId)
  }
}
