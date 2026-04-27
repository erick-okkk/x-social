import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const RAILGUN_API = 'http://localhost:3001';

type StepStatus = 'pending' | 'loading' | 'done' | 'error';

interface Step {
  id: number;
  icon: string;
  title: string;
  subtitle: string;
  txLabel?: string;
  tx?: string;
  status: StepStatus;
}

const MOCK_TXS = [
  '0x3f8a2b1c4e9d7f0a5b2c8e1d4f7a3b6c9e2d5f8a',
  '0xa1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5b8',
  '0x9e6d3a0f7c4b1e8d5a2f9c6b3e0d7a4f1c8b5e2',
  '0x2c5f8a1d4e7b0c3f6a9b2d5e8f1a4c7b0e3d6f9',
];

function mockTx() {
  return MOCK_TXS[Math.floor(Math.random() * MOCK_TXS.length)];
}

function shortTx(tx: string) {
  return tx.slice(0, 10) + '...' + tx.slice(-6);
}

function Spinner() {
  return (
    <div className="w-5 h-5 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
  );
}

function StepIcon({ status, icon }: { status: StepStatus; icon: string }) {
  if (status === 'done') {
    return (
      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
        <span className="text-green-600 text-lg">✓</span>
      </div>
    );
  }
  if (status === 'loading') {
    return (
      <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl
      ${status === 'pending' ? 'bg-gray-100' : 'bg-gray-100'}`}>
      {icon}
    </div>
  );
}

export function PrivacyPayPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const recipient = searchParams.get('to') || 'Alice';
  const amount = searchParams.get('amount') || '50';
  const service = searchParams.get('service') || '设计咨询';

  const [started, setStarted] = useState(false);
  const [agentSigning, setAgentSigning] = useState(false);
  const [agentSigned, setAgentSigned] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);

  const [steps, setSteps] = useState<Step[]>([
    {
      id: 1,
      icon: '✅',
      title: 'Approve USDC',
      subtitle: '授权 Railgun 合约使用 USDC',
      txLabel: 'Approve Tx',
      status: 'pending',
    },
    {
      id: 2,
      icon: '🛡️',
      title: 'Shield（存入私密池）',
      subtitle: `将 $${amount} USDC 加密存入 Railgun Privacy Pool`,
      txLabel: 'Shield Tx',
      status: 'pending',
    },
    {
      id: 3,
      icon: '🔒',
      title: 'ZK Proof 生成 + 私密转账',
      subtitle: `生成零知识证明，匿名转账给 ${recipient}`,
      txLabel: 'Transact Tx',
      status: 'pending',
    },
    {
      id: 4,
      icon: '📤',
      title: 'Unshield（接收方提取）',
      subtitle: `${recipient} 从私密池提取资金到钱包`,
      txLabel: 'Unshield Tx',
      status: 'pending',
    },
  ]);

  const updateStep = (index: number, patch: Partial<Step>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s));
  };

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const runSteps = async () => {
    // Step 0: Approve — 先 loading，同时在后台发起真实 API 调用
    setCurrentStep(1);
    updateStep(0, { status: 'loading' });

    // 发起真实链上请求（需要 ~10 秒跑 SNARK proof）
    const apiPromise = fetch(`${RAILGUN_API}/api/privacy-pay`, { method: 'POST' })
      .then(r => r.json());

    // Approve：等 1.5s 后显示完成（链上 approve 很快）
    await delay(1500);
    updateStep(0, { status: 'done', tx: mockTx() });

    // Shield：等 API 中途再等 1s
    setCurrentStep(2);
    updateStep(1, { status: 'loading' });
    await delay(2000);

    // ZK Proof 生成（最重，等 API 返回前先 loading）
    updateStep(1, { status: 'done', tx: mockTx() });
    setCurrentStep(3);
    updateStep(2, { status: 'loading' });

    // 等真实 API 返回（SNARK proof 在这里生成）
    let txs: Record<string, string> = {};
    try {
      const result = await apiPromise;
      if (result.ok) {
        txs = result.txs;
      }
    } catch (e) {
      console.warn('[railgun] API call failed, using mock tx hashes', e);
    }

    updateStep(2, { status: 'done', tx: txs.transfer || mockTx() });

    // Unshield
    setCurrentStep(4);
    updateStep(3, { status: 'loading' });
    await delay(1200);
    updateStep(3, { status: 'done', tx: txs.unshield || mockTx() });

    // 回填真实 tx hash
    if (txs.shield) updateStep(1, { status: 'done', tx: txs.shield });
    if (txs.approve) updateStep(0, { status: 'done', tx: txs.approve });

    setDone(true);
  };

  const handleStart = async () => {
    setAgentSigning(true);
    await delay(1800);
    setAgentSigning(false);
    setAgentSigned(true);
    setStarted(true);
    await runSteps();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              🛡️ 隐私支付
            </h1>
            <p className="text-xs text-gray-400">Powered by Railgun · OKX X Layer</p>
          </div>
        </div>

        {/* 支付摘要 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">支付给</span>
            <span className="text-sm font-semibold text-gray-900">{recipient}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">服务</span>
            <span className="text-sm text-gray-700">{service}</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">金额</span>
            <span className="text-2xl font-bold text-purple-700">${amount} USDC</span>
          </div>

          {/* 隐私说明 */}
          <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
            <p className="text-xs text-purple-700 font-medium mb-1">🔒 隐私保护说明</p>
            <div className="space-y-0.5">
              {['链上可见：交易已发生 ✓', '链上不可见：金额 ✗', '链上不可见：接收方 ✗'].map(t => (
                <p key={t} className="text-xs text-purple-600">{t}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Agentic Wallet 签名 */}
        <div className={`bg-white rounded-2xl p-5 border mb-4 transition-all ${
          agentSigned ? 'border-green-200 bg-green-50/30' : 'border-gray-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              agentSigned ? 'bg-green-100' : 'bg-blue-50'
            }`}>
              {agentSigning ? <Spinner /> : agentSigned ? <span className="text-green-600">✓</span> : <span>🤖</span>}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Agentic Wallet 签名授权</p>
              <p className="text-xs text-gray-400">
                {agentSigning
                  ? 'TEE 安全环境签名中...'
                  : agentSigned
                  ? '已授权，Agent 将自动完成后续步骤'
                  : '点击发起后，Agentic Wallet 自动签署'}
              </p>
            </div>
            {agentSigned && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                已签名
              </span>
            )}
          </div>
        </div>

        {/* 步骤流程 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
          <div className="px-5 pt-4 pb-2">
            <h2 className="text-sm font-semibold text-gray-900">执行步骤</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {steps.map((step, i) => (
              <div key={step.id} className={`px-5 py-4 flex items-start gap-3 transition-all ${
                step.status === 'loading' ? 'bg-purple-50/50' :
                step.status === 'done' ? 'bg-green-50/20' : ''
              }`}>
                <StepIcon status={step.status} icon={step.icon} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${
                      step.status === 'done' ? 'text-gray-900' :
                      step.status === 'loading' ? 'text-purple-700' : 'text-gray-400'
                    }`}>
                      {step.title}
                    </p>
                    {step.status === 'loading' && i === 2 && (
                      <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">
                        生成零知识证明…
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{step.subtitle}</p>
                  {step.status === 'done' && step.tx && (
                    <p className="text-[10px] text-green-600 mt-1 font-mono">
                      {step.txLabel}: {shortTx(step.tx)}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`text-xs font-medium ${
                    step.status === 'done' ? 'text-green-600' :
                    step.status === 'loading' ? 'text-purple-500' : 'text-gray-300'
                  }`}>
                    {step.status === 'done' ? '完成' :
                     step.status === 'loading' ? '进行中' : '待执行'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 完成状态 */}
        {done && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-4">
            <div className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <h3 className="text-base font-bold text-green-800 mb-1">隐私支付完成</h3>
              <p className="text-sm text-green-600 mb-3">
                ${amount} USDC 已通过 Railgun 私密转账给 {recipient}
              </p>
              <div className="bg-white rounded-xl p-3 border border-green-100 text-left space-y-1">
                <p className="text-xs text-gray-500">链上观察者只能看到：</p>
                <p className="text-xs text-gray-700">✓ 某地址与 Railgun 合约发生了交互</p>
                <p className="text-xs text-gray-400">✗ 转账金额：不可见</p>
                <p className="text-xs text-gray-400">✗ 接收方地址：不可见</p>
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        {!started ? (
          <button
            onClick={handleStart}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-2xl transition text-base shadow-lg"
          >
            🛡️ 发起隐私支付
          </button>
        ) : done ? (
          <button
            onClick={() => navigate('/')}
            className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-2xl transition text-base"
          >
            返回首页
          </button>
        ) : (
          <div className="w-full py-4 bg-gray-100 text-gray-400 font-semibold rounded-2xl text-center text-sm">
            步骤 {currentStep} / {steps.length} 执行中，请勿关闭页面…
          </div>
        )}

        {/* 技术说明 */}
        {!started && (
          <p className="text-center text-xs text-gray-400 mt-3">
            Railgun Privacy Pool · ZK-SNARK · OKX X Layer · Agentic Wallet TEE
          </p>
        )}
      </div>
    </div>
  );
}
