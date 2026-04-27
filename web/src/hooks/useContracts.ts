import { useMemo } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import {
  ZKVerifyRegistryABI,
  PrivacyEscrowABI,
  AnonymousContentAccessABI,
  AgentRegistry8004ABI,
} from '../contracts/abis';
import { CONTRACTS } from '../contracts/addresses';

export function useContracts() {
  const { signer, provider } = useWallet();

  const contracts = useMemo(() => {
    if (!signer && !provider) {
      return null;
    }

    const signerOrProvider = signer || provider;

    return {
      zkRegistry: new ethers.Contract(
        CONTRACTS.ZK_VERIFY_REGISTRY,
        ZKVerifyRegistryABI,
        signerOrProvider
      ),
      escrow: new ethers.Contract(
        CONTRACTS.PRIVACY_ESCROW,
        PrivacyEscrowABI,
        signerOrProvider
      ),
      content: new ethers.Contract(
        CONTRACTS.ANONYMOUS_CONTENT,
        AnonymousContentAccessABI,
        signerOrProvider
      ),
      agentRegistry: new ethers.Contract(
        CONTRACTS.AGENT_REGISTRY,
        AgentRegistry8004ABI,
        signerOrProvider
      ),
    };
  }, [signer, provider]);

  return contracts;
}
