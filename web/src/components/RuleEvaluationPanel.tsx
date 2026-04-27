/**
 * Platform Agent 规则评估结果面板
 * 展示 Agent 对对话的分析结果、逐条规则评估、最终建议
 */
import React, { useState } from 'react';
import { EvaluationResult, RuleEvaluation } from '../agent/ruleEvaluator';

interface Props {
  result: EvaluationResult;
  onClose: () => void;
}

const RULE_ICONS: Record<string, string> = {
  CONVERSATION: '💬',
  PHOTO_EXCHANGE: '📸',
  CONTACT_SHARED: '📱',
  SEND_LOCATION: '📍',
  DUAL_CHECKIN: '✅',
  VIDEO_CALL: '📹',
  TRANSFER: '💸',
};

export function RuleEvaluationPanel({ result, onClose }: Props) {
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const recBg = result.recommendation === 'RELEASE'
    ? 'bg-green-50 border-green-200'
    : result.recommendation === 'HOLD'
      ? 'bg-yellow-50 border-yellow-200'
      : 'bg-red-50 border-red-200';

  const recText = result.recommendation === 'RELEASE'
    ? 'text-green-700'
    : result.recommendation === 'HOLD'
      ? 'text-yellow-700'
      : 'text-red-700';

  const recLabel = result.recommendation === 'RELEASE'
    ? '释放资金'
    : result.recommendation === 'HOLD'
      ? '暂不释放'
      : '建议退款';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      <div className="relative z-10 bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-xl">
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-gray-900">Platform Agent 评估报告</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(result.evaluatedAt * 1000).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* 建议决策 */}
          <div className={`border rounded-2xl p-4 ${recBg}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-lg font-bold ${recText}`}>{recLabel}</span>
              <span className="text-xs text-gray-400">
                必要 {result.requiredPassed}/{result.requiredTotal}
                {result.bonusTotal > 0 && ` · 加分 ${result.bonusPassed}/${result.bonusTotal}`}
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {result.agentSummary}
            </p>
          </div>

          {/* 对话质量指标 */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">对话质量分析</h3>
            <div className="grid grid-cols-3 gap-3">
              <QualityMetric
                label="参与度"
                value={result.conversationQuality.engagementScore}
                max={100}
                color={result.conversationQuality.engagementScore >= 60 ? 'green' : 'yellow'}
              />
              <QualityMetric
                label="情感正面"
                value={result.conversationQuality.sentimentScore}
                max={100}
                color={result.conversationQuality.sentimentScore >= 60 ? 'green' : 'yellow'}
              />
              <QualityMetric
                label="回复速度"
                value={Math.max(0, 100 - Math.round(result.conversationQuality.avgResponseTime / 6))}
                max={100}
                suffix={`${result.conversationQuality.avgResponseTime}s`}
                color={result.conversationQuality.avgResponseTime <= 120 ? 'green' : 'yellow'}
              />
            </div>
          </div>

          {/* 逐条规则评估 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">规则评估明细</h3>
            <div className="space-y-2">
              {result.evaluations.map((evaluation) => (
                <RuleEvalCard
                  key={evaluation.rule.id}
                  evaluation={evaluation}
                  expanded={expandedRule === evaluation.rule.id}
                  onToggle={() =>
                    setExpandedRule(expandedRule === evaluation.rule.id ? null : evaluation.rule.id)
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 质量指标小卡片
// ==========================================
function QualityMetric({
  label,
  value,
  max,
  suffix,
  color,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  color: 'green' | 'yellow' | 'red';
}) {
  const pct = Math.round((value / max) * 100);
  const barColor = color === 'green' ? 'bg-green-500' : color === 'yellow' ? 'bg-yellow-500' : 'bg-red-400';

  return (
    <div className="text-center">
      <div className="text-xl font-bold text-gray-800">{value}</div>
      <div className="text-[10px] text-gray-400 mb-1">{suffix || `/ ${max}`}</div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

// ==========================================
// 单条规则评估卡片
// ==========================================
function RuleEvalCard({
  evaluation,
  expanded,
  onToggle,
}: {
  evaluation: RuleEvaluation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const icon = RULE_ICONS[evaluation.rule.type] || '📋';
  const { rule, passed, evidence, details, currentValue, targetValue } = evaluation;

  return (
    <div
      className={`border rounded-xl overflow-hidden transition ${
        passed ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-800">{rule.description}</span>
              {!rule.required && (
                <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">加分项</span>
              )}
            </div>
            {currentValue !== undefined && targetValue !== undefined && (
              <div className="text-xs text-gray-400 mt-0.5">
                {currentValue} / {targetValue}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
          }`}>
            {passed ? '通过' : '未通过'}
          </span>
          <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-2 space-y-2">
          <p className="text-xs text-gray-600">{details}</p>
          {evidence.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1">证据链：</p>
              <div className="space-y-1">
                {evidence.map((e, i) => (
                  <div key={i} className="text-xs text-gray-500 bg-white rounded-lg px-3 py-1.5 border border-gray-100">
                    {e}
                  </div>
                ))}
              </div>
            </div>
          )}
          {currentValue !== undefined && targetValue !== undefined && (
            <div className="pt-1">
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>进度</span>
                <span>{currentValue} / {targetValue}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${passed ? 'bg-green-500' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(100, Math.round((currentValue / targetValue) * 100))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
