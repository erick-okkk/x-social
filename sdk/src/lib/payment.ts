/**
 * Privacy Payment — 隐私支付模块
 */

import { SDKConfig, EscrowConfig, EscrowStatus } from '../types';

export class PrivacyPayment {
  private config: SDKConfig;

  constructor(config: SDKConfig) {
    this.config = config;
  }

  /**
   * 创建门槛费支付（交友场景）
   * @param senderCommitment 发送方 ZK 身份
   * @param receiverCommitment 接收方 ZK 身份
   * @param amount 金额 (wei)
   * @param duration 有效期 (秒)
   */
  async createGateFee(
    senderCommitment: string,
    receiverCommitment: string,
    amount: string,
    duration: number = 86400
  ): Promise<{ depositId: number; txHash: string }> {
    const response = await fetch(`${this.config.agentUrl}/api/payment/gate-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderCommitment,
        receiverCommitment,
        amount,
        duration,
      }),
    });
    return response.json();
  }

  /**
   * 创建内容付费支付（匿名访问场景）
   */
  async createContentPayment(
    senderCommitment: string,
    contentId: number,
    nullifier: string,
    amount: string
  ): Promise<{ depositId: number; txHash: string }> {
    const response = await fetch(`${this.config.agentUrl}/api/payment/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderCommitment,
        contentId,
        nullifier,
        amount,
      }),
    });
    return response.json();
  }

  /**
   * 查询存款状态
   */
  async getDepositStatus(depositId: number): Promise<EscrowStatus> {
    const response = await fetch(
      `${this.config.agentUrl}/api/payment/status/${depositId}`
    );
    return response.json();
  }

  /**
   * 设置门槛费（接收方设置）
   */
  async setGateFee(commitment: string, fee: string): Promise<void> {
    await fetch(`${this.config.agentUrl}/api/payment/set-gate-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitment, fee }),
    });
  }
}
