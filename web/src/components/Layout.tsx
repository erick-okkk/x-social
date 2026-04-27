import React from 'react';
import { Navbar } from './Navbar';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  // 聊天页使用全屏布局，不显示底部导航
  const isChatPage = location.pathname.startsWith('/chat/');

  if (isChatPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
      {children}
      <Navbar />
    </div>
  );
}
