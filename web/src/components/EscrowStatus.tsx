import React from 'react';
import { Deposit } from '../types';
import { formatAmount, timeUntilExpiry } from '../utils/format';

interface EscrowStatusProps {
  deposit: Deposit;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '进行中',
  RELEASED: '已释放',
  REFUNDED: '已退款',
  EXPIRED: '已过期',
};

export function EscrowStatus({ deposit }: EscrowStatusProps) {
  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-blue-50 text-blue-600 border-blue-100',
    RELEASED: 'bg-green-50 text-green-600 border-green-100',
    REFUNDED: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    EXPIRED: 'bg-red-50 text-red-600 border-red-100',
  };

  const ruleProgress = deposit.totalRulesCount > 0
    ? Math.round((deposit.rulesMetCount / deposit.totalRulesCount) * 100)
    : 0;

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-900">托管 #{deposit.id}</h3>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[deposit.status]}`}>
          {STATUS_LABELS[deposit.status] || deposit.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-400">金额</p>
          <p className="text-xl font-bold text-purple-600">{formatAmount(deposit.amount)} USDC</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">剩余时间</p>
          <p className="text-base font-semibold text-gray-800">{timeUntilExpiry(deposit.expiresAt)}</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <p className="text-xs text-gray-400">规则进度</p>
          <p className="text-xs font-medium text-gray-700">
            {deposit.rulesMetCount}/{deposit.totalRulesCount} ({ruleProgress}%)
          </p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${ruleProgress}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-gray-400">规则集 ID: {deposit.ruleSetId}</p>
    </div>
  );
}
