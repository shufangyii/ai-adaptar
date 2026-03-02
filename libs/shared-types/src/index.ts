// Enums
export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

export enum ApiKeyStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

export enum BillingRecordStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  REFUNDED = 'refunded',
}

export enum ProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  AZURE_OPENAI = 'azure_openai',
  DEEPSEEK = 'deepseek',
}

// DTO interfaces will be added here as we develop
