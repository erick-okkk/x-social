import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rule, PaymentTier } from '../types';
import { getPaymentTier, getTierForAmount, TIER_THRESHOLD_MPP, TIER_THRESHOLD_PRIVACY } from '../utils/paymentTier';

interface PaymentModalProps {
  isOpen: boolean;
  profileName: string;
  amount: string;
  serviceName?: string;
  serviceIcon?: string;
  rules?: Rule[];          // 规则集：完成哪些才能释放
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

const RULE_LABELS: Record<string, string> = {
  CONVERSATION: '完成对话',
  PHOTO_EXCHANGE: '交换照片',
  CONTACT_SHARED: '交换联系方式',
  SEND_LOCATION: '发送见面位置',
  DUAL_CHECKIN: '双方到达签到',
  VIDEO_CALL: '完成视频通话',
  TRANSFER: '完成转账',
};

const RULE_ICONS: Record<string, string> = {
  CONVERSATION: '💬',
  PHOTO_EXCHANGE: '📸',
  CONTACT_SHARED: '📱',
  SEND_LOCATION: '📍',
  DUAL_CHECKIN: '✅',
  VIDEO_CALL: '📹',
  TRANSFER: '💸',
};

export function PaymentModal({
  isOpen,
  profileName,
  amount,
  serviceName,
  serviceIcon,
  rules,
  onConfirm,
  onCancel,
  isLoading,
}: PaymentModalProps) {
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState<'usdc' | 'eth'>('usdc');
  const [privacyOverride, setPrivacyOverride] = useState(false);

  if (!isOpen) return null;

  const finalAmount = parseFloat(amount);

  // 自动路由支付层级
  const autoTier = getPaymentTier(finalAmount);
  const tierInfo = getTierForAmount(finalAmount);

  // 用户可以在中额时主动开启隐私（升级到 PRIVACY），但不能降级
  const effectiveTier: PaymentTier = (autoTier === 'X402' && privacyOverride) ? 'PRIVACY' : autoTier;
  const isPrivacy = effectiveTier === 'PRIVACY';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md mx-0 sm:mx-4 overflow-hidden">
        {/* 标题 */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">确认支付</h2>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>

          {/* 服务信息 */}
          <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
            {serviceIcon && <span className="text-3xl">{serviceIcon}</span>}
            <div>
              <p className="text-sm text-gray-500">支付给 {profileName}</p>
              {serviceName && <p className="text-base font-semibold text-gray-900">{serviceName}</p>}
            </div>
          </div>
        </div>

        {/* 金额 + 支付层级标签 */}
        <div className="px-6 pb-4">
          <div className="text-center py-4">
            <p className="text-4xl font-bold text-gray-900">${amount}</p>
            <p className="text-sm text-gray-500 mt-1">USDC</p>
          </div>

          {/* 支付协议标签 */}
          <div className="flex justify-center mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              isPrivacy
                ? 'bg-indigo-50 text-indigo-600'
                : autoTier === 'MPP'
                  ? 'bg-green-50 text-green-600'
                  : 'bg-purple-50 text-purple-600'
            }`}>
              <span>{isPrivacy ? '🛡️' : tierInfo.icon}</span>
              {isPrivacy ? '隐私交易' : tierInfo.label}
              <span className="text-[10px] opacity-70">
                ({autoTier === 'MPP' ? 'MPP' : autoTier === 'X402' ? 'x402' : 'ZK Privacy'})
              </span>
            </span>
          </div>

          {/* 规则集 — 完成这些任务才能释放资金 */}
          {rules && rules.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2">完成以下任务后资金释放给对方</p>
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="text-base">{RULE_ICONS[rule.type] || '📋'}</span>
                    <div className="flex-1">
                      <span className="text-sm text-gray-800">
                        {RULE_LABELS[rule.type] || rule.description}
                      </span>
                      {rule.minValue && rule.type === 'CONVERSATION' && (
                        <span className="text-xs text-gray-400 ml-1">（至少 {rule.minValue} 条）</span>
                      )}
                      {rule.minValue && rule.type === 'VIDEO_CALL' && (
                        <span className="text-xs text-gray-400 ml-1">（至少 {Math.round(rule.minValue / 60)} 分钟）</span>
                      )}
                    </div>
                    {rule.required ? (
                      <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">必须</span>
                    ) : (
                      <span className="text-[10px] bg-green-50 text-green-500 px-1.5 py-0.5 rounded">加分</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 支付方式 */}
          <div className="space-y-2 mb-4">
            <p className="text-xs font-medium text-gray-500">支付方式</p>
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition">
              <input
                type="radio"
                name="paymentMethod"
                value="usdc"
                checked={paymentMethod === 'usdc'}
                onChange={() => setPaymentMethod('usdc')}
                className="w-4 h-4 text-purple-600"
              />
              <div>
                <span className="text-sm text-gray-800 font-medium">USDC 支付</span>
                <p className="text-xs text-gray-400">免手续费</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition">
              <input
                type="radio"
                name="paymentMethod"
                value="eth"
                checked={paymentMethod === 'eth'}
                onChange={() => setPaymentMethod('eth')}
                className="w-4 h-4 text-purple-600"
              />
              <div>
                <span className="text-sm text-gray-800 font-medium">ETH 支付</span>
                <p className="text-xs text-gray-400">需少量手续费</p>
              </div>
            </label>
          </div>

          {/* 中额支付：可选升级到隐私交易 */}
          {autoTier === 'X402' && (
            <div className="mb-4">
              <button
                onClick={() => setPrivacyOverride(!privacyOverride)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition ${
                  privacyOverride
                    ? 'bg-indigo-50 border-indigo-200'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🛡️</span>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-800">升级隐私交易</p>
                    <p className="text-xs text-gray-400">隐藏支付金额和双方身份</p>
                  </div>
                </div>
                <div className={`w-11 h-6 rounded-full p-0.5 transition ${
                  privacyOverride ? 'bg-indigo-500' : 'bg-gray-300'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    privacyOverride ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </div>
              </button>
              {privacyOverride && (
                <p className="text-xs text-indigo-500 mt-2 px-1">
                  交易金额和参与双方将通过零知识证明隐藏，链上仅可验证交易有效性。
                </p>
              )}
            </div>
          )}

          {/* 大额自动隐私说明 */}
          {autoTier === 'PRIVACY' && (
            <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <p className="text-xs text-indigo-600">
                🛡️ 大额交易已自动开启隐私保护。交易金额和参与双方通过零知识证明隐藏，链上仅可验证交易有效性。
              </p>
            </div>
          )}

          {/* 安全提示 */}
          <div className="bg-purple-50 rounded-xl p-3 mb-4">
            <p className="text-xs text-purple-700">
              <span className="font-semibold">安全保障：</span>
              资金托管在智能合约中，完成上述任务后才释放给对方。未完成可申请退款。
            </p>
          </div>

          {/* 支付分层说明 */}
          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <p className="text-[10px] text-gray-400 leading-relaxed">
              支付路由：&lt;${TIER_THRESHOLD_MPP} 即时支付(MPP) · ${TIER_THRESHOLD_MPP}-${TIER_THRESHOLD_PRIVACY} 标准支付(x402) · &gt;${TIER_THRESHOLD_PRIVACY} 隐私交易(ZK)
            </p>
          </div>
        </div>

        {/* 按钮 */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition font-medium disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={() => {
              if (isPrivacy) {
                onCancel();
                navigate(`/privacy-pay?to=${encodeURIComponent(profileName)}&amount=${amount}&service=${encodeURIComponent(serviceName || '')}`);
              } else {
                onConfirm();
              }
            }}
            disabled={isLoading}
            className={`flex-1 py-3 text-white rounded-xl transition font-semibold disabled:opacity-50 ${
              isPrivacy
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isLoading ? '处理中...' : isPrivacy ? '🛡️ 隐私支付' : `${tierInfo.icon} 确认支付`}
          </button>
        </div>
      </div>
    </div>
  );
}
