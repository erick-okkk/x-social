import React from 'react';
import { Tag } from '../types';

interface TagBadgeProps {
  tag: Tag;
  onClick?: () => void;
}

const TAG_LABELS: Record<string, string> = {
  HEALTH: '体检',
  EDUCATION: '学历',
  SOCIAL: '社交信用',
  WORK: '工作认证',
  IDENTITY: '身份认证',
  INCOME: '收入',
};

export function TagBadge({ tag, onClick }: TagBadgeProps) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    HEALTH: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-100' },
    EDUCATION: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
    SOCIAL: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-100' },
    WORK: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
    IDENTITY: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
    INCOME: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-100' },
  };

  const color = colors[tag.type] || colors.HEALTH;
  const label = tag.label || TAG_LABELS[tag.type] || tag.type;

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${color.bg} border ${color.border} cursor-pointer hover:opacity-80 transition`}
    >
      <span className={`text-xs font-medium ${color.text}`}>{label}</span>
      {tag.verified ? (
        <span className="text-xs text-green-500">✓</span>
      ) : (
        <span className="text-xs text-gray-400">未验证</span>
      )}
    </div>
  );
}
