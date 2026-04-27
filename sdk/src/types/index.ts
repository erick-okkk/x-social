/**
 * Everything ZK Verify — Type Definitions
 */

// ============ SDK Config ============

export interface SDKConfig {
  agentUrl: string;        // Agent 服务地址
  network: string;         // 网络名称
  rpcUrl?: string;         // RPC URL（可选，直接链上交互时需要）
}

// ============ Identity & Verification ============

export interface VerifyRequest {
  commitment: string;
  verifyType: VerifyType;
  documents: DocumentSubmission[];
  selfieHash?: string;
}

export enum VerifyType {
  IDENTITY = 'identity',
  HEALTH_REPORT = 'health',
  AGE_RANGE = 'age_range',
  INCOME_RANGE = 'income_range',
  EDUCATION = 'education',
  SOCIAL_SCORE = 'social_score',
}

export interface DocumentSubmission {
  docType: string;
  encryptedData: string;    // 加密的文档数据
  zkCircuitId?: string;
}

export interface VerifyResult {
  success: boolean;
  commitment: string;
  tagHash?: string;
  error?: string;
}

// ============ Matchmaking ============

export interface UserProfile {
  commitment: string;
  scenario: MatchScenario;
  requiredTags: VerifyType[];
  preferences: Record<string, any>;
  gateFee?: string;         // 门槛费（wei）
}

export enum MatchScenario {
  DATING = 'dating',
  ECOMMERCE = 'ecommerce',
  SOCIAL = 'social',
  PROFESSIONAL = 'professional',
}

export interface MatchResult {
  matchId: string;
  partnerCommitment: string;  // 对方的 commitment（不暴露真实身份）
  score: number;
  scenario: MatchScenario;
  requiresPayment: boolean;
  gateFee?: string;
}

// ============ Payment ============

export interface EscrowConfig {
  senderCommitment: string;
  receiverCommitment: string;
  amount: string;
  escrowType: EscrowType;
  duration: number;
}

export enum EscrowType {
  GATE_FEE = 0,
  CONTENT_ACCESS = 1,
  SERVICE_PAYMENT = 2,
}

export interface EscrowStatus {
  depositId: number;
  amount: string;
  status: 'active' | 'released' | 'refunded' | 'disputed';
  createdAt: number;
  deadline: number;
}

// ============ Content ============

export interface ContentItem {
  contentId: number;
  creatorCommitment: string;
  contentHash: string;
  price: string;
  active: boolean;
}
