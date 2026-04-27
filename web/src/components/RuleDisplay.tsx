import React from 'react';
import { Rule, RuleSet } from '../types';

interface RuleDisplayProps {
  rule: Rule;
}

interface RuleSetDisplayProps {
  ruleSet: RuleSet;
}

const RULE_LABELS: Record<string, string> = {
  CONVERSATION: '完成对话',
  PHOTO_EXCHANGE: '交换照片',
  CONTACT_SHARED: '交换联系方式',
  SEND_LOCATION: '发送见面位置',
  DUAL_CHECKIN: '双方到达签到',
  VIDEO_CALL: '完成视频通话',
  TRANSFER: '完成转账',
};

export function RuleDisplay({ rule }: RuleDisplayProps) {
  return (
    <div className="bg-gray-50 p-3 rounded-xl">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-800 flex items-center gap-2">
            <span className={rule.required ? 'text-red-500' : 'text-green-500'}>
              {rule.required ? '●' : '○'}
            </span>
            {RULE_LABELS[rule.type] || rule.type}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5 ml-5">{rule.description}</p>
          {rule.minValue && (
            <p className="text-xs text-gray-400 mt-1 ml-5">最低要求: {rule.minValue}</p>
          )}
        </div>
        <div className="text-right">
          {rule.bonus && <span className="bg-yellow-50 text-yellow-600 text-xs px-2 py-0.5 rounded-full">加分项</span>}
        </div>
      </div>
    </div>
  );
}

export function RuleSetDisplay({ ruleSet }: RuleSetDisplayProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">规则集 #{ruleSet.id}</h3>
      <div className="space-y-2">
        {ruleSet.rules.map((rule, i) => (
          <RuleDisplay key={i} rule={rule} />
        ))}
      </div>
    </div>
  );
}
