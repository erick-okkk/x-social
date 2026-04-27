import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { CHAIN_ID, RPC_URL } from '../contracts/addresses';
import { Transaction, AgentWallet, FundingRecord } from '../types';
import { MOCK_TRANSACTIONS } from '../data/mockTransactions';
import { RatingModal } from '../components/RatingModal';
import { AgentWalletSetup } from '../components/AgentWalletSetup';
import { FundAgentWallet } from '../components/FundAgentWallet';
import { AgentChat } from '../components/AgentChat';

const TX_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  ESCROW_DEPOSIT:  { label: '托管锁定',   icon: '🔒', color: 'text-yellow-600' },
  ESCROW_RELEASE:  { label: '托管释放',   icon: '✅', color: 'text-green-600' },
  ESCROW_REFUND:   { label: '托管退款',   icon: '↩️', color: 'text-blue-600' },
  P2P_TRANSFER:    { label: '转账',       icon: '💸', color: 'text-purple-600' },
  PERMIT_APPROVE:  { label: '授权',         icon: '🔑', color: 'text-gray-600' },
};

const ESCROW_STATUS_LABELS: Record<string, { label: string; bg: string }> = {
  ACTIVE:   { label: '进行中', bg: 'bg-yellow-100 text-yellow-700' },
  RELEASED: { label: '已释放', bg: 'bg-green-100 text-green-700' },
  REFUNDED: { label: '已退款', bg: 'bg-blue-100 text-blue-700' },
  EXPIRED:  { label: '已过期', bg: 'bg-gray-100 text-gray-500' },
};

type TabKey = 'all' | 'escrow' | 'agent';

export function WalletPage() {
  const { address, connectWallet, chainId } = useWallet();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [ratingTx, setRatingTx] = useState<Transaction | null>(null);

  // Agent Wallet 状态
  const [agentWallet, setAgentWallet] = useState<AgentWallet | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [showAgentChat, setShowAgentChat] = useState(false);
  const [fundingHistory, setFundingHistory] = useState<FundingRecord[]>([]);

  // 主钱包 mock 余额
  const [mainBalance] = useState({ usdc: '128.50', eth: '0.15' });

  // 评分回调
  const handleRatingSubmit = (txId: string, score: number, tag: string) => {
    setTransactions(prev => prev.map(tx => {
      const target = prev.find(t => t.id === txId);
      if (target && tx.depositId === target.depositId) {
        return { ...tx, rated: true, myRating: score, ratingTag: tag };
      }
      return tx;
    }));
  };

  // 只有托管释放的交易才能评分
  const canRate = (tx: Transaction) =>
    !tx.rated &&
    tx.status === 'CONFIRMED' &&
    tx.escrowStatus === 'RELEASED' &&
    tx.type !== 'PERMIT_APPROVE';

  // Agent Wallet 注册完成
  const handleAgentWalletCreated = (wallet: AgentWallet) => {
    setAgentWallet(wallet);
    setShowSetup(false);
    // 自动弹出入金
    setTimeout(() => setShowFund(true), 300);
  };

  // Agent Wallet 入金完成
  const handleFund = (record: FundingRecord) => {
    setFundingHistory(prev => [record, ...prev]);
    if (agentWallet) {
      const newBal = { ...agentWallet.balances };
      if (record.token === 'USDC') {
        newBal.usdc = (parseFloat(newBal.usdc) + parseFloat(record.amount)).toFixed(2);
      } else {
        newBal.eth = (parseFloat(newBal.eth) + parseFloat(record.amount)).toFixed(4);
      }
      setAgentWallet({ ...agentWallet, balances: newBal });
    }
  };

  // 筛选
  const filteredTx = (() => {
    if (activeTab === 'escrow') return transactions.filter(tx => tx.type.startsWith('ESCROW'));
    if (activeTab === 'agent') return []; // Agent 操作暂为空，后续可扩展
    return transactions;
  })();

  // 待评分数量
  const pendingRatingCount = new Set(
    transactions.filter(canRate).map(tx => tx.depositId)
  ).size;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'escrow', label: 'Escrow' },
    { key: 'agent', label: 'Agent' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">钱包</h1>

        {!address ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">🔐</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">连接钱包</h2>
              <p className="text-sm text-gray-500 mb-6">连接钱包以开始使用 X-Social</p>
            </div>

            <button
              onClick={connectWallet}
              className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition text-sm"
            >
              连接 MetaMask
            </button>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">所需网络</h3>
              <div className="bg-gray-50 p-4 rounded-xl text-sm space-y-1.5">
                <p className="text-gray-500">
                  <span className="text-gray-700 font-medium">网络:</span> X Layer (Chain ID: {CHAIN_ID})
                </p>
                <p className="text-gray-500">
                  <span className="text-gray-700 font-medium">RPC:</span> <span className="text-xs">{RPC_URL}</span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 主钱包 */}
            <div className="bg-white rounded-2xl p-5 border-2 border-purple-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 text-lg">✓</span>
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">主钱包</h2>
                    <p className="text-xs text-gray-400">X Layer · {address.slice(0, 6)}...{address.slice(-4)}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(address)}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs rounded-lg transition border border-gray-200"
                >
                  复制
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-gray-900">${mainBalance.usdc}</div>
                  <div className="text-xs text-gray-400">USDC</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-gray-900">{mainBalance.eth}</div>
                  <div className="text-xs text-gray-400">ETH</div>
                </div>
              </div>
            </div>

            {/* Agent Wallet */}
            {!agentWallet ? (
              <div className="bg-white rounded-2xl p-5 border border-dashed border-purple-300">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-purple-50 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">🤖</span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">创建 Agent Wallet</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    让你的专属 Agent 代你完成支付和链上操作，省心又安全
                  </p>
                  <button
                    onClick={() => setShowSetup(true)}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition"
                  >
                    创建 Agent Wallet
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 border-2 border-blue-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 text-lg">🤖</span>
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Agent Wallet</h2>
                      <p className="text-xs text-gray-400">
                        {agentWallet.address.slice(0, 6)}...{agentWallet.address.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-green-600 font-medium">Active</span>
                  </div>
                </div>

                {/* Agent 余额 */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-gray-900">${agentWallet.balances.usdc}</div>
                    <div className="text-xs text-gray-400">USDC</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-gray-900">{agentWallet.balances.eth}</div>
                    <div className="text-xs text-gray-400">ETH</div>
                  </div>
                </div>

                {/* Agent 信息行 */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">类型</span>
                    <span className="text-gray-700">专属 Agent</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">已开通能力</span>
                    <span className="text-gray-700">{agentWallet.capabilities.length} 项</span>
                  </div>
                </div>

                {/* 能力标签 */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {agentWallet.capabilities.map(cap => {
                    const labels: Record<string, string> = {
                      sign_permit: '自动支付',
                      escrow_deposit: '资金托管',
                      rule_respond: '任务响应',
                      defi_basic: '资产管理',
                      cross_platform: '跨平台互通',
                    };
                    return (
                      <span key={cap} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                        {labels[cap] || cap}
                      </span>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFund(true)}
                    className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition"
                  >
                    入金
                  </button>
                  <button
                    onClick={() => setShowAgentChat(true)}
                    className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5"
                  >
                    🤖 对话
                  </button>
                </div>

                {/* 入金记录 */}
                {fundingHistory.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-2">最近入金</p>
                    <div className="space-y-1.5">
                      {fundingHistory.slice(0, 3).map(f => (
                        <div key={f.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">
                            {new Date(f.timestamp * 1000).toLocaleString()}
                          </span>
                          <span className="text-green-600 font-medium">+{f.amount} {f.token}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 待评分提醒 */}
            {pendingRatingCount > 0 && (
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⭐</span>
                  <div>
                    <p className="text-sm font-medium text-purple-800">
                      {pendingRatingCount} 笔交易待评分
                    </p>
                    <p className="text-xs text-purple-500">仅托管释放的交易可评分</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const first = transactions.find(canRate);
                    if (first) setRatingTx(first);
                  }}
                  className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg font-medium"
                >
                  去评分
                </button>
              </div>
            )}

            {/* 交易记录 */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">交易记录</h2>
                <span className="text-xs text-gray-400">{filteredTx.length} 笔</span>
              </div>

              <div className="px-5 pb-3 flex gap-2">
                {tabs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      activeTab === t.key
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="divide-y divide-gray-50">
                {activeTab === 'agent' ? (
                  <div className="text-center py-12">
                    <div className="text-3xl mb-2">🤖</div>
                    <p className="text-sm text-gray-400">
                      {agentWallet ? 'Agent 自动操作记录将在此显示' : '请先创建 Agent Wallet'}
                    </p>
                  </div>
                ) : filteredTx.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-3xl mb-2">📭</div>
                    <p className="text-sm text-gray-400">暂无交易记录</p>
                  </div>
                ) : (
                  filteredTx.map(tx => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      canRate={canRate(tx)}
                      onRate={() => setRatingTx(tx)}
                      onViewProfile={() => {
                        if (tx.counterparty.profileId) navigate(`/profile/${tx.counterparty.profileId}`);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 弹窗 */}
      {ratingTx && (
        <RatingModal
          transaction={ratingTx}
          onSubmit={handleRatingSubmit}
          onClose={() => setRatingTx(null)}
        />
      )}
      {showSetup && address && (
        <AgentWalletSetup
          mainWalletAddress={address}
          onComplete={handleAgentWalletCreated}
          onCancel={() => setShowSetup(false)}
        />
      )}
      {showFund && agentWallet && (
        <FundAgentWallet
          agentWallet={agentWallet}
          mainWalletBalance={mainBalance}
          onFund={handleFund}
          onClose={() => setShowFund(false)}
        />
      )}
      {showAgentChat && agentWallet && (
        <AgentChat
          agentWalletAddress={agentWallet.address}
          balances={agentWallet.balances}
          onClose={() => setShowAgentChat(false)}
        />
      )}
    </div>
  );
}

// ==========================================
// 交易行
// ==========================================
function TransactionRow({
  tx,
  canRate,
  onRate,
  onViewProfile,
}: {
  tx: Transaction;
  canRate: boolean;
  onRate: () => void;
  onViewProfile: () => void;
}) {
  const typeInfo = TX_TYPE_LABELS[tx.type] || { label: tx.type, icon: '📋', color: 'text-gray-600' };
  const escrowInfo = tx.escrowStatus ? ESCROW_STATUS_LABELS[tx.escrowStatus] : null;
  const isOutgoing = tx.type === 'ESCROW_DEPOSIT' || tx.type === 'P2P_TRANSFER' || tx.type === 'PERMIT_APPROVE';

  return (
    <div className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition">
      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-lg flex-shrink-0">
        {typeInfo.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onViewProfile}
            className="text-sm font-medium text-gray-900 truncate hover:text-purple-600 transition"
          >
            {tx.counterparty.name}
          </button>
          {escrowInfo && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${escrowInfo.bg}`}>
              {escrowInfo.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs ${typeInfo.color}`}>{typeInfo.label}</span>
          {tx.serviceName && <span className="text-xs text-gray-400">· {tx.serviceName}</span>}
        </div>
        <p className="text-[10px] text-gray-300 mt-0.5">
          {new Date(tx.timestamp * 1000).toLocaleString()}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-sm font-bold ${isOutgoing ? 'text-red-500' : 'text-green-600'}`}>
          {isOutgoing ? '-' : '+'}{tx.amount} {tx.token}
        </div>
        {tx.rated && tx.myRating !== undefined ? (
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[10px] text-gray-400">信誉</span>
            <span className={`text-xs font-bold ${
              tx.myRating >= 200 ? 'text-green-600' : tx.myRating >= 128 ? 'text-yellow-600' : 'text-red-500'
            }`}>
              {tx.myRating}
            </span>
          </div>
        ) : canRate ? (
          <button
            onClick={(e) => { e.stopPropagation(); onRate(); }}
            className="mt-1 text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium hover:bg-purple-100 transition"
          >
            去评分
          </button>
        ) : null}
      </div>
    </div>
  );
}
