import { useCallback, useState } from 'react';
import { useContracts } from './useContracts';
import { Tag } from '../types';

export function useZKRegistry() {
  const contracts = useContracts();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasValidTag = useCallback(
    async (commitment: string, tagType: string): Promise<boolean> => {
      if (!contracts) {
        setError('Contracts not initialized');
        return false;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await contracts.zkRegistry.hasValidTag(commitment, tagType);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to check tag';
        setError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [contracts]
  );

  const getUserTags = useCallback(
    async (commitment: string): Promise<Tag[]> => {
      if (!contracts) {
        setError('Contracts not initialized');
        return [];
      }

      try {
        setLoading(true);
        setError(null);
        const result = await contracts.zkRegistry.getUserTags(commitment);

        return result.map((tag: any) => ({
          type: tag.tagType as any,
          verified: tag.verified,
          issuedAt: Number(tag.issuedAt),
          expiresAt: Number(tag.expiresAt),
        }));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tags';
        setError(errorMessage);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [contracts]
  );

  const issueTag = useCallback(
    async (commitment: string, tagType: string): Promise<boolean> => {
      if (!contracts) {
        setError('Contracts not initialized');
        return false;
      }

      try {
        setLoading(true);
        setError(null);
        const tx = await contracts.zkRegistry.issueTag(commitment, tagType);
        await tx.wait();
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to issue tag';
        setError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [contracts]
  );

  return {
    hasValidTag,
    getUserTags,
    issueTag,
    loading,
    error,
  };
}
