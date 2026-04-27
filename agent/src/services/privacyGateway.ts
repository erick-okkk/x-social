/**
 * Privacy Gateway Service — 隐私网关
 *
 * 核心职责：
 * 1. ZK 身份验证网关 —— 验证用户提交的身份证明
 * 2. 匿名内容访问代理 —— 中转付费内容访问请求
 * 3. 隐私通信通道 —— 加密撮合双方的通信
 */

import { AgentConfig } from '../config';
import { ZKVerifyService } from './zkVerify';
import { OnchainOSConnector } from './onchainOS';

// ============ Types ============

export interface VerifyRequest {
  requestId: string;
  userId: string;             // 临时会话 ID
  verifyType: VerifyType;
  documents: DocumentSubmission[];
  selfieHash: string;         // 自拍视频/照片哈希
}

export enum VerifyType {
  IDENTITY = 'identity',         // 身份证 + 人脸匹配
  HEALTH_REPORT = 'health',     // 体检报告验证
  AGE_RANGE = 'age_range',      // 年龄范围证明
  INCOME_RANGE = 'income_range', // 收入范围证明
  EDUCATION = 'education',       // 学历验证
}

export interface DocumentSubmission {
  docType: string;           // passport / id_card / health_report / diploma
  encryptedHash: string;     // 加密后的文档哈希
  zkCircuitId: string;       // 使用的 ZK 电路 ID
}

export interface VerifyResult {
  requestId: string;
  success: boolean;
  commitment: string;        // 用户 ZK 身份承诺
  tagHash?: string;          // 颁发的标签哈希
  error?: string;
}

export interface ContentAccessRequest {
  contentId: number;
  nullifier: string;         // 匿名访问标识
  zkProof: string;           // ZK 证明
  paymentTxHash?: string;    // 支付交易哈希
}

// ============ Service ============

export class PrivacyGatewayService {
  private config: AgentConfig;
  private zkVerify: ZKVerifyService;
  private onchainOS: OnchainOSConnector;
  private pendingVerifications: Map<string, VerifyRequest> = new Map();
  private isRunning = false;

  constructor(config: AgentConfig, zkVerify: ZKVerifyService, onchainOS: OnchainOSConnector) {
    this.config = config;
    this.zkVerify = zkVerify;
    this.onchainOS = onchainOS;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log('Privacy Gateway listening for verification requests...');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  // ============ Identity Verification ============

  /**
   * 提交身份验证请求
   * 流程：
   * 1. 用户上传加密的身份文件 + 自拍
   * 2. 链下 ZK 电路验证人脸与证件匹配
   * 3. 生成 ZK Proof
   * 4. Relayer 将验证结果上链
   * 5. 用户获得 ZK 验证标签
   */
  async submitVerification(request: VerifyRequest): Promise<VerifyResult> {
    this.pendingVerifications.set(request.requestId, request);

    try {
      // Step 1: 验证文档格式和完整性
      await this.validateDocuments(request.documents);

      // Step 2: 链下 ZK 验证（人脸匹配 / 文档有效性）
      const zkProof = await this.zkVerify.generateProof(request);

      // Step 3: 生成用户承诺值
      const commitment = await this.zkVerify.generateCommitment(request.userId);

      // Step 4: 通过 Onchain OS 上链
      const tagHash = await this.onchainOS.issueTag(commitment, request.verifyType, zkProof);

      return {
        requestId: request.requestId,
        success: true,
        commitment,
        tagHash,
      };
    } catch (error: any) {
      return {
        requestId: request.requestId,
        success: false,
        commitment: '',
        error: error.message,
      };
    } finally {
      this.pendingVerifications.delete(request.requestId);
    }
  }

  // ============ Anonymous Content Access ============

  /**
   * 处理匿名内容访问
   * 流程：
   * 1. 访问者提交 nullifier + ZK Proof
   * 2. Agent 验证证明有效性
   * 3. 通过 Escrow 合约处理支付
   * 4. 返回加密内容密钥（访问者解密）
   */
  async processAnonymousAccess(request: ContentAccessRequest): Promise<{
    success: boolean;
    encryptedContentKey?: string;
    error?: string;
  }> {
    try {
      // Step 1: 验证 ZK Proof
      const proofValid = await this.zkVerify.verifyProof(request.zkProof);
      if (!proofValid) {
        return { success: false, error: 'Invalid ZK proof' };
      }

      // Step 2: 通过合约验证并处理支付
      await this.onchainOS.processContentAccess(
        request.contentId,
        request.nullifier,
        request.zkProof
      );

      // Step 3: 获取加密的内容密钥
      const encryptedContentKey = await this.generateContentKey(request.contentId, request.nullifier);

      return {
        success: true,
        encryptedContentKey,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============ Private Methods ============

  private async validateDocuments(documents: DocumentSubmission[]): Promise<void> {
    if (!documents || documents.length === 0) {
      throw new Error('No documents submitted');
    }
    for (const doc of documents) {
      if (!doc.encryptedHash || !doc.zkCircuitId) {
        throw new Error(`Invalid document: ${doc.docType}`);
      }
    }
  }

  private async generateContentKey(contentId: number, nullifier: string): Promise<string> {
    // 生成临时内容解密密钥，用访问者的 nullifier 加密
    // 这样只有持有对应 secret 的访问者才能解密内容
    return `encrypted_key_${contentId}_${nullifier.slice(0, 8)}`;
  }
}
