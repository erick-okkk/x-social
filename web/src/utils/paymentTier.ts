/**
 * 支付分层路由
 *
 * MPP  (Machine Payment Protocol) — 微额 < $1（按条对话收费等）
 * x402 (HTTP 402 Payment Required)  — 中额 $1 ~ $50（Gate Fee、服务预约等）
 * PRIVACY (ZK Privacy Transaction)  — 大额 > $50（隐藏金额和身份）
 */
import { PaymentTier, PaymentTierInfo } from '../types';

const TIER_THRESHOLD_MPP = 1;       // < $1 走 MPP
const TIER_THRESHOLD_PRIVACY = 50;  // > $50 走隐私

const TIER_INFO: Record<PaymentTier, PaymentTierInfo> = {
  MPP: {
    tier: 'MPP',
    label: '即时支付',
    description: '自动扣款，无需确认',
    icon: '⚡',
    color: 'text-green-600 bg-green-50',
  },
  X402: {
    tier: 'X402',
    label: '标准支付',
    description: '确认后支付',
    icon: '💳',
    color: 'text-purple-600 bg-purple-50',
  },
  PRIVACY: {
    tier: 'PRIVACY',
    label: '隐私交易',
    description: '隐藏金额和身份',
    icon: '🛡️',
    color: 'text-indigo-600 bg-indigo-50',
  },
};

export function getPaymentTier(amountUSD: number): PaymentTier {
  if (amountUSD < TIER_THRESHOLD_MPP) return 'MPP';
  if (amountUSD > TIER_THRESHOLD_PRIVACY) return 'PRIVACY';
  return 'X402';
}

export function getPaymentTierInfo(tier: PaymentTier): PaymentTierInfo {
  return TIER_INFO[tier];
}

export function getTierForAmount(amountUSD: number): PaymentTierInfo {
  return TIER_INFO[getPaymentTier(amountUSD)];
}

export { TIER_THRESHOLD_MPP, TIER_THRESHOLD_PRIVACY };
