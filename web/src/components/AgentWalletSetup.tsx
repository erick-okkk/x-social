/**
 * Agentic Wallet 注册流程
 * 参考 OnchainOS: https://web3.okx.com/zh-hans/onchainos/dev-docs/home/install-your-agentic-wallet
 *
 * 流程：绑定邮箱 → 输入验证码 → 创建钱包 → 选择能力 → 注册完成
 */
import React, { useState, useRef, useEffect } from 'react';
import { AgentWallet } from '../types';

interface Props {
  mainWalletAddress: string;
  onComplete: (wallet: AgentWallet) => void;
  onCancel: () => void;
}

type Step = 'email' | 'verify' | 'creating' | 'capabilities' | 'registering' | 'done';

const CAPABILITIES = [
  { id: 'sign_permit', label: '自动支付', desc: '代你完成托管入金和服务付款', default: true },
  { id: 'escrow_deposit', label: '资金托管', desc: '自动锁定资金到安全合约', default: true },
  { id: 'rule_respond', label: '任务响应', desc: '自动响应规则评估和任务完成确认', default: true },
  { id: 'defi_basic', label: '资产管理', desc: '链上生息 / Swap / 收益管理', default: false },
  { id: 'cross_platform', label: '跨平台互通', desc: '与其他平台的 Agent 进行交互', default: false },
];

export function AgentWalletSetup({ mainWalletAddress, onComplete, onCancel }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', '']);
  const [codeError, setCodeError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [selectedCaps, setSelectedCaps] = useState<string[]>(
    CAPABILITIES.filter(c => c.default).map(c => c.id)
  );
  const [generatedAddress, setGeneratedAddress] = useState('');
  const codeInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // 验证码倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSendCode = () => {
    if (!email.trim()) {
      setEmailError('请输入邮箱地址');
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError('请输入有效的邮箱格式');
      return;
    }
    setEmailError('');
    setCountdown(60);
    setStep('verify');
  };

  const handleResendCode = () => {
    if (countdown > 0) return;
    setCountdown(60);
    setCodeError('');
    setVerifyCode(['', '', '', '', '', '']);
    codeInputsRef.current[0]?.focus();
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newCode = [...verifyCode];
    newCode[index] = value;
    setVerifyCode(newCode);
    setCodeError('');

    // 自动跳到下一格
    if (value && index < 5) {
      codeInputsRef.current[index + 1]?.focus();
    }

    // 全部填完自动验证
    if (value && index === 5 && newCode.every(c => c !== '')) {
      handleVerifyCode(newCode.join(''));
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verifyCode[index] && index > 0) {
      codeInputsRef.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setVerifyCode(newCode);
      handleVerifyCode(pasted);
    }
  };

  const handleVerifyCode = (code: string) => {
    // 模拟验证码校验 — 任意 6 位数字通过
    if (code.length !== 6) {
      setCodeError('请输入 6 位验证码');
      return;
    }

    setStep('creating');

    // 模拟创建钱包
    setTimeout(() => {
      const addr = '0x' + Array.from({ length: 40 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      setGeneratedAddress(addr);
      setStep('capabilities');
    }, 2500);
  };

  const handleRegister = () => {
    setStep('registering');
    setTimeout(() => setStep('done'), 2500);
  };

  const handleDone = () => {
    const wallet: AgentWallet = {
      address: generatedAddress,
      personalAgentId: `pa-${mainWalletAddress.slice(2, 8)}`,
      erc8004AgentId: Math.floor(Math.random() * 10000) + 1,
      agentType: 'personal',
      status: 'ACTIVE',
      createdAt: Math.floor(Date.now() / 1000),
      balances: { usdc: '0', eth: '0' },
      capabilities: selectedCaps,
      teeAttestation: '0x' + Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join(''),
    };
    onComplete(wallet);
  };

  const toggleCap = (id: string) => {
    setSelectedCaps(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // 步骤指示器
  const steps = [
    { key: 'email', label: '绑定邮箱' },
    { key: 'verify', label: '验证' },
    { key: 'creating', label: '创建' },
    { key: 'capabilities', label: '设置' },
    { key: 'done', label: '完成' },
  ];
  const currentStepIndex = steps.findIndex(s =>
    s.key === step || (step === 'registering' && s.key === 'capabilities')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative z-10 bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden">

        {/* 步骤进度条 */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition ${
                  i < currentStepIndex ? 'bg-green-500 text-white'
                    : i === currentStepIndex ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                }`}>
                  {i < currentStepIndex ? '✓' : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-8 sm:w-12 h-0.5 mx-1 transition ${
                    i < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1.5">
            {steps.map((s, i) => (
              <span key={s.key} className={`text-[10px] ${
                i <= currentStepIndex ? 'text-gray-600' : 'text-gray-300'
              }`}>{s.label}</span>
            ))}
          </div>
        </div>

        {/* Step 1: 绑定邮箱 */}
        {step === 'email' && (
          <div className="px-6 pb-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-3 bg-purple-100 rounded-2xl flex items-center justify-center">
                <span className="text-2xl">📧</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">绑定邮箱</h2>
              <p className="text-sm text-gray-500">
                创建 Agentic Wallet 需要验证你的邮箱
              </p>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1.5 block">邮箱地址</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                placeholder="you@example.com"
                className={`w-full px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 ${
                  emailError ? 'focus:ring-red-300 border border-red-200' : 'focus:ring-purple-200'
                }`}
                autoFocus
              />
              {emailError && (
                <p className="text-xs text-red-500 mt-1.5">{emailError}</p>
              )}
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-5">
              <p className="text-xs text-gray-400 mb-1">绑定主钱包</p>
              <code className="text-xs text-purple-600 font-mono">
                {mainWalletAddress.slice(0, 10)}...{mainWalletAddress.slice(-8)}
              </code>
            </div>

            <div className="space-y-2 mb-5">
              <InfoRow icon="🤖" title="Agentic Wallet" desc="由 OnchainOS 提供，绑定邮箱后自动创建" />
              <InfoRow icon="🔐" title="安全托管" desc="私钥由安全芯片保管，独立于主钱包" />
              <InfoRow icon="⚡" title="自动执行" desc="Agent 可代你完成支付和链上操作" />
            </div>

            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition">
                取消
              </button>
              <button
                onClick={handleSendCode}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition"
              >
                发送验证码
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 输入验证码 */}
        {step === 'verify' && (
          <div className="px-6 pb-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-3 bg-purple-100 rounded-2xl flex items-center justify-center">
                <span className="text-2xl">🔢</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">输入验证码</h2>
              <p className="text-sm text-gray-500">
                验证码已发送到 <span className="text-gray-800 font-medium">{email}</span>
              </p>
            </div>

            {/* 6 位验证码输入 */}
            <div className="flex justify-center gap-2.5 mb-3" onPaste={handleCodePaste}>
              {verifyCode.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { codeInputsRef.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  autoFocus={i === 0}
                  className={`w-11 h-13 text-center text-xl font-bold bg-gray-50 rounded-xl focus:outline-none focus:ring-2 transition ${
                    codeError
                      ? 'text-red-500 focus:ring-red-300 border border-red-200'
                      : digit
                        ? 'text-purple-600 focus:ring-purple-300 border border-purple-200'
                        : 'text-gray-800 focus:ring-purple-200 border border-gray-200'
                  }`}
                />
              ))}
            </div>

            {codeError && (
              <p className="text-xs text-red-500 text-center mb-3">{codeError}</p>
            )}

            <div className="text-center mb-6">
              {countdown > 0 ? (
                <p className="text-xs text-gray-400">
                  {countdown}s 后可重新发送
                </p>
              ) : (
                <button
                  onClick={handleResendCode}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  重新发送验证码
                </button>
              )}
            </div>

            {/* 手动提交按钮（可选，大多数情况自动提交） */}
            <div className="flex gap-3">
              <button
                onClick={() => { setStep('email'); setVerifyCode(['','','','','','']); setCodeError(''); }}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition"
              >
                返回修改邮箱
              </button>
              <button
                onClick={() => handleVerifyCode(verifyCode.join(''))}
                disabled={verifyCode.some(c => !c)}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50"
              >
                验证
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 创建钱包中 */}
        {step === 'creating' && (
          <div className="px-6 pb-6 text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-2xl flex items-center justify-center animate-pulse">
              <span className="text-3xl">🔐</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">正在创建 Agentic Wallet...</h2>
            <p className="text-sm text-gray-500 mb-1">邮箱验证通过</p>
            <p className="text-sm text-gray-500">正在安全环境中生成 Agent 钱包密钥</p>
            <div className="mt-6 flex justify-center">
              <div className="w-8 h-8 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
          </div>
        )}

        {/* Step 4: 选择能力 */}
        {step === 'capabilities' && (
          <div className="px-6 pb-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 mb-1">设置 Agent 能力</h2>
              <p className="text-xs text-gray-400">选择你希望 Agent 可以做哪些事</p>
            </div>

            <div className="bg-green-50 border border-green-100 rounded-xl p-3 mb-4 flex items-center gap-3">
              <span className="text-green-600 text-lg">✓</span>
              <div>
                <p className="text-sm font-medium text-green-800">Agentic Wallet 已创建</p>
                <code className="text-[10px] text-green-600 font-mono">
                  {generatedAddress.slice(0, 14)}...{generatedAddress.slice(-8)}
                </code>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex items-center gap-3">
              <span className="text-blue-500 text-lg">📧</span>
              <div>
                <p className="text-xs text-blue-600">绑定邮箱：{email}</p>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              {CAPABILITIES.map(cap => (
                <label
                  key={cap.id}
                  className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition border ${
                    selectedCaps.includes(cap.id)
                      ? 'bg-purple-50 border-purple-200'
                      : 'bg-gray-50 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCaps.includes(cap.id)}
                    onChange={() => toggleCap(cap.id)}
                    className="w-4 h-4 mt-0.5 accent-purple-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{cap.label}</p>
                    <p className="text-xs text-gray-400">{cap.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={handleRegister}
              disabled={selectedCaps.length === 0}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50"
            >
              注册 Agent 身份
            </button>
          </div>
        )}

        {/* Step 4.5: 链上注册中 */}
        {step === 'registering' && (
          <div className="px-6 pb-6 text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-2xl flex items-center justify-center animate-pulse">
              <span className="text-3xl">⛓️</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">注册中...</h2>
            <p className="text-sm text-gray-500 mb-4">正在链上注册 Agent 身份</p>
            <div className="bg-gray-50 rounded-xl p-3 mx-auto max-w-xs space-y-1.5">
              <p className="text-xs text-gray-600">✦ 铸造 Agent 身份凭证</p>
              <p className="text-xs text-gray-600">✦ 绑定 Personal Agent</p>
              <p className="text-xs text-gray-600">✦ 开通 {selectedCaps.length} 项能力</p>
            </div>
            <div className="mt-6 flex justify-center">
              <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          </div>
        )}

        {/* Step 5: 完成 */}
        {step === 'done' && (
          <div className="px-6 pb-6">
            <div className="text-center mb-5">
              <div className="w-16 h-16 mx-auto mb-3 bg-green-100 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">✅</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Agentic Wallet 已激活</h2>
              <p className="text-sm text-gray-500">你的 Agent 现在可以帮你操作了</p>
            </div>

            <div className="space-y-2.5 mb-5">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">钱包地址</p>
                <code className="text-xs text-purple-600 font-mono break-all">{generatedAddress}</code>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">绑定邮箱</p>
                  <p className="text-xs text-gray-700">{email}</p>
                </div>
                <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">已验证</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">状态</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-gray-700">已激活</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1.5">已开通能力</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCaps.map(id => {
                    const cap = CAPABILITIES.find(c => c.id === id);
                    return (
                      <span key={id} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                        {cap?.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 mb-5">
              <p className="text-xs text-yellow-700">
                Agentic Wallet 余额为 0，充值后 Agent 才能帮你自动支付和链上生息。
              </p>
            </div>

            <button onClick={handleDone} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition">
              完成，去充值
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div>
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
    </div>
  );
}
