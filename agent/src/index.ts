/**
 * Everything ZK Verify — Agent Service Entry Point
 *
 * Agent 负责四大核心职能：
 * 1. 撮合 (Matchmaking) — 基于 ZK 标签 + 偏好 + 社交信号 + ERC-8004 信任分
 * 2. 支付仲裁 (Arbitration) — 用户自定义规则 + 证据收集 + 自动评估
 * 3. 隐私网关 (Privacy Gateway) — ZK 验证 + 匿名内容访问
 * 4. 信任评分 (Reputation) — ERC-8004 多维评分：Agent评分 + P2P互评
 */

import { MatchmakingService } from './services/matchmaking';
import { ArbitrationService } from './services/arbitration';
import { PrivacyGatewayService } from './services/privacyGateway';
import { ZKVerifyService } from './services/zkVerify';
import { OnchainOSConnector } from './services/onchainOS';
import { ReputationService } from './services/reputation';
import { AgentConfig, loadConfig } from './config';

class EverythingZKAgent {
  private config: AgentConfig;
  private matchmaking: MatchmakingService;
  private arbitration: ArbitrationService;
  private privacyGateway: PrivacyGatewayService;
  private reputation: ReputationService;
  private zkVerify: ZKVerifyService;
  private onchainOS: OnchainOSConnector;

  constructor(config: AgentConfig) {
    this.config = config;
    this.zkVerify = new ZKVerifyService(config);
    this.onchainOS = new OnchainOSConnector(config);
    this.reputation = new ReputationService(config, this.onchainOS);
    this.matchmaking = new MatchmakingService(config, this.zkVerify, this.onchainOS, this.reputation);
    this.arbitration = new ArbitrationService(config, this.onchainOS, this.reputation);
    this.privacyGateway = new PrivacyGatewayService(config, this.zkVerify, this.onchainOS);
  }

  async start(): Promise<void> {
    console.log('🔐 Everything ZK Verify Agent starting...');

    // 初始化 Onchain OS 连接
    await this.onchainOS.initialize();
    console.log('✅ Onchain OS connected');

    // 启动各服务
    await this.matchmaking.start();
    console.log('✅ Matchmaking service started');

    await this.arbitration.start();
    console.log('✅ Arbitration service started');

    await this.privacyGateway.start();
    console.log('✅ Privacy gateway started');

    console.log('🚀 Everything ZK Verify Agent is running!');
  }

  async stop(): Promise<void> {
    await this.matchmaking.stop();
    await this.arbitration.stop();
    await this.privacyGateway.stop();
    console.log('Agent stopped gracefully');
  }
}

// Main
async function main() {
  const config = loadConfig();
  const agent = new EverythingZKAgent(config);

  process.on('SIGINT', async () => {
    await agent.stop();
    process.exit(0);
  });

  await agent.start();
}

main().catch(console.error);
