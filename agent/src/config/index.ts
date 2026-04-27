/**
 * Agent Configuration
 */

export interface AgentConfig {
  // Network
  network: string;
  rpcUrl: string;

  // Contracts
  registryAddress: string;
  escrowAddress: string;
  contentAccessAddress: string;

  // Agent Wallet
  agentPrivateKey: string;

  // Services
  matchmakingEnabled: boolean;
  arbitrationEnabled: boolean;
  privacyGatewayEnabled: boolean;

  // Tuning
  matchInterval: number;         // 匹配循环间隔 (ms)
  arbitrationTimeout: number;    // 仲裁超时 (ms)
  minMatchScore: number;         // 最低匹配分数
}

export function loadConfig(): AgentConfig {
  return {
    network: process.env.NETWORK || 'xlayer-testnet',
    rpcUrl: process.env.RPC_URL || 'https://xlayerrpc.okx.com',

    registryAddress: process.env.REGISTRY_ADDRESS || '',
    escrowAddress: process.env.ESCROW_ADDRESS || '',
    contentAccessAddress: process.env.CONTENT_ACCESS_ADDRESS || '',

    agentPrivateKey: process.env.AGENT_PRIVATE_KEY || '',

    matchmakingEnabled: process.env.MATCHMAKING_ENABLED !== 'false',
    arbitrationEnabled: process.env.ARBITRATION_ENABLED !== 'false',
    privacyGatewayEnabled: process.env.PRIVACY_GATEWAY_ENABLED !== 'false',

    matchInterval: parseInt(process.env.MATCH_INTERVAL || '10000'),
    arbitrationTimeout: parseInt(process.env.ARBITRATION_TIMEOUT || '86400000'),
    minMatchScore: parseInt(process.env.MIN_MATCH_SCORE || '60'),
  };
}
