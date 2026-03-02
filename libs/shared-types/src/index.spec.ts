import {
  TenantStatus,
  ApiKeyStatus,
  BillingRecordStatus,
  ProviderType,
} from './index';

describe('Shared Types Enums', () => {
  describe('TenantStatus', () => {
    it('should have correct values', () => {
      expect(TenantStatus.ACTIVE).toBe('active');
      expect(TenantStatus.SUSPENDED).toBe('suspended');
    });

    it('should have defined all enum values', () => {
      const values = Object.values(TenantStatus);
      expect(values).toContain('active');
      expect(values).toContain('suspended');
    });
  });

  describe('ApiKeyStatus', () => {
    it('should have correct values', () => {
      expect(ApiKeyStatus.ACTIVE).toBe('active');
      expect(ApiKeyStatus.REVOKED).toBe('revoked');
    });
  });

  describe('BillingRecordStatus', () => {
    it('should have correct values', () => {
      expect(BillingRecordStatus.PENDING).toBe('pending');
      expect(BillingRecordStatus.COMPLETED).toBe('completed');
      expect(BillingRecordStatus.REFUNDED).toBe('refunded');
    });
  });

  describe('ProviderType', () => {
    it('should have correct provider types', () => {
      expect(ProviderType.OPENAI).toBe('openai');
      expect(ProviderType.ANTHROPIC).toBe('anthropic');
      expect(ProviderType.AZURE_OPENAI).toBe('azure_openai');
      expect(ProviderType.DEEPSEEK).toBe('deepseek');
    });
  });
});
