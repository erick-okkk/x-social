export type TagType = 'HEALTH' | 'EDUCATION' | 'SOCIAL' | 'WORK' | 'IDENTITY' | 'INCOME';

export interface Tag {
  type: TagType;
  verified: boolean;
  issuedAt: number;
  expiresAt: number;
  label: string;      // 中文显示名
}

export interface Rule {
  id: string;
  type: 'CONVERSATION' | 'PHOTO_EXCHANGE' | 'CONTACT_SHARED' | 'SEND_LOCATION' | 'DUAL_CHECKIN' | 'VIDEO_CALL' | 'TRANSFER';
  required: boolean;
  bonus: boolean;
  minValue?: number;
  description: string;
}

export interface RuleSet {
  id: string;
  rules: Rule[];
  minRepScore: number;
  createdAt: number;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  price: string;       // USDC amount display string
  priceWei: string;    // raw amount
  ruleSetId: string;
  category: 'dating' | 'service' | 'consulting' | 'social';
}

export interface ERC8004Score {
  averageScore: number;     // 0-255, from P2PScoreSummary.averageScore
  totalCount: number;       // total feedback count
  breakdown: {
    tag: string;            // e.g. "matchmaking", "p2p", "content"
    label: string;          // 中文名
    score: number;          // 0-255
    count: number;
  }[];
}

export interface Profile {
  id: string;
  commitment: string;
  address: string;
  name: string;
  age?: number;
  bio: string;
  photoUrl: string;
  photos?: string[];   // 多张照片
  photoAuthenticityPercent: number;
  tags: Tag[];
  ruleSet?: RuleSet;
  services?: ServiceItem[];  // 用户提供的服务
  erc8004Score?: ERC8004Score;  // ERC-8004 信誉评分
  messageFee?: string;            // 每条消息收费（USDC），被打招呼的人自定义
  createdAt: number;
}

export interface Deposit {
  id: string;
  depositerId: string;
  recipientId: string;
  amount: string;
  ruleSetId: string;
  status: 'ACTIVE' | 'RELEASED' | 'REFUNDED' | 'EXPIRED' | 'DISPUTED';
  createdAt: number;
  expiresAt: number;
  rulesMetCount: number;
  totalRulesCount: number;
  serviceType?: string;
}

// ==========================================
// 进行中的订单（线下/线上服务流程）
// ==========================================
export interface ActiveOrder {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceIcon: string;
  counterparty: {
    name: string;
    profileId: string;
    photoUrl?: string;
  };
  role: 'provider' | 'consumer';        // 我是服务提供方 or 消费方
  amount: string;                         // 托管金额 USDC
  escrowAddress: string;
  status: 'PENDING_CHECKIN' | 'CHECKED_IN' | 'IN_PROGRESS' | 'PENDING_CONFIRM' | 'COMPLETED' | 'DISPUTED';
  myCheckedIn: boolean;
  counterpartyCheckedIn: boolean;
  serviceConfirmedByConsumer: boolean;     // 消费方确认服务完成
  createdAt: number;
  expiresAt: number;
  isOffline: boolean;                     // 是否线下服务
  location?: string;                      // 线下服务地点（脱敏）
}

export interface Transaction {
  id: string;
  txHash: string;
  type: 'ESCROW_DEPOSIT' | 'ESCROW_RELEASE' | 'ESCROW_REFUND' | 'P2P_TRANSFER' | 'PERMIT_APPROVE';
  amount: string;           // USDC display
  amountWei: string;
  token: 'USDC' | 'ETH';
  counterparty: {
    name: string;
    commitment: string;
    profileId?: string;
  };
  depositId?: string;       // 关联的 Escrow ID
  serviceName?: string;     // 关联的服务名
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  escrowStatus?: 'ACTIVE' | 'RELEASED' | 'REFUNDED' | 'EXPIRED';
  timestamp: number;
  // 8004 评分相关
  rated: boolean;           // 是否已评分
  myRating?: number;        // 我给对方的评分 0-255
  ratingTag?: string;       // 评分维度
}

export interface AgentWallet {
  address: string;              // Agent Wallet 地址（TEE 内生成）
  personalAgentId: string;      // 绑定的 Personal Agent ID
  erc8004AgentId: number;       // ERC-8004 Identity NFT ID
  agentType: 'personal' | 'matchmaker' | 'arbitrator';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  createdAt: number;
  balances: {
    usdc: string;               // USDC 余额
    eth: string;                // ETH 余额
  };
  capabilities: string[];       // 已开通的能力
  teeAttestation?: string;      // TEE attestation hash
}

export interface FundingRecord {
  id: string;
  txHash: string;
  from: 'MAIN_WALLET' | 'EXTERNAL';
  amount: string;
  token: 'USDC' | 'ETH';
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  depositId: string;
  content: string;
  timestamp: number;
  type: 'TEXT' | 'PHOTO' | 'CONTACT' | 'AGREEMENT' | 'SERVICE_CARD' | 'SYSTEM';
  serviceItem?: ServiceItem;  // 服务卡片消息
  photoUrl?: string;
  mppPayment?: {              // MPP 按条付费
    amount: string;
    token: string;
    txHash?: string;
  };
}

// ==========================================
// 支付分层
// ==========================================
export type PaymentTier = 'MPP' | 'X402' | 'PRIVACY';

export interface PaymentTierInfo {
  tier: PaymentTier;
  label: string;
  description: string;
  icon: string;
  color: string;
}

// ==========================================
// Agent 对话 & 链上生息
// ==========================================
export interface AgentChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  action?: AgentAction;        // Agent 执行的操作
}

export interface AgentAction {
  type: 'YIELD_DEPOSIT' | 'YIELD_WITHDRAW' | 'YIELD_SWITCH' | 'YIELD_INFO' | 'BALANCE_CHECK';
  protocol?: string;           // e.g. 'Aave', 'Compound', 'Lido'
  token?: string;
  amount?: string;
  apy?: string;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  txHash?: string;
}

export interface YieldPosition {
  id: string;
  protocol: string;
  protocolIcon: string;
  token: string;
  depositedAmount: string;
  currentValue: string;
  apy: string;
  earned: string;
  status: 'ACTIVE' | 'WITHDRAWING' | 'COMPLETED';
  depositedAt: number;
}
