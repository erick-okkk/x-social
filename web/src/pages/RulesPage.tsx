import React, { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useNavigate } from 'react-router-dom';
import { Rule, RuleSet } from '../types';
import { RuleDisplay } from '../components/RuleDisplay';

const RULE_LABELS: Record<string, string> = {
  CONVERSATION: '完成对话',
  PHOTO_EXCHANGE: '交换照片',
  CONTACT_SHARED: '交换联系方式',
  SEND_LOCATION: '发送见面位置',
  DUAL_CHECKIN: '双方到达签到',
  VIDEO_CALL: '完成视频通话',
  TRANSFER: '完成转账',
};

const RULE_DESCRIPTIONS: Record<string, string> = {
  CONVERSATION: '要求双方达到最低消息交换数',
  PHOTO_EXCHANGE: '双方交换认证照片',
  CONTACT_SHARED: '双方交换联系方式',
  SEND_LOCATION: '发送线下见面的地点位置',
  DUAL_CHECKIN: '双方到达见面地点后签到确认',
  VIDEO_CALL: '完成视频通话验证',
  TRANSFER: '完成自定义金额转账',
};

const AVAILABLE_RULE_TYPES = [
  'CONVERSATION',
  'PHOTO_EXCHANGE',
  'CONTACT_SHARED',
  'SEND_LOCATION',
  'DUAL_CHECKIN',
  'VIDEO_CALL',
  'TRANSFER',
];

export function RulesPage() {
  const { address } = useWallet();
  const navigate = useNavigate();
  const [selectedRules, setSelectedRules] = useState<Rule[]>([]);
  const [minRepScore, setMinRepScore] = useState('0');
  const [showPreview, setShowPreview] = useState(false);

  if (!address) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-gray-700 text-base mb-4">请先连接钱包</p>
          <button
            onClick={() => navigate('/wallet')}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition text-sm"
          >
            前往钱包
          </button>
        </div>
      </div>
    );
  }

  const toggleRule = (ruleType: string) => {
    const existingRule = selectedRules.find((r) => r.type === ruleType);

    if (existingRule) {
      setSelectedRules(selectedRules.filter((r) => r.type !== ruleType));
    } else {
      const newRule: Rule = {
        id: Math.random().toString(),
        type: ruleType as any,
        required: true,
        bonus: false,
        minValue: ruleType === 'VIDEO_CALL' ? 300 : 5,
        description: RULE_DESCRIPTIONS[ruleType] || `${ruleType} requirement`,
      };
      setSelectedRules([...selectedRules, newRule]);
    }
  };

  const updateRule = (id: string, field: keyof Rule, value: any) => {
    setSelectedRules(selectedRules.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = async () => {
    if (selectedRules.length === 0) {
      alert('请至少选择一条规则');
      return;
    }

    const ruleSet: RuleSet = {
      id: Math.random().toString(),
      rules: selectedRules,
      minRepScore: parseInt(minRepScore),
      createdAt: Math.floor(Date.now() / 1000),
    };

    alert(`规则集已创建: ${JSON.stringify(ruleSet, null, 2)}`);
    setSelectedRules([]);
    setShowPreview(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">管理规则</h1>

        {/* 选择规则 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-1">选择规则</h2>
          <p className="text-xs text-gray-400 mb-4">选择你想要执行的规则</p>

          <div className="space-y-2">
            {AVAILABLE_RULE_TYPES.map((ruleType) => {
              const isSelected = selectedRules.some((r) => r.type === ruleType);
              return (
                <label
                  key={ruleType}
                  className={`flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition ${
                    isSelected ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRule(ruleType)}
                    className="w-4 h-4 mt-0.5 accent-purple-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{RULE_LABELS[ruleType] || ruleType}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{RULE_DESCRIPTIONS[ruleType]}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* 配置规则 */}
        {selectedRules.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
            <h2 className="text-base font-semibold text-gray-900 mb-4">配置规则</h2>

            <div className="space-y-4">
              {selectedRules.map((rule) => (
                <div key={rule.id} className="bg-gray-50 p-4 rounded-xl">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-sm font-medium text-gray-800">{RULE_LABELS[rule.type] || rule.type}</h3>
                    <button
                      onClick={() =>
                        setSelectedRules(selectedRules.filter((r) => r.id !== rule.id))
                      }
                      className="text-gray-400 hover:text-red-400 transition text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">描述</label>
                      <input
                        type="text"
                        value={rule.description}
                        onChange={(e) => updateRule(rule.id, 'description', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
                      />
                    </div>

                    {['VIDEO_CALL', 'CONVERSATION'].includes(rule.type) && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">最低要求值</label>
                        <input
                          type="number"
                          value={rule.minValue || 0}
                          onChange={(e) =>
                            updateRule(rule.id, 'minValue', parseInt(e.target.value))
                          }
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
                        />
                      </div>
                    )}

                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.required}
                          onChange={(e) =>
                            updateRule(rule.id, 'required', e.target.checked)
                          }
                          className="w-4 h-4 accent-purple-600"
                        />
                        <span className="text-xs text-gray-500">必须</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.bonus}
                          onChange={(e) =>
                            updateRule(rule.id, 'bonus', e.target.checked)
                          }
                          className="w-4 h-4 accent-purple-600"
                        />
                        <span className="text-xs text-gray-500">加分项</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 配置 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-4">规则配置</h2>

          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-xs text-gray-400 mb-1">最低信誉分</label>
              <input
                type="number"
                value={minRepScore}
                onChange={(e) => setMinRepScore(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
              />
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="w-full px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl transition border border-gray-200 text-sm"
            >
              {showPreview ? '隐藏预览' : '预览'}
            </button>

            <button
              onClick={handleSubmit}
              disabled={selectedRules.length === 0}
              className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition disabled:opacity-50 font-medium text-sm"
            >
              创建规则集
            </button>
          </div>
        </div>

        {/* 预览 */}
        {showPreview && selectedRules.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">预览</h3>
            <div className="space-y-2">
              {selectedRules.map((rule, i) => (
                <RuleDisplay key={i} rule={rule} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
