/**
 * 消息列表页 — 显示所有活跃对话
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ConversationItem {
  profileId: string;
  name: string;
  photo: string;
  lastMessage: string;
  timestamp: number;
  unread: number;
  messageFee?: string;   // 对方每条消息收费
  escrowStatus?: 'active' | 'released';
}

const MOCK_CONVERSATIONS: ConversationItem[] = [
  {
    profileId: '1',
    name: 'Alice',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    lastMessage: 'hi，我是Alice，很高兴认识你 ☺️',
    timestamp: Math.floor(Date.now() / 1000) - 300,
    unread: 2,
    messageFee: '0.01',
    escrowStatus: 'active',
  },
  {
    profileId: '2',
    name: 'Bob',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    lastMessage: '好的，我们周末见！',
    timestamp: Math.floor(Date.now() / 1000) - 3600,
    unread: 0,
    messageFee: '0.05',
    escrowStatus: 'released',
  },
  {
    profileId: '3',
    name: 'Carol',
    photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
    lastMessage: '你喜欢画画吗？我最近在画一组城市风景~',
    timestamp: Math.floor(Date.now() / 1000) - 7200,
    unread: 1,
    messageFee: '0.02',
  },
];

export function ChatListPage() {
  const navigate = useNavigate();

  const formatTime = (ts: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - ts;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    return `${Math.floor(diff / 86400)}天前`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">消息</h1>

        {MOCK_CONVERSATIONS.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-gray-500 text-sm mb-2">暂无对话</p>
            <p className="text-xs text-gray-400 mb-4">去发现页面找到感兴趣的人开始聊天</p>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition"
            >
              去发现
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {MOCK_CONVERSATIONS.map(convo => (
              <button
                key={convo.profileId}
                onClick={() => navigate(`/chat/${convo.profileId}`)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left"
              >
                {/* 头像 */}
                <div className="relative flex-shrink-0">
                  <img src={convo.photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                  {convo.unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {convo.unread}
                    </span>
                  )}
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${convo.unread > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                        {convo.name}
                      </span>
                      {convo.messageFee && (
                        <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">
                          ⚡${convo.messageFee}/条
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">{formatTime(convo.timestamp)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs truncate ${convo.unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                      {convo.lastMessage}
                    </p>
                    {convo.escrowStatus && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0 ${
                        convo.escrowStatus === 'active' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {convo.escrowStatus === 'active' ? '托管中' : '已释放'}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
