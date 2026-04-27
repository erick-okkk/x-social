/**
 * P2P 信誉评分弹窗
 */
import React, { useState } from 'react';
import { Transaction } from '../types';

interface Props {
  transaction: Transaction;
  onSubmit: (txId: string, score: number, tag: string) => void;
  onClose: () => void;
}

const RATING_DIMENSIONS = [
  { tag: 'p2p', label: '交互体验', desc: '对方在沟通中是否友好、真诚' },
  { tag: 'matchmaking', label: '交友/服务质量', desc: '服务或交友过程的整体质量' },
  { tag: 'content', label: '内容质量', desc: '对方分享的内容是否有价值' },
];

const QUICK_SCORES = [
  { label: '差', value: 50, emoji: '😞', color: 'bg-red-100 text-red-600 border-red-200' },
  { label: '一般', value: 128, emoji: '😐', color: 'bg-yellow-100 text-yellow-600 border-yellow-200' },
  { label: '不错', value: 200, emoji: '😊', color: 'bg-green-100 text-green-600 border-green-200' },
  { label: '很棒', value: 240, emoji: '🤩', color: 'bg-purple-100 text-purple-600 border-purple-200' },
];

export function RatingModal({ transaction, onSubmit, onClose }: Props) {
  const [score, setScore] = useState<number>(200);
  const [selectedTag, setSelectedTag] = useState<string>('p2p');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const pct = Math.round((score / 255) * 100);
  const scoreColor = score >= 200 ? 'text-green-600' : score >= 128 ? 'text-yellow-600' : 'text-red-500';

  const handleSubmit = () => {
    setSubmitting(true);
    // 模拟链上交易延迟
    setTimeout(() => {
      onSubmit(transaction.id, score, selectedTag);
      setSubmitting(false);
      setSubmitted(true);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      <div className="relative z-10 bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden">
        {/* 头部 */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">交易评分</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {submitted ? (
          /* 提交成功 */
          <div className="px-5 pb-6 text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">评分已提交</h3>
            <p className="text-sm text-gray-500 mb-1">
              你给 <span className="font-medium text-gray-700">{transaction.counterparty.name}</span> 的评分为
            </p>
            <div className={`text-4xl font-bold ${scoreColor} mb-2`}>{score} / 255</div>
            <p className="text-xs text-gray-400 mb-6">
              评分已提交到链上信誉系统，将影响对方的信誉评分
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium"
            >
              完成
            </button>
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-5">
            {/* 交易信息 */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-lg">
                {transaction.type === 'ESCROW_RELEASE' ? '✅' : transaction.type === 'ESCROW_REFUND' ? '↩️' : '💰'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {transaction.counterparty.name}
                  </span>
                  {transaction.serviceName && (
                    <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                      {transaction.serviceName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {transaction.amount} {transaction.token} · {new Date(transaction.timestamp * 1000).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* 快捷评分 */}
            <div>
              <p className="text-xs text-gray-500 mb-2">快捷评分</p>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_SCORES.map((qs) => (
                  <button
                    key={qs.value}
                    onClick={() => setScore(qs.value)}
                    className={`py-2.5 rounded-xl border text-center transition ${
                      score === qs.value
                        ? qs.color + ' border-current font-medium'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-xl">{qs.emoji}</div>
                    <div className="text-[10px] mt-0.5">{qs.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 精确评分滑块 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">精确评分</p>
                <span className={`text-lg font-bold ${scoreColor}`}>{score}</span>
              </div>
              <input
                type="range"
                min={0}
                max={255}
                value={score}
                onChange={(e) => setScore(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>0</span>
                <span>{pct}%</span>
                <span>255</span>
              </div>
            </div>

            {/* 评分维度 */}
            <div>
              <p className="text-xs text-gray-500 mb-2">评分维度</p>
              <div className="space-y-2">
                {RATING_DIMENSIONS.map((dim) => (
                  <label
                    key={dim.tag}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition border ${
                      selectedTag === dim.tag
                        ? 'bg-purple-50 border-purple-200'
                        : 'bg-gray-50 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ratingTag"
                      checked={selectedTag === dim.tag}
                      onChange={() => setSelectedTag(dim.tag)}
                      className="w-4 h-4 accent-purple-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{dim.label}</p>
                      <p className="text-xs text-gray-400">{dim.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 说明 */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs text-blue-600">
                评分将写入链上信誉系统，与本次交易绑定，匿名且不可篡改。仅托管释放的交易可评分。
              </p>
            </div>

            {/* 提交 */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition text-sm disabled:opacity-50"
            >
              {submitting ? '提交中...' : `提交评分 ${score}/255`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
