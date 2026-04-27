import React, { useState, useEffect } from 'react';
import { ProfileCard } from '../components/ProfileCard';
import { Profile } from '../types';

const MOCK_PROFILES: Profile[] = [
  {
    id: '1',
    commitment: '0x1234567890123456789012345678901234567890123456789012345678901234',
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f42bE4',
    name: 'Alice',
    age: 26,
    bio: '设计师 / 摄影爱好者 / 喜欢旅行和美食',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop',
    photoAuthenticityPercent: 95,
    tags: [
      { type: 'IDENTITY', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '身份认证' },
      { type: 'EDUCATION', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '学历' },
      { type: 'HEALTH', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '体检' },
    ],
    services: [
      { id: 's1', name: '设计咨询', description: 'UI/UX 设计方案评审', icon: '🎨', price: '15', priceWei: '15000000', ruleSetId: '', category: 'consulting' },
      { id: 's2', name: '摄影指导', description: '摄影构图与后期技巧分享', icon: '📸', price: '20', priceWei: '20000000', ruleSetId: '', category: 'service' },
    ],
    erc8004Score: { averageScore: 218, totalCount: 47, breakdown: [
      { tag: 'p2p', label: '交互体验', score: 230, count: 28 },
      { tag: 'matchmaking', label: '交友质量', score: 210, count: 12 },
    ]},
    messageFee: '0.01',
    createdAt: 1700000000,
  },
  {
    id: '2',
    commitment: '0x2234567890123456789012345678901234567890123456789012345678901234',
    address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    name: 'Bob',
    age: 29,
    bio: '软件工程师 / 区块链开发者 / 开源爱好者',
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
    erc8004Score: { averageScore: 185, totalCount: 23, breakdown: [
      { tag: 'p2p', label: '交互体验', score: 190, count: 15 },
    ]},
    messageFee: '0.05',
    createdAt: 1700000000,
  },
  {
    id: '3',
    commitment: '0x3234567890123456789012345678901234567890123456789012345678901234',
    address: '0x1234567890123456789012345678901234567890',
    name: 'Carol',
    age: 24,
    bio: '插画师 / 猫咪爱好者 / 手冲咖啡',
    photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=500&fit=crop',
    photoAuthenticityPercent: 92,
    tags: [
      { type: 'SOCIAL', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '社交信用' },
      { type: 'HEALTH', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '体检' },
    ],
    services: [
      { id: 's6', name: '插画定制', description: '定制数字插画 / 头像绘制', icon: '🎨', price: '30', priceWei: '30000000', ruleSetId: '', category: 'service' },
      { id: 's6b', name: '手冲教学', description: '手冲咖啡技巧分享', icon: '☕', price: '5', priceWei: '5000000', ruleSetId: '', category: 'social' },
    ],
    erc8004Score: { averageScore: 240, totalCount: 61, breakdown: [
      { tag: 'p2p', label: '交互体验', score: 245, count: 35 },
      { tag: 'matchmaking', label: '交友质量', score: 238, count: 18 },
    ]},
    messageFee: '0.02',
    createdAt: 1700000000,
  },
  {
    id: '4',
    commitment: '0x4234567890123456789012345678901234567890123456789012345678901234',
    address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    name: 'Diana',
    age: 27,
    bio: '自由职业者 / 瑜伽教练 / 素食主义',
    photoUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop',
    photoAuthenticityPercent: 87,
    tags: [
      { type: 'WORK', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '工作认证' },
      { type: 'IDENTITY', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '身份认证' },
    ],
    services: [
      { id: 's7', name: '瑜伽指导', description: '1对1 瑜伽体式纠正与教学', icon: '🧘', price: '15', priceWei: '15000000', ruleSetId: '', category: 'service' },
      { id: 's8', name: '健康生活咨询', description: '饮食与运动方案建议', icon: '🥗', price: '10', priceWei: '10000000', ruleSetId: '', category: 'consulting' },
    ],
    erc8004Score: { averageScore: 162, totalCount: 11, breakdown: [
      { tag: 'p2p', label: '交互体验', score: 170, count: 8 },
    ]},
    messageFee: '0.01',
    createdAt: 1700000000,
  },
  {
    id: '5',
    commitment: '0x5234567890123456789012345678901234567890123456789012345678901234',
    address: '0x9876543210987654321098765432109876543210',
    name: 'Evan',
    age: 31,
    bio: '创业者 / 产品经理 / 马拉松爱好者',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop',
    photoAuthenticityPercent: 91,
    tags: [
      { type: 'IDENTITY', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '身份认证' },
      { type: 'EDUCATION', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '学历' },
      { type: 'INCOME', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '收入' },
    ],
    services: [
      { id: 's9', name: '创业咨询', description: '创业方向规划 & 融资策略', icon: '🚀', price: '30', priceWei: '30000000', ruleSetId: '', category: 'consulting' },
      { id: 's10', name: '产品评审', description: '产品 PRD 评审与建议', icon: '📋', price: '40', priceWei: '40000000', ruleSetId: '', category: 'consulting' },
    ],
    erc8004Score: { averageScore: 205, totalCount: 34, breakdown: [
      { tag: 'p2p', label: '交互体验', score: 210, count: 20 },
      { tag: 'content', label: '内容质量', score: 198, count: 14 },
    ]},
    messageFee: '0.03',
    createdAt: 1700000000,
  },
  {
    id: '6',
    commitment: '0x6234567890123456789012345678901234567890123456789012345678901234',
    address: '0xfedcbafedcbafedcbafedcbafedcbafedcbafedc',
    name: 'Fiona',
    age: 25,
    bio: '心理咨询师 / 读书达人 / 旅行博主',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop',
    photoAuthenticityPercent: 94,
    tags: [
      { type: 'IDENTITY', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '身份认证' },
      { type: 'WORK', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '工作认证' },
      { type: 'EDUCATION', verified: true, issuedAt: 1700000000, expiresAt: 1800000000, label: '学历' },
    ],
    services: [
      { id: 's11', name: '情感咨询', description: '情绪管理与心理疏导', icon: '💬', price: '25', priceWei: '25000000', ruleSetId: '', category: 'consulting' },
      { id: 's12', name: '读书分享', description: '好书推荐与深度讨论', icon: '📚', price: '5', priceWei: '5000000', ruleSetId: '', category: 'social' },
    ],
    erc8004Score: { averageScore: 232, totalCount: 56, breakdown: [
      { tag: 'p2p', label: '交互体验', score: 240, count: 30 },
      { tag: 'content', label: '内容质量', score: 225, count: 18 },
      { tag: 'matchmaking', label: '交友质量', score: 220, count: 8 },
    ]},
    messageFee: '0.02',
    createdAt: 1700000000,
  },
];

type FilterCategory = 'all' | 'service' | 'consulting' | 'social';

// 平台统计数据
const PLATFORM_STATS = [
  { label: 'ZK 认证用户', value: '12,847', icon: '🛡️' },
  { label: '链上交互', value: '58,392', icon: '🔗' },
  { label: '平均信誉分', value: '203', icon: '⭐' },
  { label: '托管资金释放率', value: '96.8%', icon: '✅' },
];

// 热门服务类型
const HOT_CATEGORIES = [
  { icon: '💬', label: '社交互动', desc: '分享 / 交流', key: 'social' as FilterCategory },
  { icon: '💻', label: '专业咨询', desc: '技术 / 创业', key: 'consulting' as FilterCategory },
  { icon: '🎨', label: '技能服务', desc: '设计 / 教学', key: 'service' as FilterCategory },
];

export function DiscoveryPage() {
  const [profiles] = useState<Profile[]>(MOCK_PROFILES);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');

  const filteredProfiles = profiles.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.bio.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeFilter === 'all') return matchSearch;

    const hasCategory = p.services?.some(s => s.category === activeFilter);
    return matchSearch && hasCategory;
  });

  const filters: { key: FilterCategory; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'social', label: '社交' },
    { key: 'service', label: '服务' },
    { key: 'consulting', label: '咨询' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* ====== Hero Banner ====== */}
        <div className="relative bg-gradient-to-br from-purple-600 via-purple-500 to-blue-500 rounded-2xl p-6 mb-5 overflow-hidden">
          {/* 背景装饰 */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-1/2 right-8 w-16 h-16 bg-white/5 rounded-full" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white/90 text-xl">🔐</span>
              <span className="text-white/80 text-xs font-medium bg-white/15 px-2.5 py-0.5 rounded-full">ZK-Powered</span>
            </div>
            <h1 className="text-xl font-bold text-white mb-1.5">X-Social</h1>
            <p className="text-sm text-white/80 leading-relaxed mb-4">
              隐私认证 · AI 匹配 · 链上信誉 · 安全托管
            </p>

            {/* 平台数据 */}
            <div className="grid grid-cols-4 gap-2">
              {PLATFORM_STATS.map((stat) => (
                <div key={stat.label} className="bg-white/15 backdrop-blur-sm rounded-xl px-2 py-2.5 text-center">
                  <div className="text-base mb-0.5">{stat.icon}</div>
                  <div className="text-sm font-bold text-white">{stat.value}</div>
                  <div className="text-[10px] text-white/70 leading-tight">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ====== 热门分类快捷入口 ====== */}
        <div className="flex gap-3 mb-5">
          {HOT_CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveFilter(cat.key)}
              className={`flex-1 p-3 rounded-2xl border transition text-center ${
                activeFilter === cat.key
                  ? 'bg-purple-50 border-purple-200 shadow-sm'
                  : 'bg-white border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="text-2xl mb-1">{cat.icon}</div>
              <div className="text-sm font-semibold text-gray-900">{cat.label}</div>
              <div className="text-[10px] text-gray-400">{cat.desc}</div>
            </button>
          ))}
        </div>

        {/* ====== 搜索框 ====== */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="搜索用户、技能、服务..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 shadow-sm"
          />
        </div>

        {/* ====== 分类筛选 ====== */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                activeFilter === f.key
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5 ml-auto px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-500">
            <span>🔒</span>
            <span>全部 ZK 认证</span>
          </div>
        </div>

        {/* ====== 推荐标题 ====== */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            {activeFilter === 'all' ? '为你推荐' : filters.find(f => f.key === activeFilter)?.label}
          </h2>
          <span className="text-xs text-gray-400">{filteredProfiles.length} 位用户</span>
        </div>

        {/* ====== Profile 列表 ====== */}
        {filteredProfiles.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-400 text-base mb-1">没有找到匹配的用户</p>
            <p className="text-gray-300 text-sm">试试其他关键词或分类</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProfiles.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}

        {/* ====== 底部平台说明 ====== */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 text-center">平台安全保障</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                <span className="text-lg">🛡️</span>
              </div>
              <p className="text-xs font-medium text-gray-800">ZK 零知识证明</p>
              <p className="text-[10px] text-gray-400 mt-0.5">认证不泄露隐私</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                <span className="text-lg">🤖</span>
              </div>
              <p className="text-xs font-medium text-gray-800">Agent 智能评估</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Platform Agent 仲裁</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                <span className="text-lg">⭐</span>
              </div>
              <p className="text-xs font-medium text-gray-800">ERC-8004 信誉</p>
              <p className="text-[10px] text-gray-400 mt-0.5">链上评分透明可信</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
