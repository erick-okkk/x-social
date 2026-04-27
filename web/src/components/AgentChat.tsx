/**
 * Agent 对话框 — 嵌入钱包页的 Agent 聊天面板
 * 支持链上生息：Aave/Compound 存款、Lido 质押、一键最优策略
 */
import React, { useState, useRef, useEffect } from 'react';
import { AgentChatMessage, AgentAction, YieldPosition } from '../types';

interface Props {
  agentWalletAddress: string;
  balances: { usdc: string; eth: string };
  onClose: () => void;
}

// Mock 收益策略数据
const YIELD_STRATEGIES = [
  { protocol: 'Aave V3', icon: '👻', token: 'USDC', apy: '4.8%', risk: '低', desc: '稳定币借贷收益' },
  { protocol: 'Compound', icon: '🏦', token: 'USDC', apy: '3.9%', risk: '低', desc: '经典借贷协议' },
  { protocol: 'Lido', icon: '🌊', token: 'ETH', apy: '3.2%', risk: '低', desc: 'ETH 流动性质押' },
  { protocol: 'Yearn V3', icon: '🏗️', token: 'USDC', apy: '6.1%', risk: '中', desc: '自动复投策略' },
];

// Mock 当前持仓
const MOCK_POSITIONS: YieldPosition[] = [
  {
    id: 'pos-1',
    protocol: 'Aave V3',
    protocolIcon: '👻',
    token: 'USDC',
    depositedAmount: '50.00',
    currentValue: '50.32',
    apy: '4.8%',
    earned: '0.32',
    status: 'ACTIVE',
    depositedAt: Math.floor(Date.now() / 1000) - 86400 * 7,
  },
];

// 快捷指令
const QUICK_COMMANDS = [
  { label: '查看收益', cmd: '我的生息持仓怎么样了？' },
  { label: '最优策略', cmd: '帮我分析当前最优生息策略' },
  { label: 'USDC 存款', cmd: '帮我把 USDC 存入收益最高的协议' },
  { label: 'ETH 质押', cmd: '帮我质押 ETH 到 Lido' },
];

export function AgentChat({ agentWalletAddress, balances, onClose }: Props) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      content: `你好！我是你的链上 Agent 🤖\n\n我可以帮你管理 Agent Wallet 里的资产，让闲置资金自动生息。你可以问我：\n• 当前有哪些生息策略\n• 帮我存入 / 取出资金\n• 分析最优收益方案\n\n随时告诉我你想做什么~`,
      timestamp: Math.floor(Date.now() / 1000),
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [positions, setPositions] = useState<YieldPosition[]>(MOCK_POSITIONS);
  const [showPositions, setShowPositions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addAgentMessage = (content: string, action?: AgentAction) => {
    setMessages(prev => [...prev, {
      id: `agent-${Date.now()}`,
      role: 'agent',
      content,
      timestamp: Math.floor(Date.now() / 1000),
      action,
    }]);
  };

  const handleSend = (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;

    // 用户消息
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: msg,
      timestamp: Math.floor(Date.now() / 1000),
    }]);
    setInput('');
    setIsThinking(true);

    // 模拟 Agent 响应
    setTimeout(() => {
      const lower = msg.toLowerCase();

      if (lower.includes('持仓') || lower.includes('收益') || lower.includes('怎么样')) {
        handleYieldStatus();
      } else if (lower.includes('最优') || lower.includes('分析') || lower.includes('策略') || lower.includes('推荐')) {
        handleOptimalStrategy();
      } else if (lower.includes('usdc') && (lower.includes('存') || lower.includes('deposit'))) {
        handleDeposit('USDC');
      } else if (lower.includes('eth') && (lower.includes('质押') || lower.includes('stake') || lower.includes('lido'))) {
        handleStakeETH();
      } else if (lower.includes('取出') || lower.includes('withdraw') || lower.includes('赎回')) {
        handleWithdraw();
      } else {
        addAgentMessage(
          `我理解你的需求。目前我支持以下操作：\n\n` +
          `📊 查看当前生息持仓和收益\n` +
          `🔍 分析最优生息策略\n` +
          `💰 USDC 存入借贷协议（Aave/Compound）\n` +
          `🌊 ETH 质押到 Lido\n` +
          `📤 赎回已存资产\n\n` +
          `你可以试试点击下方快捷指令~`
        );
      }

      setIsThinking(false);
    }, 1200);
  };

  const handleYieldStatus = () => {
    if (positions.length === 0) {
      addAgentMessage('你目前还没有任何生息持仓。\n\n你的 Agent Wallet 有 $' + balances.usdc + ' USDC 和 ' + balances.eth + ' ETH 闲置，要不要我帮你找个收益不错的策略？');
      return;
    }

    const totalEarned = positions.reduce((sum, p) => sum + parseFloat(p.earned), 0);
    const lines = positions.map(p =>
      `${p.protocolIcon} ${p.protocol}：存入 $${p.depositedAmount} ${p.token}，当前价值 $${p.currentValue}（+$${p.earned}），APY ${p.apy}`
    ).join('\n');

    addAgentMessage(
      `📊 当前生息持仓：\n\n${lines}\n\n累计收益：$${totalEarned.toFixed(2)}\n\n闲置余额：$${balances.usdc} USDC / ${balances.eth} ETH`,
      { type: 'YIELD_INFO', status: 'COMPLETED' }
    );
    setShowPositions(true);
  };

  const handleOptimalStrategy = () => {
    const best = [...YIELD_STRATEGIES].sort((a, b) =>
      parseFloat(b.apy) - parseFloat(a.apy)
    );

    const table = best.map((s, i) =>
      `${i === 0 ? '⭐' : '  '} ${s.icon} ${s.protocol}：${s.apy} APY（${s.token}）— ${s.risk}风险 — ${s.desc}`
    ).join('\n');

    addAgentMessage(
      `🔍 当前最优生息策略分析：\n\n${table}\n\n` +
      `🎯 推荐方案：\n` +
      `• USDC → ${best[0].protocol}（${best[0].apy} APY）\n` +
      `• ETH → Lido（3.2% APY，可获得 stETH 保持流动性）\n\n` +
      `需要我帮你执行吗？回复"存入"即可一键操作。`,
      { type: 'YIELD_INFO', status: 'COMPLETED' }
    );
  };

  const handleDeposit = (token: string) => {
    const available = token === 'USDC' ? parseFloat(balances.usdc) : parseFloat(balances.eth);
    const minDeposit = token === 'USDC' ? 1 : 0.001;

    if (available < minDeposit) {
      addAgentMessage(
        `⚠️ ${token} 余额不足\n\n` +
        `当前余额：${available} ${token}\n` +
        `最低存入：${minDeposit} ${token}\n\n` +
        `请先给 Agent Wallet 充值，然后再来找我存入生息~`
      );
      return;
    }

    const amount = token === 'USDC'
      ? Math.min(available, 30).toFixed(2)
      : Math.min(available, 0.05).toFixed(4);
    const protocol = token === 'USDC' ? 'Yearn V3' : 'Lido';
    const apy = token === 'USDC' ? '6.1%' : '3.2%';

    addAgentMessage(
      `正在为你执行存入操作...\n\n` +
      `💰 ${amount} ${token} → ${protocol}\n` +
      `📈 预期 APY：${apy}\n` +
      `⏳ 交易处理中...`,
      { type: 'YIELD_DEPOSIT', protocol, token, amount, apy, status: 'EXECUTING' }
    );

    // 模拟交易完成
    setTimeout(() => {
      const newPosition: YieldPosition = {
        id: `pos-${Date.now()}`,
        protocol,
        protocolIcon: token === 'USDC' ? '🏗️' : '🌊',
        token,
        depositedAmount: amount,
        currentValue: amount,
        apy,
        earned: '0.00',
        status: 'ACTIVE',
        depositedAt: Math.floor(Date.now() / 1000),
      };
      setPositions(prev => [...prev, newPosition]);

      addAgentMessage(
        `✅ 存入成功！\n\n` +
        `${token === 'USDC' ? '🏗️' : '🌊'} ${protocol}：$${amount} ${token}\n` +
        `📈 APY：${apy}\n` +
        `🔗 交易哈希：0x${Math.random().toString(16).slice(2, 14)}...\n\n` +
        `资金已开始自动生息，你可以随时查看收益或赎回。`,
        { type: 'YIELD_DEPOSIT', protocol, token, amount, apy, status: 'COMPLETED', txHash: `0x${Math.random().toString(16).slice(2, 14)}` }
      );
    }, 2000);
  };

  const handleStakeETH = () => {
    const ethBalance = parseFloat(balances.eth);
    if (ethBalance < 0.001) {
      addAgentMessage(
        `⚠️ ETH 余额不足\n\n` +
        `当前余额：${ethBalance} ETH\n` +
        `最低质押：0.001 ETH\n\n` +
        `请先给 Agent Wallet 充入 ETH，然后再来找我质押~`
      );
      return;
    }
    const amount = Math.min(ethBalance, 0.05).toFixed(4);

    addAgentMessage(
      `正在为你质押 ETH...\n\n` +
      `🌊 ${amount} ETH → Lido\n` +
      `📈 预期 APY：3.2%\n` +
      `💧 你将获得等值 stETH，保持流动性\n` +
      `⏳ 交易处理中...`,
      { type: 'YIELD_DEPOSIT', protocol: 'Lido', token: 'ETH', amount, apy: '3.2%', status: 'EXECUTING' }
    );

    setTimeout(() => {
      const newPosition: YieldPosition = {
        id: `pos-${Date.now()}`,
        protocol: 'Lido',
        protocolIcon: '🌊',
        token: 'ETH',
        depositedAmount: amount,
        currentValue: amount,
        apy: '3.2%',
        earned: '0.0000',
        status: 'ACTIVE',
        depositedAt: Math.floor(Date.now() / 1000),
      };
      setPositions(prev => [...prev, newPosition]);

      addAgentMessage(
        `✅ 质押成功！\n\n` +
        `🌊 Lido：${amount} ETH → ${amount} stETH\n` +
        `📈 APY：3.2%\n` +
        `🔗 交易哈希：0x${Math.random().toString(16).slice(2, 14)}...\n\n` +
        `stETH 可随时赎回为 ETH，也可在 DeFi 中继续使用。`,
        { type: 'YIELD_DEPOSIT', protocol: 'Lido', token: 'ETH', amount, apy: '3.2%', status: 'COMPLETED' }
      );
    }, 2000);
  };

  const handleWithdraw = () => {
    if (positions.length === 0) {
      addAgentMessage('你目前没有生息持仓可以赎回。');
      return;
    }
    const pos = positions[0];
    addAgentMessage(
      `准备赎回 ${pos.protocolIcon} ${pos.protocol} 的 ${pos.token} 持仓...\n\n` +
      `📤 赎回金额：$${pos.currentValue} ${pos.token}\n` +
      `💰 累计收益：+$${pos.earned}\n` +
      `⏳ 交易处理中...`,
      { type: 'YIELD_WITHDRAW', protocol: pos.protocol, token: pos.token, amount: pos.currentValue, status: 'EXECUTING' }
    );

    setTimeout(() => {
      setPositions(prev => prev.filter(p => p.id !== pos.id));
      addAgentMessage(
        `✅ 赎回成功！\n\n` +
        `$${pos.currentValue} ${pos.token} 已返回你的 Agent Wallet。\n` +
        `💰 本次收益：+$${pos.earned}\n` +
        `🔗 交易哈希：0x${Math.random().toString(16).slice(2, 14)}...`,
        { type: 'YIELD_WITHDRAW', protocol: pos.protocol, token: pos.token, amount: pos.currentValue, status: 'COMPLETED' }
      );
    }, 2000);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900 text-2xl">&#8249;</button>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Agent 助手</h1>
            <p className="text-xs text-gray-400">链上资产管理 · 自动生息</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPositions(!showPositions)}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
              showPositions ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            📊 持仓
          </button>
          <span className="w-2 h-2 rounded-full bg-green-500" />
        </div>
      </div>

      {/* 持仓面板 */}
      {showPositions && positions.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400 mb-2">当前持仓</p>
          <div className="space-y-2">
            {positions.map(pos => (
              <div key={pos.id} className="flex items-center justify-between bg-blue-50 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{pos.protocolIcon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{pos.protocol}</p>
                    <p className="text-[10px] text-gray-400">{pos.token} · APY {pos.apy}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">${pos.currentValue}</p>
                  <p className="text-[10px] text-green-600">+${pos.earned}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => {
          if (msg.role === 'system') {
            return (
              <div key={msg.id} className="text-center">
                <span className="inline-block bg-black/5 text-gray-500 text-xs px-3 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            );
          }

          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <span className="text-lg">🤖</span>
                </div>
              )}
              <div className="max-w-[80%]">
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
                }`}>
                  {msg.content}
                </div>
                {/* 操作状态 */}
                {msg.action && (
                  <div className={`mt-1.5 flex items-center gap-1.5 text-[10px] ${
                    msg.action.status === 'COMPLETED' ? 'text-green-500' :
                    msg.action.status === 'EXECUTING' ? 'text-yellow-500' :
                    msg.action.status === 'FAILED' ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    <span>{
                      msg.action.status === 'COMPLETED' ? '✅' :
                      msg.action.status === 'EXECUTING' ? '⏳' :
                      msg.action.status === 'FAILED' ? '❌' : '⏸️'
                    }</span>
                    <span>
                      {msg.action.type === 'YIELD_DEPOSIT' && '存入操作'}
                      {msg.action.type === 'YIELD_WITHDRAW' && '赎回操作'}
                      {msg.action.type === 'YIELD_INFO' && '查询完成'}
                      {msg.action.type === 'YIELD_SWITCH' && '策略切换'}
                    </span>
                    {msg.action.txHash && (
                      <span className="text-gray-300">· {msg.action.txHash.slice(0, 10)}...</span>
                    )}
                  </div>
                )}
                <p className={`text-[10px] text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="flex justify-start">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
              <span className="text-lg">🤖</span>
            </div>
            <div className="bg-white rounded-2xl rounded-bl-md shadow-sm border border-gray-100 px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 快捷指令 */}
      <div className="bg-white border-t border-gray-100 px-4 py-2 flex-shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {QUICK_COMMANDS.map((qc, i) => (
            <button
              key={i}
              onClick={() => handleSend(qc.cmd)}
              disabled={isThinking}
              className="flex-shrink-0 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium hover:bg-blue-100 transition disabled:opacity-50"
            >
              {qc.label}
            </button>
          ))}
        </div>
      </div>

      {/* 输入框 */}
      <div className="bg-white border-t border-gray-200 px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="告诉 Agent 你想做什么..."
            disabled={isThinking}
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isThinking}
            className="w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full transition disabled:opacity-30"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
