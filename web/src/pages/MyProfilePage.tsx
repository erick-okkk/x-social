/**
 * 统一「我的」页面
 * 合并原 MyProfilePage + WalletPage + RulesPage
 * 区块：Profile → 资产 → Agent Wallet → 交易记录 → 规则管理
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useZKRegistry } from '../hooks/useZKRegistry';
import { CHAIN_ID, RPC_URL } from '../contracts/addresses';
import { Tag, TagType, Transaction, AgentWallet, FundingRecord, ServiceItem, ActiveOrder } from '../types';
import { TagBadge } from '../components/TagBadge';
import { MOCK_TRANSACTIONS } from '../data/mockTransactions';
import { RatingModal } from '../components/RatingModal';
import { AgentWalletSetup } from '../components/AgentWalletSetup';
import { FundAgentWallet } from '../components/FundAgentWallet';
import { AgentChat } from '../components/AgentChat';

// ==========================================
// ZK 认证相关
// ==========================================
interface CertOption {
  type: TagType;
  label: string;
  icon: string;
  description: string;
  provider: string;       // 数据提供方
  proofTime: string;      // 预估出证时间
}

const CERT_OPTIONS: CertOption[] = [
  { type: 'IDENTITY', label: '身份认证', icon: '🪪', description: '证明你是真人，不泄露姓名和证件号', provider: '政府 eID / 护照 NFC', proofTime: '~30 秒' },
  { type: 'EDUCATION', label: '学历认证', icon: '🎓', description: '证明学历层次（本科/硕士/博士），不泄露学校和专业', provider: '学信网 / 学位证书', proofTime: '~1 分钟' },
  { type: 'HEALTH', label: '体检认证', icon: '🏥', description: '证明近期体检合格，不泄露具体指标', provider: '医院体检报告', proofTime: '~2 分钟' },
  { type: 'INCOME', label: '收入认证', icon: '💰', description: '证明收入区间，不泄露具体金额和雇主', provider: '银行流水 / 税单', proofTime: '~1 分钟' },
  { type: 'WORK', label: '工作认证', icon: '💼', description: '证明在职状态和行业，不泄露公司名称', provider: '社保记录 / 在职证明', proofTime: '~1 分钟' },
  { type: 'SOCIAL', label: '社交信用', icon: '👥', description: '证明链上社交活跃度和信誉历史', provider: '链上交互记录', proofTime: '~15 秒' },
];

type ZKProofStep = 'idle' | 'selecting' | 'uploading' | 'generating' | 'submitting' | 'done' | 'failed';

interface ZKProofState {
  step: ZKProofStep;
  selectedType: TagType | null;
  progress: number;       // 0-100
  proofHash?: string;
  error?: string;
}

// ==========================================
// 交易类型 & Escrow 状态标签
// ==========================================
const TX_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  ESCROW_DEPOSIT:  { label: '托管锁定',   icon: '🔒', color: 'text-yellow-600' },
  ESCROW_RELEASE:  { label: '托管释放',   icon: '✅', color: 'text-green-600' },
  ESCROW_REFUND:   { label: '托管退款',   icon: '↩️', color: 'text-blue-600' },
  P2P_TRANSFER:    { label: '转账',       icon: '💸', color: 'text-purple-600' },
  PERMIT_APPROVE:  { label: '授权',       icon: '🔑', color: 'text-gray-600' },
};

const ESCROW_STATUS_LABELS: Record<string, { label: string; bg: string }> = {
  ACTIVE:   { label: '进行中', bg: 'bg-yellow-100 text-yellow-700' },
  RELEASED: { label: '已释放', bg: 'bg-green-100 text-green-700' },
  REFUNDED: { label: '已退款', bg: 'bg-blue-100 text-blue-700' },
  EXPIRED:  { label: '已过期', bg: 'bg-gray-100 text-gray-500' },
};


export function MyProfilePage() {
  const { address, connectWallet } = useWallet();
  const navigate = useNavigate();
  const { getUserTags, loading } = useZKRegistry();

  // Profile
  const [myTags, setMyTags] = useState<Tag[]>([]);
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [messageFee, setMessageFee] = useState('0.01');

  // 资产
  const [mainBalance] = useState({ usdc: '128.50', eth: '0.15' });

  // Agent Wallet
  const [agentWallet, setAgentWallet] = useState<AgentWallet | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [showAgentChat, setShowAgentChat] = useState(false);
  const [fundingHistory, setFundingHistory] = useState<FundingRecord[]>([]);

  // 交易 & 评分
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [ratingTx, setRatingTx] = useState<Transaction | null>(null);
  const [showAllTx, setShowAllTx] = useState(false);

  // ZK 认证流程
  const [showCertPanel, setShowCertPanel] = useState(false);
  const [zkProof, setZkProof] = useState<ZKProofState>({ step: 'idle', selectedType: null, progress: 0 });

  // 我的服务卡片
  const [myServices, setMyServices] = useState<ServiceItem[]>([]);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [newService, setNewService] = useState({ name: '', description: '', icon: '🎯', price: '', category: 'service' as ServiceItem['category'] });
  const [publishingService, setPublishingService] = useState(false);

  // 进行中的订单
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([
    {
      id: 'order-1',
      serviceId: 's1',
      serviceName: '摄影指导',
      serviceIcon: '📸',
      counterparty: { name: 'Alice', profileId: '1', photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
      role: 'consumer',
      amount: '20',
      escrowAddress: '0xEscrow001',
      status: 'PENDING_CHECKIN',
      myCheckedIn: false,
      counterpartyCheckedIn: false,
      serviceConfirmedByConsumer: false,
      createdAt: Math.floor(Date.now() / 1000) - 3600,
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
      isOffline: true,
      location: '朝阳区 · 三里屯太古里南区 B1 层星巴克',
    },
    {
      id: 'order-2',
      serviceId: 's4',
      serviceName: '技术咨询',
      serviceIcon: '💻',
      counterparty: { name: 'Bob', profileId: '2' },
      role: 'consumer',
      amount: '50',
      escrowAddress: '0xEscrow002',
      status: 'IN_PROGRESS',
      myCheckedIn: true,
      counterpartyCheckedIn: true,
      serviceConfirmedByConsumer: false,
      createdAt: Math.floor(Date.now() / 1000) - 7200,
      expiresAt: Math.floor(Date.now() / 1000) + 43200,
      isOffline: false,
    },
  ]);

  // 折叠区域
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    const loadTags = async () => {
      const tags = await getUserTags('0x' + Math.random().toString(16).slice(2));
      setMyTags(tags);
    };
    loadTags();
  }, [address, getUserTags]);

  const canRate = (tx: Transaction) =>
    !tx.rated && tx.status === 'CONFIRMED' && tx.escrowStatus === 'RELEASED' && tx.type !== 'PERMIT_APPROVE';

  const pendingRatingCount = new Set(transactions.filter(canRate).map(tx => tx.depositId)).size;

  const handleRatingSubmit = (txId: string, score: number, tag: string) => {
    setTransactions(prev => prev.map(tx => {
      const target = prev.find(t => t.id === txId);
      if (target && tx.depositId === target.depositId) {
        return { ...tx, rated: true, myRating: score, ratingTag: tag };
      }
      return tx;
    }));
  };

  const handleAgentWalletCreated = (wallet: AgentWallet) => {
    setAgentWallet(wallet);
    setShowSetup(false);
    setTimeout(() => setShowFund(true), 300);
  };

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

  // 模拟 ZK 认证流程
  const startZKCert = useCallback((type: TagType) => {
    setZkProof({ step: 'selecting', selectedType: type, progress: 0 });

    // 模拟上传步骤
    setTimeout(() => {
      setZkProof(prev => ({ ...prev, step: 'uploading', progress: 20 }));
    }, 500);

    // 模拟 ZK 证明生成
    setTimeout(() => {
      setZkProof(prev => ({ ...prev, step: 'generating', progress: 50 }));
    }, 1500);

    // 模拟进度推进
    setTimeout(() => {
      setZkProof(prev => ({ ...prev, progress: 75 }));
    }, 2500);

    // 模拟链上提交
    setTimeout(() => {
      setZkProof(prev => ({ ...prev, step: 'submitting', progress: 90 }));
    }, 3500);

    // 完成
    setTimeout(() => {
      const proofHash = '0x' + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setZkProof(prev => ({ ...prev, step: 'done', progress: 100, proofHash }));

      // 添加到已认证标签
      const opt = CERT_OPTIONS.find(o => o.type === type);
      if (opt) {
        const newTag: Tag = {
          type,
          verified: true,
          issuedAt: Math.floor(Date.now() / 1000),
          expiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
          label: opt.label,
        };
        setMyTags(prev => {
          if (prev.some(t => t.type === type)) return prev;
          return [...prev, newTag];
        });
      }
    }, 4500);
  }, []);

  const resetZKProof = () => {
    setZkProof({ step: 'idle', selectedType: null, progress: 0 });
  };

  // 发布服务卡片
  const handlePublishService = useCallback(() => {
    if (!newService.name || !newService.price) return;
    setPublishingService(true);
    // 模拟链上发布
    setTimeout(() => {
      const svc: ServiceItem = {
        id: 'my-' + Date.now(),
        name: newService.name,
        description: newService.description,
        icon: newService.icon,
        price: newService.price,
        priceWei: (parseFloat(newService.price) * 1000000).toString(),
        ruleSetId: '',
        category: newService.category,
      };
      setMyServices(prev => [...prev, svc]);
      setNewService({ name: '', description: '', icon: '🎯', price: '', category: 'service' });
      setShowServiceForm(false);
      setPublishingService(false);
    }, 1500);
  }, [newService]);

  const removeService = (id: string) => {
    setMyServices(prev => prev.filter(s => s.id !== id));
  };

  // 订单操作：签到
  const handleCheckin = useCallback((orderId: string) => {
    setActiveOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const updated = { ...o, myCheckedIn: true };
      // 如果双方都签到了，进入 IN_PROGRESS
      if (updated.myCheckedIn && updated.counterpartyCheckedIn) {
        updated.status = 'IN_PROGRESS';
      } else {
        updated.status = 'CHECKED_IN';
      }
      return updated;
    }));
    // 模拟对方 2 秒后签到
    setTimeout(() => {
      setActiveOrders(prev => prev.map(o => {
        if (o.id !== orderId) return o;
        if (o.counterpartyCheckedIn) return o;
        const updated = { ...o, counterpartyCheckedIn: true };
        if (updated.myCheckedIn && updated.counterpartyCheckedIn) {
          updated.status = 'IN_PROGRESS';
        }
        return updated;
      }));
    }, 2000);
  }, []);

  // 订单操作：确认服务完成（消费方）
  const handleConfirmComplete = useCallback((orderId: string) => {
    setActiveOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, status: 'PENDING_CONFIRM', serviceConfirmedByConsumer: true };
    }));
    // 模拟 Platform Agent 审核 + escrow 释放
    setTimeout(() => {
      setActiveOrders(prev => prev.map(o => {
        if (o.id !== orderId) return o;
        return { ...o, status: 'COMPLETED' };
      }));
    }, 2500);
  }, []);

  // 订单操作：发起争议
  const handleDispute = useCallback((orderId: string) => {
    setActiveOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, status: 'DISPUTED' };
    }));
  }, []);

  const alreadyCertified = (type: TagType) => myTags.some(t => t.type === type && t.verified);

  const visibleTx = showAllTx ? transactions : transactions.slice(0, 5);

  // 未连接钱包
  if (!address) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">我的</h1>
          <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
            <div className="text-5xl mb-4">🔐</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">连接钱包</h2>
            <p className="text-sm text-gray-500 mb-6">连接钱包以开始使用</p>
            <button onClick={connectWallet} className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition text-sm">
              连接 MetaMask
            </button>
            <div className="mt-5 pt-5 border-t border-gray-100 text-xs text-gray-400">
              X Layer (Chain ID: {CHAIN_ID})
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ====== Profile 头部 ====== */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-3">
          <div className="flex items-center gap-4 mb-4">
            <img src="/avatar-user.png" alt="avatar" className="w-16 h-16 rounded-full object-cover shadow-sm" />
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="输入昵称"
                className="text-lg font-bold text-gray-900 bg-transparent focus:outline-none focus:border-b-2 focus:border-purple-300 w-full placeholder-gray-300"
              />
              <p className="text-xs text-gray-400 mt-0.5 font-mono">{address.slice(0, 8)}...{address.slice(-6)}</p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(address)}
              className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs rounded-lg transition border border-gray-200"
            >
              复制
            </button>
          </div>

          {/* 简介 */}
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="介绍一下自己..."
            rows={2}
            className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none mb-3"
          />

          {/* 消息收费设置 */}
          <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚡</span>
              <div>
                <p className="text-sm font-medium text-green-800">每条消息收费</p>
                <p className="text-[10px] text-green-600">打招呼时对方按条付费 (MPP)</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-green-600">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={messageFee}
                onChange={(e) => setMessageFee(e.target.value)}
                className="w-16 text-right bg-white border border-green-200 rounded-lg px-2 py-1 text-sm text-green-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-200"
              />
              <span className="text-xs text-green-500">/条</span>
            </div>
          </div>
        </div>

        {/* ====== 认证标签 ====== */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">认证标签</h2>
            <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
              {myTags.filter(t => t.verified).length} / {CERT_OPTIONS.length} 项已认证
            </span>
          </div>

          {/* 已认证标签展示 */}
          {loading ? (
            <p className="text-gray-400 text-sm">加载中...</p>
          ) : myTags.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {myTags.map((tag, i) => <TagBadge key={i} tag={tag} />)}
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 mb-3">
              <span className="text-2xl">🏷️</span>
              <div>
                <p className="text-sm text-gray-500">还没有认证标签</p>
                <p className="text-xs text-gray-400">ZK 认证后可提高信任度和交互折扣</p>
              </div>
            </div>
          )}

          {/* 添加认证按钮 */}
          <button
            onClick={() => setShowCertPanel(!showCertPanel)}
            className={`w-full py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 ${
              showCertPanel
                ? 'bg-gray-100 text-gray-600'
                : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-100'
            }`}
          >
            <span>{showCertPanel ? '收起' : '🛡️ 选择认证项目'}</span>
            <span className={`transition-transform text-xs ${showCertPanel ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {/* 认证项目选择面板 */}
          {showCertPanel && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-400 mb-1">选择要认证的项目，使用 ZK 零知识证明完成验证：</p>

              {CERT_OPTIONS.map(opt => {
                const certified = alreadyCertified(opt.type);
                const isProcessing = zkProof.selectedType === opt.type && zkProof.step !== 'idle' && zkProof.step !== 'done' && zkProof.step !== 'failed';

                return (
                  <div
                    key={opt.type}
                    className={`p-3.5 rounded-xl border transition ${
                      certified
                        ? 'bg-green-50 border-green-100'
                        : isProcessing
                          ? 'bg-purple-50 border-purple-200'
                          : 'bg-gray-50 border-gray-100 hover:border-purple-200 hover:bg-purple-50/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">{opt.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                          {certified && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">已认证</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-gray-400">数据源: {opt.provider}</span>
                          <span className="text-[10px] text-gray-400">耗时: {opt.proofTime}</span>
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex-shrink-0">
                        {certified ? (
                          <span className="text-green-500 text-lg">✓</span>
                        ) : isProcessing ? (
                          <div className="w-8 h-8 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
                        ) : (
                          <button
                            onClick={() => startZKCert(opt.type)}
                            disabled={zkProof.step !== 'idle' && zkProof.step !== 'done' && zkProof.step !== 'failed'}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg font-medium transition disabled:opacity-40"
                          >
                            认证
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ZK 证明生成进度 */}
                    {isProcessing && (
                      <div className="mt-3 ml-9">
                        {/* 进度条 */}
                        <div className="w-full bg-purple-100 rounded-full h-1.5 mb-2">
                          <div
                            className="h-1.5 rounded-full bg-purple-500 transition-all duration-500"
                            style={{ width: `${zkProof.progress}%` }}
                          />
                        </div>
                        {/* 步骤说明 */}
                        <div className="flex items-center gap-4">
                          <ZKStepIndicator label="数据上传" active={zkProof.step === 'uploading'} done={['generating', 'submitting', 'done'].includes(zkProof.step)} />
                          <ZKStepIndicator label="生成 ZK Proof" active={zkProof.step === 'generating'} done={['submitting', 'done'].includes(zkProof.step)} />
                          <ZKStepIndicator label="链上提交" active={zkProof.step === 'submitting'} done={zkProof.step === 'done'} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ZK 认证完成提示 */}
              {zkProof.step === 'done' && zkProof.proofHash && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3.5 flex items-start gap-3">
                  <span className="text-xl">🎉</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">认证成功！</p>
                    <p className="text-xs text-green-600 mt-0.5">ZK Proof 已写入链上，隐私数据未泄露</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] text-green-500 font-mono bg-green-100 px-2 py-0.5 rounded">
                        Proof: {zkProof.proofHash}...
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={resetZKProof}
                    className="text-xs text-green-600 hover:text-green-700 font-medium"
                  >
                    关闭
                  </button>
                </div>
              )}

              {/* ZK 原理说明 */}
              <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-2.5">
                <span className="text-sm mt-0.5">🔐</span>
                <div>
                  <p className="text-xs font-medium text-gray-700">ZK 零知识证明如何保护你的隐私？</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
                    你的原始数据仅在本地设备上处理，链上只存储加密后的证明结果。对方只能看到「已认证」状态，无法获取任何个人信息。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ====== 资产 ====== */}
        <div className="bg-white rounded-2xl p-5 border-2 border-purple-100 mb-3">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">资产</h2>
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

        {/* ====== Agent Wallet ====== */}
        {!agentWallet ? (
          <div className="bg-white rounded-2xl p-5 border border-dashed border-purple-300 mb-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🤖</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">创建 Agentic Wallet</h3>
                <p className="text-xs text-gray-500">让 Agent 代你完成支付和链上操作</p>
              </div>
              <button
                onClick={() => setShowSetup(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-medium transition"
              >
                创建
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 border-2 border-blue-100 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 text-lg">🤖</span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Agentic Wallet</h2>
                  <p className="text-xs text-gray-400">{agentWallet.address.slice(0, 8)}...{agentWallet.address.slice(-6)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-green-600 font-medium">Active</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-gray-900">${agentWallet.balances.usdc}</div>
                <div className="text-xs text-gray-400">USDC</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-gray-900">{agentWallet.balances.eth}</div>
                <div className="text-xs text-gray-400">ETH</div>
              </div>
            </div>

            {/* 能力标签 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {agentWallet.capabilities.map(cap => {
                const labels: Record<string, string> = {
                  sign_permit: '自动支付', escrow_deposit: '资金托管', rule_respond: '任务响应',
                  defi_basic: '资产管理', cross_platform: '跨平台互通',
                };
                return (
                  <span key={cap} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                    {labels[cap] || cap}
                  </span>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowFund(true)} className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition">
                入金
              </button>
              <button onClick={() => setShowAgentChat(true)} className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5">
                🤖 对话
              </button>
            </div>
          </div>
        )}

        {/* ====== 我的服务卡片 (Agentic Wallet 创建后可用) ====== */}
        {agentWallet && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">我的服务</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">发布服务卡片，让其他用户预约你</p>
              </div>
              <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                {myServices.length} 个服务
              </span>
            </div>

            {/* 已发布的服务列表 */}
            {myServices.length > 0 && (
              <div className="space-y-2 mb-3">
                {myServices.map(svc => (
                  <div key={svc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{svc.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                        <p className="text-xs text-gray-500">{svc.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">
                            {svc.category === 'consulting' ? '咨询' : svc.category === 'service' ? '技能服务' : '社交互动'}
                          </span>
                          <span className="text-[10px] text-gray-400">${svc.price} USDC</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeService(svc.id)}
                      className="text-gray-300 hover:text-red-400 text-sm transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 创建新服务按钮 / 表单 */}
            {!showServiceForm ? (
              <button
                onClick={() => setShowServiceForm(true)}
                className="w-full py-3 border-2 border-dashed border-purple-200 rounded-xl text-sm text-purple-500 hover:bg-purple-50 hover:border-purple-300 transition flex items-center justify-center gap-2"
              >
                <span className="text-lg">+</span>
                <span>发布新服务</span>
              </button>
            ) : (
              <div className="border border-purple-200 rounded-xl p-4 bg-purple-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-800">创建服务卡片</h4>
                  <button onClick={() => setShowServiceForm(false)} className="text-gray-400 hover:text-gray-600 text-xs">取消</button>
                </div>

                {/* 图标选择 */}
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">选择图标</label>
                  <div className="flex gap-2 flex-wrap">
                    {['🎯', '🎨', '💻', '📸', '✍️', '🎵', '📊', '🔧', '☕', '🧘', '📚', '🎮'].map(icon => (
                      <button
                        key={icon}
                        onClick={() => setNewService(prev => ({ ...prev, icon }))}
                        className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition ${
                          newService.icon === icon ? 'bg-purple-100 border-2 border-purple-400' : 'bg-white border border-gray-200 hover:border-purple-200'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 服务名称 */}
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">服务名称</label>
                  <input
                    type="text"
                    value={newService.name}
                    onChange={e => setNewService(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="例如：UI 设计咨询"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 placeholder-gray-300"
                  />
                </div>

                {/* 服务描述 */}
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">服务描述</label>
                  <textarea
                    value={newService.description}
                    onChange={e => setNewService(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="简单描述你提供的服务内容..."
                    rows={2}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none placeholder-gray-300"
                  />
                </div>

                {/* 类别 & 价格 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">服务类别</label>
                    <select
                      value={newService.category}
                      onChange={e => setNewService(prev => ({ ...prev, category: e.target.value as ServiceItem['category'] }))}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      <option value="consulting">专业咨询</option>
                      <option value="service">技能服务</option>
                      <option value="social">社交互动</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">价格 (USDC)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={newService.price}
                      onChange={e => setNewService(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="10"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 placeholder-gray-300"
                    />
                  </div>
                </div>

                {/* Platform Agent 说明 */}
                <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-lg">
                  <span className="text-xs mt-0.5">🤖</span>
                  <p className="text-[10px] text-blue-600 leading-relaxed">
                    发布后，Platform Agent 会根据服务类别自动配置评估维度。用户预约后，Agent 将动态跟踪服务完成情况并决定是否释放托管资金。
                  </p>
                </div>

                {/* 发布按钮 */}
                <button
                  onClick={handlePublishService}
                  disabled={!newService.name || !newService.price || publishingService}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {publishingService ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>发布中...</span>
                    </>
                  ) : (
                    <span>发布服务卡片</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ====== 进行中的订单 ====== */}
        {activeOrders.filter(o => o.status !== 'COMPLETED').length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">进行中的订单</h2>
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              </div>
              <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                {activeOrders.filter(o => o.status !== 'COMPLETED').length} 个进行中
              </span>
            </div>

            <div className="px-5 pb-4 space-y-3">
              {activeOrders.filter(o => o.status !== 'COMPLETED').map(order => (
                <ActiveOrderCard
                  key={order.id}
                  order={order}
                  onCheckin={() => handleCheckin(order.id)}
                  onConfirmComplete={() => handleConfirmComplete(order.id)}
                  onDispute={() => handleDispute(order.id)}
                  onViewProfile={() => navigate(`/profile/${order.counterparty.profileId}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 已完成的订单（最近） */}
        {activeOrders.filter(o => o.status === 'COMPLETED').length > 0 && (
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">✅</span>
              <h3 className="text-sm font-medium text-green-800">最近完成</h3>
            </div>
            {activeOrders.filter(o => o.status === 'COMPLETED').map(order => (
              <div key={order.id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span>{order.serviceIcon}</span>
                  <span className="text-sm text-green-700">{order.serviceName}</span>
                  <span className="text-xs text-green-500">· {order.counterparty.name}</span>
                </div>
                <span className="text-xs text-green-600 font-medium">${order.amount} 已释放</span>
              </div>
            ))}
          </div>
        )}

        {/* ====== 待评分提醒 ====== */}
        {pendingRatingCount > 0 && (
          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="text-sm font-medium text-purple-800">{pendingRatingCount} 笔交易待评分</p>
                <p className="text-xs text-purple-500">仅托管释放的交易可评分</p>
              </div>
            </div>
            <button
              onClick={() => { const first = transactions.find(canRate); if (first) setRatingTx(first); }}
              className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg font-medium"
            >
              去评分
            </button>
          </div>
        )}

        {/* ====== 交易记录 ====== */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">交易记录</h2>
            <span className="text-xs text-gray-400">{transactions.length} 笔</span>
          </div>

          <div className="divide-y divide-gray-50">
            {visibleTx.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm text-gray-400">暂无交易记录</p>
              </div>
            ) : (
              visibleTx.map(tx => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  canRate={canRate(tx)}
                  onRate={() => setRatingTx(tx)}
                  onViewProfile={() => { if (tx.counterparty.profileId) navigate(`/profile/${tx.counterparty.profileId}`); }}
                />
              ))
            )}
          </div>

          {transactions.length > 5 && (
            <div className="px-5 py-3 border-t border-gray-50">
              <button
                onClick={() => setShowAllTx(!showAllTx)}
                className="w-full text-center text-xs text-purple-600 font-medium hover:text-purple-700"
              >
                {showAllTx ? '收起' : `查看全部 ${transactions.length} 笔`}
              </button>
            </div>
          )}
        </div>

        {/* 规则管理已移至服务设置中 */}

        {/* ====== 照片真实度（人照一致性） ====== */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">照片真实度</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">验证照片与本人一致性</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">✅</span>
              <span className="text-xl font-bold text-green-500">92%</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <p className="text-xs text-green-700 font-medium">人脸检测</p>
              <p className="text-[10px] text-green-500 mt-0.5">通过</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <p className="text-xs text-green-700 font-medium">表情自然度</p>
              <p className="text-[10px] text-green-500 mt-0.5">正常</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <p className="text-xs text-green-700 font-medium">元数据检查</p>
              <p className="text-[10px] text-green-500 mt-0.5">正常</p>
            </div>
          </div>
        </div>
      </div>

      {/* ====== 弹窗们 ====== */}
      {ratingTx && (
        <RatingModal transaction={ratingTx} onSubmit={handleRatingSubmit} onClose={() => setRatingTx(null)} />
      )}
      {showSetup && address && (
        <AgentWalletSetup mainWalletAddress={address} onComplete={handleAgentWalletCreated} onCancel={() => setShowSetup(false)} />
      )}
      {showFund && agentWallet && (
        <FundAgentWallet agentWallet={agentWallet} mainWalletBalance={mainBalance} onFund={handleFund} onClose={() => setShowFund(false)} />
      )}
      {showAgentChat && agentWallet && (
        <AgentChat agentWalletAddress={agentWallet.address} balances={agentWallet.balances} onClose={() => setShowAgentChat(false)} />
      )}
    </div>
  );
}

// ==========================================
// ZK 认证步骤指示器
// ==========================================
function ZKStepIndicator({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
        done ? 'bg-green-500' : active ? 'bg-purple-500 animate-pulse' : 'bg-gray-200'
      }`}>
        {done && <span className="text-white text-[8px]">✓</span>}
      </div>
      <span className={`text-[10px] ${done ? 'text-green-600' : active ? 'text-purple-600 font-medium' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
}

// ==========================================
// 进行中订单卡片
// ==========================================
const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_CHECKIN: { label: '等待签到', color: 'text-orange-700', bg: 'bg-orange-100' },
  CHECKED_IN: { label: '部分签到', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  IN_PROGRESS: { label: '服务进行中', color: 'text-blue-700', bg: 'bg-blue-100' },
  PENDING_CONFIRM: { label: 'Agent 审核中', color: 'text-purple-700', bg: 'bg-purple-100' },
  COMPLETED: { label: '已完成', color: 'text-green-700', bg: 'bg-green-100' },
  DISPUTED: { label: '争议处理中', color: 'text-red-700', bg: 'bg-red-100' },
};

function ActiveOrderCard({ order, onCheckin, onConfirmComplete, onDispute, onViewProfile }: {
  order: ActiveOrder;
  onCheckin: () => void;
  onConfirmComplete: () => void;
  onDispute: () => void;
  onViewProfile: () => void;
}) {
  const statusCfg = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.PENDING_CHECKIN;
  const timeLeft = order.expiresAt - Math.floor(Date.now() / 1000);
  const hoursLeft = Math.max(0, Math.floor(timeLeft / 3600));
  const minsLeft = Math.max(0, Math.floor((timeLeft % 3600) / 60));

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* 头部：服务信息 + 状态 */}
      <div className="p-3.5 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{order.serviceIcon}</span>
            <div>
              <p className="text-sm font-medium text-gray-900">{order.serviceName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <button onClick={onViewProfile} className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                  {order.role === 'consumer' ? '服务方' : '消费方'}: {order.counterparty.name}
                </button>
                {order.isOffline && (
                  <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">📍 线下</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            <p className="text-[10px] text-gray-400 mt-1">托管 ${order.amount} USDC</p>
          </div>
        </div>

        {/* 线下地点 */}
        {order.isOffline && order.location && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-white rounded-lg px-2.5 py-1.5 mt-1">
            <span>📍</span>
            <span>{order.location}</span>
          </div>
        )}
      </div>

      {/* 签到进度 */}
      <div className="p-3.5">
        {/* 双方签到状态 */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`flex-1 flex items-center gap-2 p-2 rounded-lg ${order.myCheckedIn ? 'bg-green-50' : 'bg-gray-50'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              order.myCheckedIn ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {order.myCheckedIn ? '✓' : '·'}
            </div>
            <span className={`text-xs ${order.myCheckedIn ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
              我已签到
            </span>
          </div>
          <div className={`flex-1 flex items-center gap-2 p-2 rounded-lg ${order.counterpartyCheckedIn ? 'bg-green-50' : 'bg-gray-50'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              order.counterpartyCheckedIn ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {order.counterpartyCheckedIn ? '✓' : '·'}
            </div>
            <span className={`text-xs ${order.counterpartyCheckedIn ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
              对方{order.counterpartyCheckedIn ? '已签到' : '未签到'}
            </span>
          </div>
        </div>

        {/* 倒计时 */}
        {order.status !== 'COMPLETED' && order.status !== 'DISPUTED' && (
          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-3">
            <span>⏱️ 剩余 {hoursLeft}h {minsLeft}m</span>
            <span>超时未完成Agent判定</span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          {/* 签到按钮 */}
          {order.status === 'PENDING_CHECKIN' && !order.myCheckedIn && (
            <button
              onClick={onCheckin}
              className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5"
            >
              <span>📍</span>
              <span>{order.isOffline ? '到达现场 · 签到' : '确认就绪 · 签到'}</span>
            </button>
          )}

          {/* 等待对方签到 */}
          {order.status === 'CHECKED_IN' && order.myCheckedIn && !order.counterpartyCheckedIn && (
            <div className="flex-1 py-2.5 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl text-sm text-center">
              等待对方签到...
            </div>
          )}

          {/* 服务进行中 - 消费方可确认完成 */}
          {order.status === 'IN_PROGRESS' && order.role === 'consumer' && (
            <button
              onClick={onConfirmComplete}
              className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5"
            >
              <span>✅</span>
              <span>确认服务完成 · 释放 Escrow</span>
            </button>
          )}

          {/* 服务进行中 - 提供方等待消费方确认 */}
          {order.status === 'IN_PROGRESS' && order.role === 'provider' && (
            <div className="flex-1 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm text-center">
              服务进行中 · 等待对方确认
            </div>
          )}

          {/* Agent 审核中 */}
          {order.status === 'PENDING_CONFIRM' && (
            <div className="flex-1 py-2.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl text-sm text-center flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-purple-300 border-t-purple-600 animate-spin" />
              <span>Platform Agent 审核中...</span>
            </div>
          )}

          {/* 争议中 */}
          {order.status === 'DISPUTED' && (
            <div className="flex-1 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm text-center">
              🤖 Platform Agent 正在调查处理
            </div>
          )}

          {/* 发起争议按钮（进行中状态可用） */}
          {order.status === 'IN_PROGRESS' && (
            <button
              onClick={onDispute}
              className="px-3 py-2.5 border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 rounded-xl text-xs transition"
            >
              争议
            </button>
          )}
        </div>

        {/* Escrow 说明 */}
        {order.status !== 'COMPLETED' && order.status !== 'DISPUTED' && (
          <div className="flex items-start gap-2 mt-3 p-2 bg-gray-50 rounded-lg">
            <span className="text-[10px] mt-0.5">🔒</span>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              ${order.amount} USDC 已锁定在 Escrow 合约中。{order.role === 'consumer'
                ? '确认服务完成后，Platform Agent 审核通过即自动释放给服务方。'
                : '消费方确认后，Platform Agent 审核通过即自动释放到你的钱包。'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 交易行子组件
// ==========================================
function TransactionRow({ tx, canRate, onRate, onViewProfile }: {
  tx: Transaction; canRate: boolean; onRate: () => void; onViewProfile: () => void;
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
          <button onClick={onViewProfile} className="text-sm font-medium text-gray-900 truncate hover:text-purple-600 transition">
            {tx.counterparty.name}
          </button>
          {escrowInfo && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${escrowInfo.bg}`}>{escrowInfo.label}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs ${typeInfo.color}`}>{typeInfo.label}</span>
          {tx.serviceName && <span className="text-xs text-gray-400">· {tx.serviceName}</span>}
        </div>
        <p className="text-[10px] text-gray-300 mt-0.5">{new Date(tx.timestamp * 1000).toLocaleString()}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-sm font-bold ${isOutgoing ? 'text-red-500' : 'text-green-600'}`}>
          {isOutgoing ? '-' : '+'}{tx.amount} {tx.token}
        </div>
        {tx.rated && tx.myRating !== undefined ? (
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[10px] text-gray-400">信誉</span>
            <span className={`text-xs font-bold ${tx.myRating >= 200 ? 'text-green-600' : tx.myRating >= 128 ? 'text-yellow-600' : 'text-red-500'}`}>
              {tx.myRating}
            </span>
          </div>
        ) : canRate ? (
          <button onClick={(e) => { e.stopPropagation(); onRate(); }} className="mt-1 text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium hover:bg-purple-100 transition">
            去评分
          </button>
        ) : null}
      </div>
    </div>
  );
}
