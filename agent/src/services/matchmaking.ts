/**
 * Matchmaking Service — AI 智能撮合引擎
 *
 * 核心逻辑：
 * 1. 收集用户 ZK 标签（已验证的属性）
 * 2. 结合用户偏好设置、对话历史、社交信号
 * 3. 通过向量相似度 + 规则引擎进行匹配
 * 4. **ERC-8004 信任评分加权** — 高信任分用户匹配优先
 * 5. 撮合成功后触发 Escrow 支付流程
 */

import { AgentConfig } from '../config';
import { ZKVerifyService } from './zkVerify';
import { OnchainOSConnector } from './onchainOS';
import { ReputationService } from './reputation';

// ============ Types ============

export interface UserProfile {
  commitment: string;           // ZK 身份承诺
  verifiedTags: VerifiedTag[];  // 已验证的 ZK 标签
  preferences: MatchPreference; // 匹配偏好
  embedding?: number[];         // 用户画像向量（从对话/社交数据生成）
  reputationScore?: number;     // ERC-8004 P2P 信任评分 (0-255)
}

export interface VerifiedTag {
  tagType: string;
  tagHash: string;
  issuedAt: number;
  expiresAt: number;
}

export interface MatchPreference {
  scenario: 'dating' | 'ecommerce' | 'social' | 'professional';
  requiredTags: string[];      // 对方必须有的标签类型
  ageRange?: [number, number]; // 年龄范围偏好
  location?: string;           // 地理位置偏好
  gateFee?: number;            // 门槛费设置（0 = 免费）
  maxMatches?: number;         // 最大匹配数
}

export interface MatchResult {
  matchId: string;
  userA: string;  // commitment
  userB: string;  // commitment
  score: number;  // 匹配分数 0-100
  scenario: string;
  requiresPayment: boolean;
  escrowId?: number;
}

// ============ Service ============

export class MatchmakingService {
  private config: AgentConfig;
  private zkVerify: ZKVerifyService;
  private onchainOS: OnchainOSConnector;
  private reputation: ReputationService;
  private matchPool: Map<string, UserProfile> = new Map();
  private isRunning = false;

  constructor(config: AgentConfig, zkVerify: ZKVerifyService, onchainOS: OnchainOSConnector, reputation: ReputationService) {
    this.config = config;
    this.zkVerify = zkVerify;
    this.onchainOS = onchainOS;
    this.reputation = reputation;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.startMatchLoop();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  /**
   * 注册用户到匹配池
   */
  async registerUser(profile: UserProfile): Promise<void> {
    // 验证用户的 ZK 标签是否有效
    for (const tag of profile.verifiedTags) {
      const valid = await this.zkVerify.verifyTagOnChain(profile.commitment, tag.tagType);
      if (!valid) {
        throw new Error(`Tag ${tag.tagType} is not valid on-chain`);
      }
    }

    // 生成用户画像向量
    profile.embedding = await this.generateUserEmbedding(profile);

    this.matchPool.set(profile.commitment, profile);
  }

  /**
   * 核心匹配算法
   */
  async findMatches(userCommitment: string): Promise<MatchResult[]> {
    const user = this.matchPool.get(userCommitment);
    if (!user) throw new Error('User not in match pool');

    const matches: MatchResult[] = [];

    for (const [commitment, candidate] of this.matchPool) {
      if (commitment === userCommitment) continue;

      // 1. 检查必要标签
      const hasRequiredTags = user.preferences.requiredTags.every(
        tagType => candidate.verifiedTags.some(t => t.tagType === tagType)
      );
      if (!hasRequiredTags) continue;

      // 2. 场景匹配
      if (user.preferences.scenario !== candidate.preferences.scenario) continue;

      // 3. 计算匹配分数
      const score = this.calculateMatchScore(user, candidate);
      if (score < 60) continue; // 最低 60 分才匹配

      // 4. 检查是否需要门槛费
      const requiresPayment = (candidate.preferences.gateFee ?? 0) > 0;

      matches.push({
        matchId: `match_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        userA: userCommitment,
        userB: commitment,
        score,
        scenario: user.preferences.scenario,
        requiresPayment,
      });
    }

    // 按分数排序
    return matches.sort((a, b) => b.score - a.score).slice(0, user.preferences.maxMatches || 10);
  }

  // ============ Private Methods ============

  /**
   * 匹配分数（含 ERC-8004 信任评分加权）
   *
   * 基础分 = 标签(30%) + 向量(30%) + 偏好(15%) + ERC-8004信任分(25%)
   */
  private calculateMatchScore(userA: UserProfile, userB: UserProfile): number {
    let score = 0;

    // 1. 标签重合度 (30%)
    const commonTags = userA.verifiedTags.filter(
      tagA => userB.verifiedTags.some(tagB => tagA.tagType === tagB.tagType)
    );
    score += (commonTags.length / Math.max(userA.verifiedTags.length, 1)) * 30;

    // 2. 向量相似度 (30%)
    if (userA.embedding && userB.embedding) {
      score += this.cosineSimilarity(userA.embedding, userB.embedding) * 30;
    }

    // 3. 偏好互补度 (15%)
    score += this.calculatePreferenceCompatibility(userA.preferences, userB.preferences) * 15;

    // 4. ERC-8004 P2P 信任评分 (25%)
    // 双方历史交互评分的加权平均，高信任分 → 匹配靠前
    const aRep = userA.reputationScore ?? 128; // 新用户默认中性 128/255
    const bRep = userB.reputationScore ?? 128;
    const avgReputation = (aRep + bRep) / 2;
    score += (avgReputation / 255) * 25;

    return Math.min(100, Math.round(score));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private calculatePreferenceCompatibility(a: MatchPreference, b: MatchPreference): number {
    let compat = 0;
    if (a.scenario === b.scenario) compat += 0.5;
    if (a.location && b.location && a.location === b.location) compat += 0.5;
    return compat;
  }

  private async generateUserEmbedding(profile: UserProfile): Promise<number[]> {
    // TODO: 调用 AI 模型生成用户画像向量
    // 基于: 对话历史、社交关注、平台行为数据
    // 返回 128 维向量
    return new Array(128).fill(0).map(() => Math.random());
  }

  private startMatchLoop(): void {
    const loop = async () => {
      while (this.isRunning) {
        // 定期扫描匹配池，自动撮合
        for (const [commitment] of this.matchPool) {
          try {
            const matches = await this.findMatches(commitment);
            if (matches.length > 0) {
              await this.notifyMatches(commitment, matches);
            }
          } catch {
            // skip failed matches
          }
        }
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10s interval
      }
    };
    loop();
  }

  private async notifyMatches(userCommitment: string, matches: MatchResult[]): Promise<void> {
    // TODO: 通过 Onchain OS 消息通道通知用户匹配结果
    console.log(`Found ${matches.length} matches for ${userCommitment.slice(0, 10)}...`);
  }
}
