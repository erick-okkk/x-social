/**
 * ZK Verify Client — SDK 核心客户端
 */

import { SDKConfig, VerifyRequest, VerifyResult, MatchResult, UserProfile } from '../types';

export class ZKVerifyClient {
  private config: SDKConfig;
  private userSecret?: string;
  private userCommitment?: string;

  constructor(config: SDKConfig) {
    this.config = config;
  }

  // ============ Identity ============

  /**
   * 初始化用户身份（生成 secret + commitment）
   */
  async initIdentity(): Promise<{ commitment: string; secret: string }> {
    // 生成随机 secret 和 nullifier
    const secret = this.generateRandom(32);
    const nullifier = this.generateRandom(32);
    const commitment = await this.poseidonHash(secret, nullifier);

    this.userSecret = secret;
    this.userCommitment = commitment;

    return { commitment, secret };
  }

  /**
   * 提交身份验证
   */
  async submitVerification(request: Omit<VerifyRequest, 'commitment'>): Promise<VerifyResult> {
    if (!this.userCommitment) throw new Error('Call initIdentity() first');

    const response = await fetch(`${this.config.agentUrl}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        commitment: this.userCommitment,
      }),
    });

    return response.json();
  }

  // ============ Matchmaking ============

  /**
   * 注册到匹配池
   */
  async registerForMatching(profile: Omit<UserProfile, 'commitment'>): Promise<void> {
    if (!this.userCommitment) throw new Error('Call initIdentity() first');

    await fetch(`${this.config.agentUrl}/api/match/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...profile,
        commitment: this.userCommitment,
      }),
    });
  }

  /**
   * 获取匹配结果
   */
  async getMatches(): Promise<MatchResult[]> {
    if (!this.userCommitment) throw new Error('Call initIdentity() first');

    const response = await fetch(
      `${this.config.agentUrl}/api/match/results?commitment=${this.userCommitment}`
    );
    return response.json();
  }

  // ============ Utils ============

  private generateRandom(bytes: number): string {
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async poseidonHash(...inputs: string[]): Promise<string> {
    // TODO: 使用真实的 Poseidon hash
    const data = new TextEncoder().encode(inputs.join(''));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
