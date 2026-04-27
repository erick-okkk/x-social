import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Profile, Tag, ServiceItem, ERC8004Score } from '../types';
import { useWallet } from '../hooks/useWallet';

const MOCK_PROFILES: Record<string, Profile> = {
  '1': {
    id: '1',
    commitment: '0x1234567890123456789012345678901234567890123456789012345678901234',
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f42bE4',
    name: 'Alice',
    age: 26,
    bio: '设计师 / 摄影爱好者 / 喜欢旅行和美食\n\n希望认识有趣的人一起探索世界，喜欢聊艺术、设计和生活方式。周末经常去看展、拍照、逛咖啡馆。',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=800&fit=crop',
    photos: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=800&fit=crop',
    ],
    photoAuthenticityPercent: 95,
    tags: [
      { type: 'IDENTITY', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '身份认证' },
      { type: 'EDUCATION', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '学历' },
      { type: 'HEALTH', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '体检' },
      { type: 'INCOME', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '收入' },
    ],
    services: [
      { id: 's1', name: '设计咨询', description: 'UI/UX 设计方案评审', icon: '🎨', price: '15', priceWei: '15000000', ruleSetId: '', category: 'consulting' },
      { id: 's2', name: '摄影指导', description: '摄影构图与后期技巧分享', icon: '📸', price: '20', priceWei: '20000000', ruleSetId: '', category: 'service' },
    ],
    erc8004Score: {
      averageScore: 218,
      totalCount: 47,
      breakdown: [
        { tag: 'p2p', label: '交互体验', score: 230, count: 28 },
        { tag: 'matchmaking', label: '交友质量', score: 210, count: 12 },
        { tag: 'content', label: '内容质量', score: 195, count: 7 },
      ],
    },
    messageFee: '0.01',
    createdAt: 1700000000,
  },
  '2': {
    id: '2',
    commitment: '0x2234567890123456789012345678901234567890123456789012345678901234',
    address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    name: 'Bob',
    age: 29,
    bio: '软件工程师 / 区块链开发者 / 开源爱好者\n\n喜欢技术、阅读和健身。希望找到一起聊技术、探索新事物的伙伴。',
    photoUrl: '/avatar-user.png',
    photoAuthenticityPercent: 88,
    tags: [
      { type: 'EDUCATION', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '学历' },
      { type: 'WORK', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '工作认证' },
    ],
    services: [
      { id: 's4', name: '技术咨询', description: '智能合约 & 区块链架构咨询', icon: '💻', price: '50', priceWei: '50000000', ruleSetId: '', category: 'consulting' },
      { id: 's5', name: '代码审查', description: 'Solidity 合约安全审计', icon: '🔍', price: '80', priceWei: '80000000', ruleSetId: '', category: 'service' },
    ],
    erc8004Score: {
      averageScore: 185,
      totalCount: 23,
      breakdown: [
        { tag: 'p2p', label: '交互体验', score: 190, count: 15 },
        { tag: 'content', label: '内容质量', score: 175, count: 8 },
      ],
    },
    messageFee: '0.05',
    createdAt: 1700000000,
  },
  '3': {
    id: '3',
    commitment: '0x3234567890123456789012345678901234567890123456789012345678901234',
    address: '0x1234567890123456789012345678901234567890',
    name: 'Carol',
    age: 24,
    bio: '插画师 / 猫咪爱好者 / 手冲咖啡\n\n画画是生活的一部分，喜欢安静的下午和好喝的咖啡。',
    photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=800&fit=crop',
    photoAuthenticityPercent: 92,
    tags: [
      { type: 'SOCIAL', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '社交信用' },
      { type: 'HEALTH', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '体检' },
    ],
    services: [
      { id: 's6', name: '插画定制', description: '定制数字插画 / 头像绘制', icon: '🎨', price: '30', priceWei: '30000000', ruleSetId: '', category: 'service' },
      { id: 's6b', name: '手冲教学', description: '手冲咖啡技巧分享', icon: '☕', price: '5', priceWei: '5000000', ruleSetId: '', category: 'social' },
    ],
    erc8004Score: {
      averageScore: 240,
      totalCount: 61,
      breakdown: [
        { tag: 'p2p', label: '交互体验', score: 245, count: 35 },
        { tag: 'matchmaking', label: '交友质量', score: 238, count: 18 },
        { tag: 'content', label: '内容质量', score: 230, count: 8 },
      ],
    },
    messageFee: '0.02',
    createdAt: 1700000000,
  },
};

export { MOCK_PROFILES };

// ==========================================
// 根据服务类别返回 Platform Agent 评估维度
// ==========================================
function getEvalCriteria(category: string): { icon: string; label: string; desc: string }[] {
  switch (category) {
    case 'consulting':
      return [
        { icon: '💬', label: '沟通质量', desc: '回复及时性、表达清晰度' },
        { icon: '🎯', label: '专业深度', desc: '是否提供了专业且有针对性的建议' },
        { icon: '📋', label: '交付完整', desc: '是否完成约定的咨询内容' },
        { icon: '⭐', label: '客户满意', desc: '双方互评分数达标' },
      ];
    case 'service':
      return [
        { icon: '📦', label: '成果交付', desc: '按约定时间交付最终成果物' },
        { icon: '🔄', label: '过程沟通', desc: '中间进度是否及时同步' },
        { icon: '✅', label: '质量验收', desc: '成果符合预期描述和标准' },
        { icon: '⭐', label: '客户满意', desc: '双方互评分数达标' },
      ];
    case 'social':
      return [
        { icon: '🤝', label: '参与度', desc: '双方是否有实质性互动' },
        { icon: '😊', label: '氛围积极', desc: '对话氛围友好且正向' },
        { icon: '⏱️', label: '时间投入', desc: '服务时长是否满足约定' },
        { icon: '⭐', label: '双方满意', desc: '双方互评分数达标' },
      ];
    default:
      return [
        { icon: '💬', label: '沟通质量', desc: '双方有效互动' },
        { icon: '📋', label: '任务完成', desc: '约定内容按时完成' },
        { icon: '⭐', label: '双方满意', desc: '双方互评分数达标' },
      ];
  }
}

export function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const { address } = useWallet();

  useEffect(() => {
    if (id && MOCK_PROFILES[id]) {
      setProfile(MOCK_PROFILES[id]);
    }
  }, [id]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-xl">找不到该用户</p>
      </div>
    );
  }

  const photos = profile.photos || [profile.photoUrl];

  const handleStartChat = () => {
    if (!address) {
      navigate('/my-profile');
      return;
    }
    navigate(`/chat/${profile.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-900 text-2xl">
          &#8249;
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{profile.name} 的主页</h1>
      </div>

      {/* 主卡片 */}
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* 上半部分：照片 + 介绍 并排 */}
          <div className="flex flex-col sm:flex-row">
            {/* 左：照片区域 */}
            <div className="sm:w-3/5 relative bg-gray-100">
              <img
                src={photos[currentPhotoIdx]}
                alt={profile.name}
                className="w-full h-72 sm:h-96 object-cover"
              />
              {/* 照片真实度 badge */}
              <div className="absolute top-3 left-3 bg-white bg-opacity-90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-gray-700 shadow-sm">
                照片真实度 {profile.photoAuthenticityPercent}%
              </div>
              {/* 照片切换指示器 */}
              {photos.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPhotoIdx(i)}
                      className={`w-2 h-2 rounded-full transition ${i === currentPhotoIdx ? 'bg-white' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 右：介绍区域 */}
            <div className="sm:w-2/5 p-5 flex flex-col">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {profile.name}{profile.age ? `, ${profile.age}` : ''}
                </h2>
                {profile.messageFee && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm text-green-600">
                    <span className="text-xs">⚡</span>
                    <span>${profile.messageFee}/条消息</span>
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-500 mb-2">介绍</h3>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {profile.bio}
                </p>
              </div>
            </div>
          </div>

          {/* 8004 评分 */}
          {profile.erc8004Score && (
            <div className="border-t border-gray-100 p-5">
              <ERC8004ScoreDisplay score={profile.erc8004Score} />
            </div>
          )}

          {/* 下半部分：历史认证 + 聊天按钮 并排 */}
          <div className="border-t border-gray-100 flex flex-col sm:flex-row">
            {/* 左下：历史认证 */}
            <div className="sm:w-3/5 p-5 border-r border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">历史认证</h3>
              <div className="space-y-2">
                {profile.tags.length > 0 ? (
                  profile.tags.map((tag, i) => (
                    <VerificationRow key={i} tag={tag} />
                  ))
                ) : (
                  <p className="text-sm text-gray-400">暂无认证</p>
                )}
              </div>
            </div>

            {/* 右下：聊天按钮 */}
            <div className="sm:w-2/5 p-5 flex items-center justify-center">
              <button
                onClick={handleStartChat}
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold rounded-xl transition text-lg shadow-sm"
              >
                聊天
              </button>
            </div>
          </div>
        </div>

        {/* 可预约服务 — 点击展开评估条件 */}
        {profile.services && profile.services.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">可预约服务</h3>
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <span>🤖</span> Platform Agent 评估
              </span>
            </div>
            <div className="space-y-2">
              {profile.services.map((svc) => {
                const isExpanded = expandedServiceId === svc.id;
                const criteria = getEvalCriteria(svc.category);

                return (
                  <div key={svc.id} className={`rounded-xl border transition overflow-hidden ${isExpanded ? 'border-purple-200 bg-purple-50/30' : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}>
                    {/* 服务主行 */}
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer"
                      onClick={() => setExpandedServiceId(isExpanded ? null : svc.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{svc.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                          <p className="text-xs text-gray-500">{svc.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-purple-600">${svc.price}</span>
                        <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                      </div>
                    </div>

                    {/* 展开：评估维度 + 预约按钮 */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-gray-100 pt-3">
                        <p className="text-[10px] text-gray-400 mb-2">Platform Agent 将关注以下维度评估服务完成度：</p>
                        <div className="space-y-1.5 mb-3">
                          {criteria.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                              <span className="text-sm">{c.icon}</span>
                              <span className="font-medium">{c.label}</span>
                              <span className="text-gray-400">—</span>
                              <span className="text-gray-500">{c.desc}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg mb-3">
                          <span className="text-xs">🤖</span>
                          <p className="text-[10px] text-blue-600">评估达标后托管资金自动释放，高信誉用户享受快速通道</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/chat/${profile.id}?service=${svc.id}`); }}
                          className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition"
                        >
                          预约此服务 · ${svc.price} USDC
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ERC8004ScoreDisplay({ score }: { score: ERC8004Score }) {
  const pct = Math.round((score.averageScore / 255) * 100);
  const getScoreColor = (s: number) => {
    if (s >= 200) return 'text-green-600';
    if (s >= 150) return 'text-yellow-600';
    return 'text-red-500';
  };
  const getBarColor = (s: number) => {
    if (s >= 200) return 'bg-green-500';
    if (s >= 150) return 'bg-yellow-500';
    return 'bg-red-400';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">ERC-8004 信誉评分</h3>
        <span className="text-xs text-gray-400">{score.totalCount} 次评价</span>
      </div>

      {/* 综合分 */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`text-3xl font-bold ${getScoreColor(score.averageScore)}`}>
          {score.averageScore}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">综合评分</span>
            <span className="text-xs text-gray-400">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getBarColor(score.averageScore)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 分维度 */}
      {score.breakdown.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {score.breakdown.map((dim) => {
            const dimPct = Math.round((dim.score / 255) * 100);
            return (
              <div key={dim.tag} className="bg-gray-50 rounded-xl p-3 text-center">
                <div className={`text-lg font-bold ${getScoreColor(dim.score)}`}>{dim.score}</div>
                <div className="text-xs text-gray-500 mt-0.5">{dim.label}</div>
                <div className="text-xs text-gray-400">{dim.count}次</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VerificationRow({ tag }: { tag: Tag }) {
  const tagConfig: Record<string, { icon: string; color: string }> = {
    IDENTITY: { icon: '🪪', color: 'text-blue-600' },
    EDUCATION: { icon: '🎓', color: 'text-indigo-600' },
    HEALTH: { icon: '🏥', color: 'text-green-600' },
    INCOME: { icon: '💰', color: 'text-yellow-600' },
    SOCIAL: { icon: '👥', color: 'text-pink-600' },
    WORK: { icon: '💼', color: 'text-orange-600' },
  };
  const cfg = tagConfig[tag.type] || { icon: '📋', color: 'text-gray-600' };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
      <div className="flex items-center gap-3">
        <span className="text-lg">{cfg.icon}</span>
        <span className="text-sm font-medium text-gray-800">{tag.label || tag.type}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {tag.verified ? (
          <>
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-xs text-green-600 font-medium">已验证</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-gray-300"></span>
            <span className="text-xs text-gray-400">未验证</span>
          </>
        )}
      </div>
    </div>
  );
}
