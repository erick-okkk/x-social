import { useCallback, useState } from 'react';
import { ethers } from 'ethers';
import { useContracts } from './useContracts';
import { useWallet } from './useWallet';
import { Deposit } from '../types';

export function useEscrow() {
  const contracts = useContracts();
  const { signer } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDeposit = useCallback(
    async (recipientCommitment: string, ruleSetId: number, amount: string): Promise<string | null> => {
      if (!contracts || !signer) {
        setError('Wallet not connected');
        return null;
      }

      try {
        setLoading(true);
        setError(null);
        const tx = await contracts.escrow.createDeposit(recipientCommitment, ruleSetId, amount);
        const receipt = await tx.wait();

        if (receipt?.logs) {
          const iface = new ethers.Interface(['event DepositCreated(uint256 indexed depositId)']);
          for (const log of receipt.logs) {
            try {
              const parsed = iface.parseLog(log);
              if (parsed?.name === 'DepositCreated') {
                return parsed.args[0].toString();
              }
            } catch {
              continue;
            }
          }
        }

        return null;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create deposit';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [contracts, signer]
  );

  const depositViaPermit = useCallback(
    async (
      recipientCommitment: string,
      ruleSetId: number,
      amount: string,
      deadline: number,
      signature: { v: number; r: string; s: string }
    ): Promise<string | null> => {
      if (!contracts || !signer) {
        setError('Wallet not connected');
        return null;
      }

      try {
        setLoading(true);
        setError(null);
        const tx = await contracts.escrow.depositViaPermit(
          recipientCommitment,
          ruleSetId,
          amount,
          deadline,
          signature.v,
          signature.r,
          signature.s
        );
        const receipt = await tx.wait();

        if (receipt?.logs) {
          const iface = new ethers.Interface(['event DepositCreated(uint256 indexed depositId)']);
          for (const log of receipt.logs) {
            try {
              const parsed = iface.parseLog(log);
              if (parsed?.name === 'DepositCreated') {
                return parsed.args[0].toString();
              }
            } catch {
              continue;
            }
          }
        }

        return null;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to deposit via permit';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [contracts, signer]
  );

  const getDeposit = useCallback(
    async (depositId: number): Promise<Deposit | null> => {
      if (!contracts) {
        setError('Contracts not initialized');
        return null;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await contracts.escrow.getDeposit(depositId);

        const statusMap: Record<number, 'ACTIVE' | 'RELEASED' | 'REFUNDED' | 'EXPIRED'> = {
          0: 'ACTIVE',
          1: 'RELEASED',
          2: 'REFUNDED',
          3: 'EXPIRED',
        };

        return {
          id: result.id.toString(),
          depositerId: result.depositer,
          recipientId: result.recipient,
          amount: result.amount.toString(),
          ruleSetId: result.ruleSetId.toString(),
          status: statusMap[result.status] || 'ACTIVE',
          createdAt: Number(result.createdAt),
          expiresAt: Number(result.expiresAt),
          rulesMetCount: 0,
          totalRulesCount: 0,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get deposit';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [contracts]
  );

  const previewDepositAmount = useCallback(
    async (commitment: string, ruleSetId: number): Promise<string | null> => {
      if (!contracts) {
        setError('Contracts not initialized');
        return null;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await contracts.escrow.previewDepositAmount(commitment, ruleSetId);
        return result.toString();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to preview amount';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [contracts]
  );

  const releaseDeposit = useCallback(
    async (depositId: number): Promise<boolean> => {
      if (!contracts || !signer) {
        setError('Wallet not connected');
        return false;
      }

      try {
        setLoading(true);
        setError(null);
        const tx = await contracts.escrow.releaseDeposit(depositId);
        await tx.wait();
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to release deposit';
        setError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [contracts, signer]
  );

  const refundDeposit = useCallback(
    async (depositId: number): Promise<boolean> => {
      if (!contracts || !signer) {
        setError('Wallet not connected');
        return false;
      }

      try {
        setLoading(true);
        setError(null);
        const tx = await contracts.escrow.refundDeposit(depositId);
        await tx.wait();
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to refund deposit';
        setError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [contracts, signer]
  );

  return {
    createDeposit,
    depositViaPermit,
    getDeposit,
    previewDepositAmount,
    releaseDeposit,
    refundDeposit,
    loading,
    error,
  };
}
