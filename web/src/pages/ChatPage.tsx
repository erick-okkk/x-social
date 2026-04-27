import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { ChatMessage, ServiceItem, Profile } from '../types';
import { formatAmount } from '../utils/format';
import { MOCK_PROFILES } from './ProfilePage';
import { PaymentModal } from '../components/PaymentModal';
import { RuleEvaluationPanel } from '../components/RuleEvaluationPanel';
import { evaluateConversation, EvaluationResult } from '../agent/ruleEvaluator';
import { ALL_SCENARIOS } from '../data/mockConversations';
import { getPaymentTier } from '../utils/paymentTier';

export function ChatPage() {
  const { depositId } = useParams<{ depositId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { address } = useWallet();

  const profile: Profile | null = depositId ? (MOCK_PROFILES[depositId] || null) : null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [escrowStatus, setEscrowStatus] = useState<'none' | 'locked' | 'released' | 'refunded'>('none');
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [showEvalPanel, setShowEvalPanel] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [useMockConvo, setUseMockConvo] = useState(false);
  // 脚本式自动回复索引（仅对有剧本的对话生效）
  const scriptIndexRef = useRef(0);
  // 转账弹窗
  const [showTransferInput, setShowTransferInput] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  // MPP 按条付费
  const [mppBalance, setMppBalance] = useState(5.00);  // 预充值 MPP 余额
  const [mppTotalSpent, setMppTotalSpent] = useState(0);
  const [mppMessageCount, setMppMessageCount] = useState(0);
  const messageFee = profile?.messageFee ? parseFloat(profile.messageFee) : 0;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 初始化聊天 — 对方发送问候 + 服务卡片
  useEffect(() => {
    if (!profile) return;

    const ts = Math.floor(Date.now() / 1000);
    const initMessages: ChatMessage[] = [
      {
        id: 'sys-1',
        sender: 'SYSTEM',
        depositId: depositId || '',
        content: `你已与 ${profile.name} 建立连接`,
        timestamp: ts - 10,
        type: 'SYSTEM',
      },
      {
        id: 'greeting',
        sender: 'THEM',
        depositId: depositId || '',
        content: `hi，我是${profile.name}，很高兴认识你 ☺️`,
        timestamp: ts - 5,
        type: 'TEXT',
      },
    ];

    // 添加服务卡片消息
    if (profile.services && profile.services.length > 0) {
      initMessages.push({
        id: 'svc-intro',
        sender: 'THEM',
        depositId: depositId || '',
        content: '这是我提供的服务，感兴趣可以点击预约~',
        timestamp: ts - 3,
        type: 'TEXT',
      });

      profile.services.forEach((svc, i) => {
        initMessages.push({
          id: `svc-card-${i}`,
          sender: 'THEM',
          depositId: depositId || '',
          content: '',
          timestamp: ts - 2 + i * 0.1,
          type: 'SERVICE_CARD',
          serviceItem: svc,
        });
      });
    }

    // 如果 URL 带了 service 参数，自动选中
    const svcId = searchParams.get('service');
    if (svcId && profile.services) {
      const svc = profile.services.find(s => s.id === svcId);
      if (svc) {
        setSelectedService(svc);
        setShowPaymentModal(true);
      }
    }

    setMessages(initMessages);
  }, [profile, depositId, searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">找不到对话</p>
      </div>
    );
  }

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    // MPP 扣费
    if (messageFee > 0 && mppBalance < messageFee) {
      // 余额不足提示
      const sysMsg: ChatMessage = {
        id: `mpp-low-${Date.now()}`,
        sender: 'SYSTEM',
        depositId: depositId || '',
        content: `⚡ MPP 余额不足（剩余 $${mppBalance.toFixed(2)}），请充值后继续发送`,
        timestamp: Math.floor(Date.now() / 1000),
        type: 'SYSTEM',
      };
      setMessages(prev => [...prev, sysMsg]);
      return;
    }

    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'YOU',
      depositId: depositId || '',
      content: newMessage,
      timestamp: Math.floor(Date.now() / 1000),
      type: 'TEXT',
      mppPayment: messageFee > 0 ? {
        amount: messageFee.toFixed(4),
        token: 'USDC',
        txHash: `0x${Math.random().toString(16).slice(2, 10)}...`,
      } : undefined,
    };
    setMessages(prev => [...prev, msg]);
    setNewMessage('');

    // MPP 余额扣减
    if (messageFee > 0) {
      setMppBalance(prev => +(prev - messageFee).toFixed(4));
      setMppTotalSpent(prev => +(prev + messageFee).toFixed(4));
      setMppMessageCount(prev => prev + 1);
    }

    // 按剧本回复（Alice），或随机回复（其他）
    const ALICE_SCRIPT = [
      '真的吗！我拍了好几年了，最近在研究街拍构图 📷',
      '可以帮你看的～我的摄影指导服务就是专门讲构图和后期，$20 USDC，感兴趣吗？',
      '好的，点下面的摄影指导卡片就可以预约啦～',
    ];
    const FALLBACK_REPLIES = [
      '嗯嗯，我觉得也是！',
      '听起来不错！',
      '你周末一般做什么呀？',
      '我也很喜欢这个~',
    ];
    setTimeout(() => {
      let replyContent: string;
      if (depositId === '1') {
        replyContent = ALICE_SCRIPT[scriptIndexRef.current] ?? '😊';
        scriptIndexRef.current = Math.min(scriptIndexRef.current + 1, ALICE_SCRIPT.length - 1);
      } else {
        replyContent = FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
      }
      const reply: ChatMessage = {
        id: `reply-${Date.now()}`,
        sender: 'THEM',
        depositId: depositId || '',
        content: replyContent,
        timestamp: Math.floor(Date.now() / 1000),
        type: 'TEXT',
      };
      setMessages(prev => [...prev, reply]);
    }, 1200);
  };

  const handleServiceClick = (svc: ServiceItem) => {
    setSelectedService(svc);
    setShowPaymentModal(true);
  };

  const handlePaymentConfirm = () => {
    if (!selectedService) return;
    setShowPaymentModal(false);
    setEscrowStatus('locked');

    // 添加系统消息
    const sysMsg: ChatMessage = {
      id: `pay-${Date.now()}`,
      sender: 'SYSTEM',
      depositId: depositId || '',
      content: `已支付 $${selectedService.price} USDC「${selectedService.name}」— 资金已锁入 Escrow`,
      timestamp: Math.floor(Date.now() / 1000),
      type: 'SYSTEM',
    };
    setMessages(prev => [...prev, sysMsg]);
    setSelectedService(null);
  };

  // 加载 Mock 对话记录
  const handleLoadMockConvo = () => {
    const scenario = ALL_SCENARIOS[depositId || ''];
    if (!scenario) return;
    setMessages(scenario.messages);
    setEscrowStatus('locked');
    setUseMockConvo(true);
    setEvaluationResult(null);
  };

  // Platform Agent 评估
  const handleEvaluate = () => {
    setIsEvaluating(true);
    // 模拟 Agent 思考延迟
    setTimeout(() => {
      const scenario = ALL_SCENARIOS[depositId || ''];
      const ruleSet = scenario?.ruleSet || profile?.ruleSet;
      if (!ruleSet) {
        setIsEvaluating(false);
        return;
      }
      const result = evaluateConversation(messages, ruleSet);
      setEvaluationResult(result);
      setShowEvalPanel(true);
      setIsEvaluating(false);

      // 添加系统消息
      const sysMsg: ChatMessage = {
        id: `eval-${Date.now()}`,
        sender: 'SYSTEM',
        depositId: depositId || '',
        content: result.recommendation === 'RELEASE'
          ? `🤖 Agent 评估完成：规则全部满足，建议释放 Escrow`
          : result.recommendation === 'HOLD'
            ? `🤖 Agent 评估完成：${result.requiredPassed}/${result.requiredTotal} 条必要规则通过，暂不释放`
            : `🤖 Agent 评估完成：对话未达标，建议退款`,
        timestamp: Math.floor(Date.now() / 1000),
        type: 'SYSTEM',
      };
      setMessages(prev => [...prev, sysMsg]);

      // 如果全部通过，更新 escrow 状态
      if (result.recommendation === 'RELEASE') {
        setEscrowStatus('released');
      }
    }, 1500);
  };

  const handleTransferConfirm = () => {
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) return;
    setShowTransferInput(false);

    const tier = getPaymentTier(amt);
    const tierLabel = tier === 'MPP' ? 'MPP 即时' : tier === 'X402' ? 'x402' : '🛡️ 隐私';

    const msg: ChatMessage = {
      id: `transfer-${Date.now()}`,
      sender: 'YOU',
      depositId: depositId || '',
      content: `💸 发起转账：$${amt.toFixed(2)} USDC（${tierLabel}）`,
      timestamp: Math.floor(Date.now() / 1000),
      type: 'TEXT',
    };
    setMessages(prev => [...prev, msg]);
    setTransferAmount('');

    // 对方确认收到
    setTimeout(() => {
      const sysMsg: ChatMessage = {
        id: `transfer-sys-${Date.now()}`,
        sender: 'SYSTEM',
        depositId: depositId || '',
        content: `转账 $${amt.toFixed(2)} USDC 已发送`,
        timestamp: Math.floor(Date.now() / 1000),
        type: 'SYSTEM',
      };
      setMessages(prev => [...prev, sysMsg]);
    }, 1000);
  };

  const handleAction = (action: string) => {
    setShowActionMenu(false);
    let content = '';
    let type: ChatMessage['type'] = 'TEXT';

    switch (action) {
      case 'transfer':
        setShowTransferInput(true);
        return;
      case 'photo':
        content = '📸 [分享了一张照片]';
        type = 'PHOTO';
        break;
      case 'contact':
        content = '📱 我的微信号：xxxx';
        type = 'CONTACT';
        break;
      case 'video':
        content = '📹 发起视频通话邀请';
        type = 'TEXT';
        break;
      case 'location':
        content = '📍 [发送了见面位置：xxx 咖啡馆]';
        type = 'TEXT';
        break;
      case 'checkin':
        content = '✅ 我已到达见面地点，确认签到';
        type = 'TEXT';
        break;
      default:
        return;
    }

    const msg: ChatMessage = {
      id: `action-${Date.now()}`,
      sender: 'YOU',
      depositId: depositId || '',
      content,
      timestamp: Math.floor(Date.now() / 1000),
      type,
    };
    setMessages(prev => [...prev, msg]);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen flex flex-col bg-[#f5ebe0]">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/profile/${profile.id}`)} className="text-gray-600 hover:text-gray-900 text-2xl">
              &#8249;
            </button>
            <div>
              <h1 className="text-base font-semibold text-gray-900">{profile.name}</h1>
              <p className="text-xs text-gray-400">照片真实度 {profile.photoAuthenticityPercent}%</p>
            </div>
          </div>
        <div className="flex items-center gap-1.5">
          {escrowStatus === 'locked' && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
              Escrow 锁定中
            </span>
          )}
          {escrowStatus === 'released' && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
              已释放
            </span>
          )}
          {/* 加载 Mock 对话 */}
          {ALL_SCENARIOS[depositId || ''] && !useMockConvo && (
            <button
              onClick={handleLoadMockConvo}
              className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium hover:bg-blue-100 transition"
            >
              加载对话
            </button>
          )}
          {/* Agent 评估 */}
          {escrowStatus === 'locked' && (
            <button
              onClick={handleEvaluate}
              disabled={isEvaluating}
              className="text-xs bg-purple-50 text-purple-600 px-2.5 py-1 rounded-full font-medium hover:bg-purple-100 transition disabled:opacity-50"
            >
              {isEvaluating ? '评估中...' : '🤖 评估'}
            </button>
          )}
          {/* 查看评估结果 */}
          {evaluationResult && !showEvalPanel && (
            <button
              onClick={() => setShowEvalPanel(true)}
              className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium hover:bg-gray-200 transition"
            >
              📊
            </button>
          )}
        </div>
        </div>

        {/* MPP 按条付费状态栏 */}
        {messageFee > 0 && (
          <div className="mt-2 flex items-center justify-between bg-green-50 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-green-700">⚡ MPP 即时支付</span>
              <span className="text-[10px] text-green-500">${messageFee}/条</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">已发 {mppMessageCount} 条</span>
              <span className="text-xs text-gray-400">|</span>
              <span className="text-xs text-green-600 font-medium">余额 ${mppBalance.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => {
          if (msg.type === 'SYSTEM') {
            return (
              <div key={msg.id} className="text-center">
                <span className="inline-block bg-black/5 text-gray-500 text-xs px-3 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            );
          }

          if (msg.type === 'SERVICE_CARD' && msg.serviceItem) {
            return (
              <div key={msg.id} className="flex justify-start">
                <div
                  onClick={() => handleServiceClick(msg.serviceItem!)}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 max-w-[280px] cursor-pointer hover:shadow-md transition active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{msg.serviceItem.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{msg.serviceItem.name}</p>
                      <p className="text-xs text-gray-500">{msg.serviceItem.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                    <span className="text-lg font-bold text-purple-600">${msg.serviceItem.price} USDC</span>
                    <span className="text-xs bg-purple-50 text-purple-600 px-3 py-1.5 rounded-full font-medium">
                      去预约
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          const isMe = msg.sender === 'YOU';
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <img
                  src={profile.photoUrl}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover mr-2 flex-shrink-0 mt-1"
                />
              )}
              <div className="max-w-[70%]">
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? 'bg-purple-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                  } ${msg.type === 'AGREEMENT' ? 'border-2 border-purple-300 bg-purple-50 text-purple-700' : ''}
                  ${msg.type === 'CONTACT' ? 'border-2 border-blue-300 bg-blue-50 text-blue-700' : ''}`}
                >
                  {msg.content}
                </div>
                <div className={`flex items-center gap-1.5 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <p className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</p>
                  {msg.mppPayment && (
                    <span className="text-[10px] text-green-500 flex items-center gap-0.5">
                      ⚡ ${msg.mppPayment.amount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部输入区域 */}
      <div className="bg-white border-t border-gray-200 px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* 语音按钮（装饰） */}
          <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>

          {/* 输入框 */}
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={messageFee > 0 ? `输入消息... (⚡$${messageFee}/条)` : '输入消息...'}
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />

          {/* 表情（装饰） */}
          <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
              <line x1="9" y1="9" x2="9.01" y2="9"/>
              <line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
          </button>

          {/* + 功能菜单 */}
          <div className="relative">
            <button
              onClick={() => setShowActionMenu(!showActionMenu)}
              className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 text-xl transition"
            >
              +
            </button>

            {/* 弹出菜单 */}
            {showActionMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowActionMenu(false)} />
                <div className="absolute bottom-12 right-0 z-50 bg-white rounded-2xl shadow-lg border border-gray-100 p-2 w-52">
                  <ActionItem icon="💸" label="转账" onClick={() => handleAction('transfer')} />
                  <ActionItem icon="📸" label="发照片" onClick={() => handleAction('photo')} />
                  <ActionItem icon="📱" label="分享联系方式" onClick={() => handleAction('contact')} />
                  <ActionItem icon="📹" label="视频通话" onClick={() => handleAction('video')} />
                  <ActionItem icon="📍" label="发送见面位置" onClick={() => handleAction('location')} />
                  <ActionItem icon="✅" label="到达签到" onClick={() => handleAction('checkin')} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 转账金额输入弹窗 */}
      {showTransferInput && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-80 p-6 mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">转账给 {profile.name}</h3>
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="输入金额"
                autoFocus
                className="w-full pl-8 pr-16 py-3 bg-gray-50 border border-gray-200 rounded-xl text-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">USDC</span>
            </div>
            {transferAmount && parseFloat(transferAmount) > 0 && (
              <p className="text-xs text-gray-400 mb-4">
                支付路由：{getPaymentTier(parseFloat(transferAmount)) === 'MPP' ? '⚡ MPP 即时支付' : getPaymentTier(parseFloat(transferAmount)) === 'X402' ? '📄 x402 标准支付' : '🛡️ ZK 隐私交易'}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowTransferInput(false); setTransferAmount(''); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition"
              >
                取消
              </button>
              <button
                onClick={handleTransferConfirm}
                disabled={!transferAmount || parseFloat(transferAmount) <= 0}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
              >
                确认转账
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 支付弹窗 */}
      {selectedService && (
        <PaymentModal
          isOpen={showPaymentModal}
          profileName={profile.name}
          amount={selectedService.price}
          serviceName={selectedService.name}
          serviceIcon={selectedService.icon}
          rules={profile.ruleSet?.rules}
          onConfirm={handlePaymentConfirm}
          onCancel={() => { setShowPaymentModal(false); setSelectedService(null); }}
          isLoading={false}
        />
      )}

      {/* Agent 评估结果面板 */}
      {showEvalPanel && evaluationResult && (
        <RuleEvaluationPanel
          result={evaluationResult}
          onClose={() => setShowEvalPanel(false)}
        />
      )}
    </div>
  );
}

function ActionItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition text-left"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm text-gray-700 font-medium">{label}</span>
    </button>
  );
}
