type RecordTypeInfo = {
  DeveloperName: string;
  IsPersonType: boolean;
  NamespacePrefix?: string;
  SobjectType: string;
}

export const getMetadataComponentAliases = (recordTypes: RecordTypeInfo[]): Map<string, string> =>
  new Map(recordTypes
    .filter(recordType => recordType.IsPersonType)
    .map(recordType => {
      const developerName = recordType.NamespacePrefix
        ? `${recordType.NamespacePrefix}__${recordType.DeveloperName}`
        : recordType.DeveloperName
      return [
        `RecordType/${recordType.SobjectType}.${developerName}`,
        `PersonAccount.${developerName}`
      ]
    }))
