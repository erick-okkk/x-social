/**
 * Arbitration Service — Agent 支付仲裁引擎
 *
 * 核心职责：
 * 1. 监听 Escrow 合约事件
 * 2. 根据用户自定义规则 (RuleSet) 验证交互
 * 3. ERC-8004 信任评分加权仲裁决策
 * 4. fastTrack 快速通道 — 双方高信任分时简化仲裁
 * 5. 自动触发资金释放或退款
 * 6. 交互完成后触发 P2P 匿名互评窗口
 */

import { AgentConfig } from '../config';
import { OnchainOSConnector } from './onchainOS';
import { ReputationService, TAGS } from './reputation';

// ============ Types ============

export enum RuleType {
  CONVERSATION = 0,
  PHOTO_EXCHANGE = 1,
  CONTENT_DELIVERY = 2,
  OFFLINE_CHECKIN = 3,
  VIDEO_CALL = 4,
  SERVICE_COMPLETED = 5,
  CUSTOM_PROOF = 6,
}

export interface ArbitrationRule {
  ruleType: RuleType;
  minThreshold: number;
  description: string;
  required: boolean;
}

export interface RuleSet {
  creatorCommitment: string;
  ruleIds: number[];
  gateFee: number;
  minReputationScore: number;
  discountThreshold: number;
  discountBps: number;
  active: boolean;
}

export interface EvidenceItem {
  type: RuleType;
  data: any;
  timestamp: number;
  hash: string;
}

export interface ConversationRecord {
  depositId: number;
  senderCommitment: string;
  receiverCommitment: string;
  messages: ConversationMessage[];
  evidence: EvidenceItem[];        // 各规则类型的证据
  ruleSetId?: number;
  fastTrack: boolean;              // ERC-8004 快速通道
  startedAt: number;
  endedAt?: number;
}

export interface ConversationMessage {
  from: 'sender' | 'receiver';
  timestamp: number;
  contentHash: string;
  lengthRange: string;
}

export interface ArbitrationResult {
  depositId: number;
  decision: 'release' | 'refund' | 'dispute';
  reason: string;
  conversationHash: string;
  confidence: number;
  ruleResults?: RuleEvalResult[];   // 每条规则的评估结果
  fastTracked?: boolean;
}

export interface RuleEvalResult {
  ruleId: number;
  ruleType: RuleType;
  passed: boolean;
  detail: string;
}

// ============ Rule Evaluators ============

type RuleEvaluator = (rule: ArbitrationRule, evidence: EvidenceItem[], messages: ConversationMessage[]) => RuleEvalResult;

const evaluators: Record<RuleType, RuleEvaluator> = {
  [RuleType.CONVERSATION]: (rule, evidence, messages) => {
    const passed = messages.length >= rule.minThreshold;
    return {
      ruleId: 0,
      ruleType: RuleType.CONVERSATION,
      passed,
      detail: passed
        ? `Conversation has ${messages.length} messages (required: ${rule.minThreshold})`
        : `Only ${messages.length} messages, need ${rule.minThreshold}`,
    };
  },

  [RuleType.PHOTO_EXCHANGE]: (rule, evidence) => {
    const photos = evidence.filter(e => e.type === RuleType.PHOTO_EXCHANGE);
    const passed = photos.length >= rule.minThreshold;
    return {
      ruleId: 0,
      ruleType: RuleType.PHOTO_EXCHANGE,
      passed,
      detail: passed
        ? `${photos.length} photos exchanged`
        : `Only ${photos.length} photos, need ${rule.minThreshold}`,
    };
  },

  [RuleType.CONTENT_DELIVERY]: (rule, evidence) => {
    const deliveries = evidence.filter(e => e.type === RuleType.CONTENT_DELIVERY);
    const passed = deliveries.length >= rule.minThreshold;
    return {
      ruleId: 0,
      ruleType: RuleType.CONTENT_DELIVERY,
      passed,
      detail: passed ? 'Content delivered' : 'Content not delivered',
    };
  },

  [RuleType.OFFLINE_CHECKIN]: (rule, evidence) => {
    const checkins = evidence.filter(e => e.type === RuleType.OFFLINE_CHECKIN);
    const passed = checkins.length >= rule.minThreshold;
    return {
      ruleId: 0,
      ruleType: RuleType.OFFLINE_CHECKIN,
      passed,
      detail: passed ? 'Offline check-in verified' : 'No check-in evidence',
    };
  },

  [RuleType.VIDEO_CALL]: (rule, evidence) => {
    const calls = evidence.filter(e => e.type === RuleType.VIDEO_CALL);
    const totalDuration = calls.reduce((sum, e) => sum + (e.data?.duration || 0), 0);
    const passed = totalDuration >= rule.minThreshold;
    return {
      ruleId: 0,
      ruleType: RuleType.VIDEO_CALL,
      passed,
      detail: passed
        ? `Video call ${totalDuration}s (required: ${rule.minThreshold}s)`
        : `Video call ${totalDuration}s, need ${rule.minThreshold}s`,
    };
  },

  [RuleType.SERVICE_COMPLETED]: (rule, evidence) => {
    const completions = evidence.filter(e => e.type === RuleType.SERVICE_COMPLETED);
    const passed = completions.length > 0 && completions.some(e => e.data?.confirmed);
    return {
      ruleId: 0,
      ruleType: RuleType.SERVICE_COMPLETED,
      passed,
      detail: passed ? 'Service completion confirmed' : 'Service not confirmed',
    };
  },

  [RuleType.CUSTOM_PROOF]: (rule, evidence) => {
    const proofs = evidence.filter(e => e.type === RuleType.CUSTOM_PROOF);
    const passed = proofs.length >= rule.minThreshold;
    return {
      ruleId: 0,
      ruleType: RuleType.CUSTOM_PROOF,
      passed,
      detail: passed ? 'Custom proof provided' : 'Custom proof missing',
    };
  },
};

// ============ Service ============

export class ArbitrationService {
  private config: AgentConfig;
  private onchainOS: OnchainOSConnector;
  private reputation?: ReputationService;
  private activeConversations: Map<number, ConversationRecord> = new Map();
  private isRunning = false;

  constructor(config: AgentConfig, onchainOS: OnchainOSConnector, reputation?: ReputationService) {
    this.config = config;
    this.onchainOS = onchainOS;
    this.reputation = reputation;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.startEventListener();
    this.startArbitrationLoop();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  // ============ Evidence Submission API ============

  /** 记录对话消息 */
  async submitMessage(depositId: number, message: ConversationMessage): Promise<void> {
    const record = this.getOrCreateRecord(depositId);
    record.messages.push(message);
  }

  /** 提交照片证据 */
  async submitPhoto(depositId: number, photoHash: string): Promise<void> {
    const record = this.getOrCreateRecord(depositId);
    record.evidence.push({
      type: RuleType.PHOTO_EXCHANGE,
      data: { photoHash },
      timestamp: Date.now(),
      hash: photoHash,
    });
  }

  /** 提交内容交付证据 */
  async submitContentDelivery(depositId: number, contentHash: string): Promise<void> {
    const record = this.getOrCreateRecord(depositId);
    record.evidence.push({
      type: RuleType.CONTENT_DELIVERY,
      data: { contentHash },
      timestamp: Date.now(),
      hash: contentHash,
    });
  }

  /** 提交线下签到证据 */
  async submitCheckin(depositId: number, locationHash: string, proofHash: string): Promise<void> {
    const record = this.getOrCreateRecord(depositId);
    record.evidence.push({
      type: RuleType.OFFLINE_CHECKIN,
      data: { locationHash, proofHash },
      timestamp: Date.now(),
      hash: proofHash,
    });
  }

  /** 提交视频通话证据 */
  async submitVideoCall(depositId: number, duration: number, callHash: string): Promise<void> {
    const record = this.getOrCreateRecord(depositId);
    record.evidence.push({
      type: RuleType.VIDEO_CALL,
      data: { duration, callHash },
      timestamp: Date.now(),
      hash: callHash,
    });
  }

  /** 确认服务完成 */
  async confirmServiceComplete(depositId: number, serviceHash: string): Promise<void> {
    const record = this.getOrCreateRecord(depositId);
    record.evidence.push({
      type: RuleType.SERVICE_COMPLETED,
      data: { confirmed: true, serviceHash },
      timestamp: Date.now(),
      hash: serviceHash,
    });
  }

  /** 提交自定义证明 */
  async submitCustomProof(depositId: number, proofData: any, proofHash: string): Promise<void> {
    const record = this.getOrCreateRecord(depositId);
    record.evidence.push({
      type: RuleType.CUSTOM_PROOF,
      data: proofData,
      timestamp: Date.now(),
      hash: proofHash,
    });
  }

  // ============ Core Arbitration ============

  /**
   * 执行仲裁决策（支持 RuleSet + ERC-8004 快速通道）
   */
  async arbitrate(depositId: number): Promise<ArbitrationResult> {
    const record = this.activeConversations.get(depositId);
    if (!record) {
      return {
        depositId,
        decision: 'dispute',
        reason: 'No conversation record found',
        conversationHash: '0x0',
        confidence: 0,
      };
    }

    // 从链上读取 deposit 信息（含 fastTrack 和 ruleSetId）
    const deposit = await this.onchainOS.readContract('PrivacyEscrow', 'getDeposit', [depositId]);
    if (deposit) {
      record.fastTrack = deposit.fastTrack ?? false;
      record.ruleSetId = deposit.ruleSetId;
    }

    let result: ArbitrationResult;

    // ---- 快速通道：双方高信任分，简化仲裁 ----
    if (record.fastTrack) {
      result = await this.fastTrackArbitration(record);
    }
    // ---- 有规则集：按用户自定义规则仲裁 ----
    else if (record.ruleSetId !== undefined && record.ruleSetId < Number.MAX_SAFE_INTEGER) {
      result = await this.ruleBasedArbitration(record);
    }
    // ---- 无规则集：默认仲裁逻辑 ----
    else {
      result = await this.defaultArbitration(record);
    }

    // 执行链上操作
    if (result.decision === 'release') {
      await this.executeRelease(depositId, result.conversationHash);
      // 触发 P2P 互评窗口
      await this.triggerP2PFeedbackWindow(record);
    } else if (result.decision === 'refund') {
      await this.executeRefund(depositId);
    }

    return result;
  }

  // ============ Arbitration Strategies ============

  /**
   * 快速通道仲裁 — 双方高信任分，简化检查
   * 只需基本的交互存在证明，不做深度质量评估
   */
  private async fastTrackArbitration(record: ConversationRecord): Promise<ArbitrationResult> {
    const conversationHash = this.hashConversation(record);
    const hasAnyInteraction = record.messages.length > 0 || record.evidence.length > 0;

    if (hasAnyInteraction) {
      return {
        depositId: record.depositId,
        decision: 'release',
        reason: 'Fast-track: both parties have high trust scores, basic interaction verified',
        conversationHash,
        confidence: 92,
        fastTracked: true,
      };
    }

    return {
      depositId: record.depositId,
      decision: 'dispute',
      reason: 'Fast-track enabled but no interaction evidence at all',
      conversationHash,
      confidence: 70,
      fastTracked: true,
    };
  }

  /**
   * 规则驱动仲裁 — 按用户自定义 RuleSet 逐条评估
   */
  private async ruleBasedArbitration(record: ConversationRecord): Promise<ArbitrationResult> {
    const conversationHash = this.hashConversation(record);
    const ruleSetId = record.ruleSetId!;

    // 从链上读取规则集
    const ruleSet = await this.onchainOS.readContract('PrivacyEscrow', 'getRuleSet', [ruleSetId]);
    if (!ruleSet || !ruleSet.active) {
      return {
        depositId: record.depositId,
        decision: 'dispute',
        reason: 'RuleSet not found or inactive',
        conversationHash,
        confidence: 50,
      };
    }

    // 逐条评估
    const ruleResults: RuleEvalResult[] = [];
    let allRequiredPassed = true;

    for (const ruleId of ruleSet.ruleIds) {
      const rule = await this.onchainOS.readContract('PrivacyEscrow', 'getRule', [ruleId]);
      if (!rule) continue;

      const evaluator = evaluators[rule.ruleType as RuleType];
      if (!evaluator) continue;

      const evalResult = evaluator(rule, record.evidence, record.messages);
      evalResult.ruleId = ruleId;
      ruleResults.push(evalResult);

      if (rule.required && !evalResult.passed) {
        allRequiredPassed = false;
      }
    }

    const passedCount = ruleResults.filter(r => r.passed).length;
    const confidence = Math.round((passedCount / Math.max(ruleResults.length, 1)) * 100);

    if (allRequiredPassed) {
      return {
        depositId: record.depositId,
        decision: 'release',
        reason: `All required rules passed (${passedCount}/${ruleResults.length} total)`,
        conversationHash,
        confidence: Math.max(confidence, 75),
        ruleResults,
      };
    } else {
      return {
        depositId: record.depositId,
        decision: 'refund',
        reason: `Required rules not met (${passedCount}/${ruleResults.length} passed)`,
        conversationHash,
        confidence: Math.max(confidence, 60),
        ruleResults,
      };
    }
  }

  /**
   * 默认仲裁 — 无规则集时的兜底逻辑
   */
  private async defaultArbitration(record: ConversationRecord): Promise<ArbitrationResult> {
    const messages = record.messages;
    const conversationHash = this.hashConversation(record);

    // 检查消息数量
    if (messages.length < 3) {
      return {
        depositId: record.depositId,
        decision: 'refund',
        reason: `Insufficient messages: ${messages.length} < 3`,
        conversationHash,
        confidence: 90,
      };
    }

    // 检查接收方是否有回复
    const receiverMessages = messages.filter(m => m.from === 'receiver');
    if (receiverMessages.length < 1) {
      return {
        depositId: record.depositId,
        decision: 'refund',
        reason: 'Receiver did not respond',
        conversationHash,
        confidence: 95,
      };
    }

    // 检查对话持续时间
    const duration = (record.endedAt || Date.now()) - record.startedAt;
    if (duration < 60_000) {
      return {
        depositId: record.depositId,
        decision: 'refund',
        reason: 'Conversation too short in duration',
        conversationHash,
        confidence: 85,
      };
    }

    return {
      depositId: record.depositId,
      decision: 'release',
      reason: 'Valid conversation confirmed (default criteria)',
      conversationHash,
      confidence: 88,
    };
  }

  // ============ P2P Feedback Trigger ============

  /**
   * 交互完成后触发双方匿名 P2P 互评
   * Agent 通知前端打开评分 UI，但不代用户提交
   */
  private async triggerP2PFeedbackWindow(record: ConversationRecord): Promise<void> {
    if (!this.reputation) return;

    console.log(
      `[Reputation] Opening P2P feedback window for deposit #${record.depositId}: ` +
      `${record.senderCommitment.slice(0, 10)} ↔ ${record.receiverCommitment.slice(0, 10)}`
    );

    // TODO: 通过 Onchain OS 消息通道通知双方打开评分 UI
    // 评分窗口有效期 48 小时
    // 双方可选择：匿名评分（0-255）+ tag 维度选择
  }

  // ============ Helpers ============

  private getOrCreateRecord(depositId: number): ConversationRecord {
    let record = this.activeConversations.get(depositId);
    if (!record) {
      record = {
        depositId,
        senderCommitment: '',
        receiverCommitment: '',
        messages: [],
        evidence: [],
        fastTrack: false,
        startedAt: Date.now(),
      };
      this.activeConversations.set(depositId, record);
    }
    return record;
  }

  private hashConversation(record: ConversationRecord): string {
    const data = [
      ...record.messages.map(m => m.contentHash),
      ...record.evidence.map(e => e.hash),
    ].join('');
    return `0x${Buffer.from(data).toString('hex').slice(0, 64).padEnd(64, '0')}`;
  }

  private async executeRelease(depositId: number, conversationHash: string): Promise<void> {
    console.log(`Releasing deposit #${depositId} with conversation proof`);
    await this.onchainOS.callContract({
      contract: 'PrivacyEscrow',
      method: 'releaseDeposit',
      params: [depositId, conversationHash],
    });
  }

  private async executeRefund(depositId: number): Promise<void> {
    console.log(`Refunding deposit #${depositId}`);
    await this.onchainOS.callContract({
      contract: 'PrivacyEscrow',
      method: 'refundDeposit',
      params: [depositId],
    });
  }

  private startEventListener(): void {
    console.log('Listening for escrow contract events...');
    // TODO: 监听 PrivacyEscrow 合约事件
    // - DepositCreated → 读取 ruleSetId & fastTrack，开始跟踪
    // - FastTrackEnabled → 标记快速通道
    // - ReputationDiscountApplied → 记录折扣信息
  }

  private startArbitrationLoop(): void {
    const loop = async () => {
      while (this.isRunning) {
        for (const [depositId, record] of this.activeConversations) {
          const elapsed = Date.now() - record.startedAt;
          if (elapsed > 24 * 60 * 60 * 1000) {
            await this.arbitrate(depositId);
            this.activeConversations.delete(depositId);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    };
    loop();
  }
}
