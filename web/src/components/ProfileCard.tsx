import React from 'react';
import { Link } from 'react-router-dom';
import { Profile } from '../types';

interface ProfileCardProps {
  profile: Profile;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const verifiedCount = profile.tags.filter(t => t.verified).length;

  return (
    <Link to={`/profile/${profile.id}`}>
      <div className="bg-white rounded-2xl overflow-hidden hover:shadow-lg shadow-sm border border-gray-100 transition cursor-pointer h-full flex flex-col group">
        {/* 照片 */}
        <div className="relative overflow-hidden h-52">
          {profile.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt={profile.name}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-6xl">
              👤
            </div>
          )}
          {/* 照片真实度 */}
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-medium text-gray-700 shadow-sm">
            真实度 {profile.photoAuthenticityPercent}%
          </div>
          {/* 认证数 */}
          {verifiedCount > 0 && (
            <div className="absolute top-3 right-3 bg-green-500/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-medium text-white shadow-sm">
              {verifiedCount} 项认证
            </div>
          )}
        </div>

        {/* 信息 */}
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="text-lg font-bold text-gray-900">{profile.name}</h3>
            {(profile as any).age && (
              <span className="text-sm text-gray-400">{(profile as any).age}</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-3 line-clamp-2">{profile.bio}</p>

          {/* 标签 */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {profile.tags.filter(t => t.verified).slice(0, 4).map((tag, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {tag.label || tag.type}
              </span>
            ))}
          </div>

          {/* 底部：信誉评分 + 消息费 + 服务数量 */}
          <div className="border-t border-gray-100 pt-3 mt-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              {profile.erc8004Score && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">信誉</span>
                  <span className={`text-sm font-bold ${profile.erc8004Score.averageScore >= 200 ? 'text-green-600' : profile.erc8004Score.averageScore >= 150 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {profile.erc8004Score.averageScore}
                  </span>
                </div>
              )}
              {profile.messageFee && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-green-500">⚡</span>
                  <span className="text-xs font-medium text-green-600">${profile.messageFee}/条</span>
                </div>
              )}
            </div>
            {profile.services && profile.services.length > 0 && (
              <span className="text-xs text-gray-400">
                {profile.services.length} 项服务
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
