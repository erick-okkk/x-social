/**
 * Agent Wallet 入金弹窗
 *
 * 两种入金方式：
 *   1. 从主钱包转入（内部转账）
 *   2. 外部转入（显示 Agent Wallet 收款地址）
 *
 * 对应 DESIGN.md：
 *   资金从用户 Agentic Wallet 直接进 Escrow 合约
 *   Agentic Wallet 签 Permit → Relayer 代提交
 */
import React, { useState } from 'react';
import { AgentWallet, FundingRecord } from '../types';

interface Props {
  agentWallet: AgentWallet;
  mainWalletBalance: { usdc: string; eth: string };
  onFund: (record: FundingRecord) => void;
  onClose: () => void;
}

type FundMethod = 'internal' | 'external';
type FundToken = 'USDC' | 'ETH';

export function FundAgentWallet({ agentWallet, mainWalletBalance, onFund, onClose }: Props) {
  const [method, setMethod] = useState<FundMethod>('internal');
  const [token, setToken] = useState<FundToken>('USDC');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const maxBalance = token === 'USDC' ? parseFloat(mainWalletBalance.usdc) : parseFloat(mainWalletBalance.eth);
  const inputAmount = parseFloat(amount) || 0;
  const isValid = inputAmount > 0 && inputAmount <= maxBalance;

  const handleSubmit = () => {
    if (!isValid) return;
    setSubmitting(true);
    setTimeout(() => {
      const record: FundingRecord = {
        id: `fund-${Date.now()}`,
        txHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        from: 'MAIN_WALLET',
        amount,
        token,
        status: 'CONFIRMED',
        timestamp: Math.floor(Date.now() / 1000),
      };
      onFund(record);
      setSubmitting(false);
      setSuccess(true);
    }, 1500);
  };

  const handleSetMax = () => {
    setAmount(token === 'USDC' ? mainWalletBalance.usdc : mainWalletBalance.eth);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden">

        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Agent Wallet 入金</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {success ? (
          <div className="px-5 pb-6 text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">入金成功</h3>
            <p className="text-sm text-gray-500 mb-1">
              已向 Agent Wallet 转入
            </p>
            <div className="text-2xl font-bold text-purple-600 mb-4">
              {amount} {token}
            </div>
            <p className="text-xs text-gray-400 mb-6">
              Agent 现在可以自动执行 Escrow 入金、Gate Fee 支付等链上操作
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium"
            >
              完成
            </button>
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-4">
            {/* Agent Wallet 当前余额 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2">Agent Wallet 当前余额</p>
              <div className="flex gap-4">
                <div>
                  <span className="text-lg font-bold text-gray-900">${agentWallet.balances.usdc}</span>
                  <span className="text-xs text-gray-400 ml-1">USDC</span>
                </div>
                <div>
                  <span className="text-lg font-bold text-gray-900">{agentWallet.balances.eth}</span>
                  <span className="text-xs text-gray-400 ml-1">ETH</span>
                </div>
              </div>
            </div>

            {/* 入金方式 */}
            <div>
              <p className="text-xs text-gray-500 mb-2">入金方式</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMethod('internal')}
                  className={`p-3 rounded-xl border text-center transition ${
                    method === 'internal'
                      ? 'bg-purple-50 border-purple-200'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-lg mb-1">💰</div>
                  <p className="text-xs font-medium text-gray-800">从主钱包转入</p>
                </button>
                <button
                  onClick={() => setMethod('external')}
                  className={`p-3 rounded-xl border text-center transition ${
                    method === 'external'
                      ? 'bg-purple-50 border-purple-200'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-lg mb-1">📥</div>
                  <p className="text-xs font-medium text-gray-800">外部转入</p>
                </button>
              </div>
            </div>

            {method === 'internal' ? (
              <>
                {/* 选择代币 */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">选择代币</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setToken('USDC'); setAmount(''); }}
                      className={`p-3 rounded-xl border transition flex items-center gap-2 ${
                        token === 'USDC' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <span className="text-lg">💵</span>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-800">USDC</p>
                        <p className="text-xs text-gray-400">余额 ${mainWalletBalance.usdc}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { setToken('ETH'); setAmount(''); }}
                      className={`p-3 rounded-xl border transition flex items-center gap-2 ${
                        token === 'ETH' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <span className="text-lg">⟠</span>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-800">ETH</p>
                        <p className="text-xs text-gray-400">余额 {mainWalletBalance.eth}</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 输入金额 */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">转入金额</p>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg text-gray-900 font-medium placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-200 pr-20"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button
                        onClick={handleSetMax}
                        className="text-xs text-purple-600 font-medium hover:text-purple-700"
                      >
                        MAX
                      </button>
                      <span className="text-sm text-gray-400">{token}</span>
                    </div>
                  </div>
                  {inputAmount > maxBalance && (
                    <p className="text-xs text-red-500 mt-1">余额不足</p>
                  )}
                </div>

                {/* 快捷金额 */}
                <div className="flex gap-2">
                  {(token === 'USDC' ? ['10', '50', '100'] : ['0.01', '0.05', '0.1']).map(val => (
                    <button
                      key={val}
                      onClick={() => setAmount(val)}
                      className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-gray-600 font-medium transition border border-gray-200"
                    >
                      {val} {token}
                    </button>
                  ))}
                </div>

                {/* 提交 */}
                <button
                  onClick={handleSubmit}
                  disabled={!isValid || submitting}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50"
                >
                  {submitting
                    ? '转账中...'
                    : isValid
                      ? `确认转入 ${amount} ${token}`
                      : '输入金额'}
                </button>
              </>
            ) : (
              /* 外部转入 — 显示收款地址 */
              <>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400 mb-3">Agent Wallet 收款地址</p>
                  <div className="bg-white rounded-lg p-3 border border-gray-200 mb-3">
                    <code className="text-xs text-purple-600 font-mono break-all">
                      {agentWallet.address}
                    </code>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(agentWallet.address)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition"
                  >
                    复制地址
                  </button>
                </div>

                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                  <p className="text-xs text-yellow-700">
                    请确保从 X Layer 网络转入 USDC 或 ETH。其他网络转入的资产可能丢失。
                  </p>
                </div>
              </>
            )}

            {/* 安全说明 */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs text-blue-600">
                Agent Wallet 资金由安全芯片保护。Agent 可自动使用这些资金完成托管入金和服务付款，但无法将资金转出到非授权地址。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
