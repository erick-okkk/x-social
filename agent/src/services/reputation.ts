/**
 * Reputation Service — ERC-8004 评分体系集成
 *
 * 三层评分嵌入：
 *
 * Layer 1: Agent 身份
 *   · 我们的 Agent 在 ERC-8004 Identity Registry 注册
 *   · 获得链上 NFT 身份，可被其他平台发现和调用
 *
 * Layer 2: 多维评分
 *   · 用户 → Agent：对撮合/仲裁/验证服务打分
 *   · 用户 → 用户：交互完成后匿名 P2P 互评
 *   · 按 tag 维度分类查询
 *
 * Layer 3: 仲裁验证
 *   · Agent 仲裁决策可被第三方验证者审核
 *   · ZK 验证可被 zkML/TEE 重新验证
 *
 * 评分如何影响业务：
 *   · 撮合排序加权：高信任分的用户匹配优先级更高
 *   · 门槛费折扣：高分用户可能获得更低门槛费
 *   · 争议仲裁参考：评分历史作为仲裁的参考信号
 */

import { AgentConfig } from '../config';
import { OnchainOSConnector } from './onchainOS';

// ============ Types ============

export interface ReputationScore {
  commitment: string;
  averageScore: number;     // 0-255
  totalCount: number;
  breakdown: TagScore[];
}

export interface TagScore {
  tag1: string;             // 服务类型: matchmaking / arbitration / content / p2p
  tag2: string;             // 场景: dating / ecommerce / gate_fee / service
  averageScore: number;
  count: number;
}

export interface FeedbackSubmission {
  fromCommitment: string;
  toCommitment?: string;    // P2P 评分时填写
  agentAddress?: string;    // Agent 评分时填写
  score: number;            // 0-255
  tag1: string;
  tag2: string;
  depositId?: number;       // P2P 评分关联的 escrow ID
  comment?: string;         // 链下评论（可选）
}

// ============ Tag Constants ============

export const TAGS = {
  // Layer 1: 服务类型
  MATCHMAKING: 'matchmaking',
  ARBITRATION: 'arbitration',
  CONTENT: 'content',
  IDENTITY: 'identity',
  P2P: 'p2p',

  // Layer 2: 场景
  DATING: 'dating',
  ECOMMERCE: 'ecommerce',
  GATE_FEE: 'gate_fee',
  SERVICE: 'service',
  ACCESS: 'access',
  VERIFICATION: 'verification',
  INTERACTION: 'interaction',
} as const;

// ============ Service ============

export class ReputationService {
  private config: AgentConfig;
  private onchainOS: OnchainOSConnector;

  // 内存缓存（定期从链上同步）
  private scoreCache: Map<string, ReputationScore> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 60_000; // 60s

  constructor(config: AgentConfig, onchainOS: OnchainOSConnector) {
    this.config = config;
    this.onchainOS = onchainOS;
  }

  // ============ 评分提交 ============

  /**
   * 提交用户对 Agent 的评分
   * 写入 ERC-8004 Reputation Registry
   */
  async rateAgent(feedback: FeedbackSubmission): Promise<void> {
    if (!feedback.agentAddress) throw new Error('agentAddress required');

    await this.onchainOS.callContract({
      contract: 'AgentRegistry8004',
      method: 'rateAgent',
      params: [
        feedback.agentAddress,
        feedback.score,
        this.hashTag(feedback.tag1),
        this.hashTag(feedback.tag2),
        feedback.comment || '',
        '0x' + '0'.repeat(64), // fileHash
      ],
    });

    console.log(`Agent rated: ${feedback.agentAddress} score=${feedback.score} ${feedback.tag1}/${feedback.tag2}`);
  }

  /**
   * 提交用户间 P2P 匿名评分
   * 必须关联一个已完成的 Escrow depositId
   */
  async submitP2PFeedback(feedback: FeedbackSubmission): Promise<void> {
    if (!feedback.toCommitment || feedback.depositId === undefined) {
      throw new Error('toCommitment and depositId required for P2P feedback');
    }

    await this.onchainOS.callContract({
      contract: 'AgentRegistry8004',
      method: 'submitP2PFeedback',
      params: [
        feedback.fromCommitment,
        feedback.toCommitment,
        feedback.score,
        feedback.depositId,
        this.hashTag(feedback.tag1),
        this.hashTag(feedback.tag2),
      ],
    });

    // 清除缓存
    this.scoreCache.delete(feedback.toCommitment);

    console.log(`P2P feedback: ${feedback.fromCommitment.slice(0, 10)}→${feedback.toCommitment.slice(0, 10)} score=${feedback.score}`);
  }

  // ============ 评分查询 ============

  /**
   * 获取用户的综合信任评分
   * 用于撮合排序
   */
  async getUserScore(commitment: string): Promise<ReputationScore> {
    // 检查缓存
    const cached = this.scoreCache.get(commitment);
    const expiry = this.cacheExpiry.get(commitment) || 0;
    if (cached && Date.now() < expiry) return cached;

    // 从链上读取
    const result = await this.onchainOS.readContract(
      'AgentRegistry8004', 'getP2PScore', [commitment]
    );

    const score: ReputationScore = {
      commitment,
      averageScore: result?.averageScore || 0,
      totalCount: result?.totalCount || 0,
      breakdown: [],
    };

    // 获取分维度评分
    for (const tag1 of [TAGS.P2P, TAGS.MATCHMAKING]) {
      for (const tag2 of [TAGS.DATING, TAGS.ECOMMERCE, TAGS.SERVICE, TAGS.INTERACTION]) {
        const tagResult = await this.onchainOS.readContract(
          'AgentRegistry8004', 'getP2PScoreByTag',
          [commitment, this.hashTag(tag1), this.hashTag(tag2)]
        );
        if (tagResult?.count > 0) {
          score.breakdown.push({
            tag1, tag2,
            averageScore: tagResult.averageScore,
            count: tagResult.count,
          });
        }
      }
    }

    // 更新缓存
    this.scoreCache.set(commitment, score);
    this.cacheExpiry.set(commitment, Date.now() + this.CACHE_TTL);

    return score;
  }

  /**
   * 获取 Agent 的服务评分
   */
  async getAgentScore(agentAddress: string, tag1?: string, tag2?: string): Promise<{ count: number; averageScore: number }> {
    const result = await this.onchainOS.readContract(
      'AgentRegistry8004', 'getAgentScore',
      [agentAddress, tag1 ? this.hashTag(tag1) : '0x' + '0'.repeat(64), tag2 ? this.hashTag(tag2) : '0x' + '0'.repeat(64)]
    );
    return { count: result?.count || 0, averageScore: result?.averageScore || 0 };
  }

  // ============ 撮合集成 ============

  /**
   * 计算评分加权因子
   * 用于 Matchmaking 算法中加权匹配分数
   *
   * 高评分用户 → 权重更高 → 匹配排序靠前
   * 新用户（无评分）→ 中性权重 1.0
   * 低评分用户 → 降权但不完全排除
   */
  calculateReputationWeight(score: ReputationScore): number {
    if (score.totalCount === 0) return 1.0; // 新用户中性

    // 归一化到 0-1 (score 范围 0-255)
    const normalized = score.averageScore / 255;

    // 加上置信度因子（评分越多越可信）
    const confidence = Math.min(score.totalCount / 10, 1.0); // 10 条评分达到满置信

    // 最终权重: 0.5 ~ 1.5
    return 0.5 + normalized * confidence;
  }

  // ============ Utils ============

  private hashTag(tag: string): string {
    // keccak256(tag) — 简化实现
    // 生产环境应使用 ethers.utils.id(tag) 或 keccak256
    const crypto = require('crypto');
    return '0x' + crypto.createHash('sha256').update(tag).digest('hex');
  }
}
