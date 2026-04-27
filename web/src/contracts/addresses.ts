export const CONTRACTS = {
  ZK_VERIFY_REGISTRY: (import.meta.env.VITE_ZK_REGISTRY as string) || '0x0000000000000000000000000000000000000000',
  PRIVACY_ESCROW: (import.meta.env.VITE_ESCROW as string) || '0x0000000000000000000000000000000000000000',
  ANONYMOUS_CONTENT: (import.meta.env.VITE_CONTENT as string) || '0x0000000000000000000000000000000000000000',
  AGENT_REGISTRY: (import.meta.env.VITE_AGENT_REGISTRY as string) || '0x0000000000000000000000000000000000000000',
  USDC: (import.meta.env.VITE_USDC as string) || '0x0000000000000000000000000000000000000000',
};

export const CHAIN_ID = parseInt((import.meta.env.VITE_CHAIN_ID as string) || '196', 10);
export const RPC_URL = (import.meta.env.VITE_RPC_URL as string) || 'https://rpc.xlayer.tech';
