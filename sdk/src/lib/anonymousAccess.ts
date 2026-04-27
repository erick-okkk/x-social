/**
 * Anonymous Access — 匿名内容访问模块
 */

import { SDKConfig, ContentItem } from '../types';

export class AnonymousAccess {
  private config: SDKConfig;

  constructor(config: SDKConfig) {
    this.config = config;
  }

  /**
   * 发布付费内容
   */
  async publishContent(
    creatorCommitment: string,
    contentHash: string,
    price: string
  ): Promise<{ contentId: number }> {
    const response = await fetch(`${this.config.agentUrl}/api/content/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorCommitment, contentHash, price }),
    });
    return response.json();
  }

  /**
   * 匿名访问付费内容
   * 使用 nullifier 确保匿名性和防双重访问
   */
  async accessContent(
    contentId: number,
    nullifier: string,
    zkProof: string,
    payment: string
  ): Promise<{ encryptedContentKey: string }> {
    const response = await fetch(`${this.config.agentUrl}/api/content/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId, nullifier, zkProof, payment }),
    });
    return response.json();
  }

  /**
   * 验证访问权限
   */
  async verifyAccess(contentId: number, nullifier: string): Promise<boolean> {
    const response = await fetch(
      `${this.config.agentUrl}/api/content/verify?contentId=${contentId}&nullifier=${nullifier}`
    );
    const data = await response.json();
    return data.valid;
  }

  /**
   * 获取内容信息
   */
  async getContent(contentId: number): Promise<ContentItem> {
    const response = await fetch(`${this.config.agentUrl}/api/content/${contentId}`);
    return response.json();
  }
}
