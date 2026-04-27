import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DiscoveryPage } from './pages/DiscoveryPage';
import { ProfilePage } from './pages/ProfilePage';
import { MyProfilePage } from './pages/MyProfilePage';
import { ChatListPage } from './pages/ChatListPage';
import { ChatPage } from './pages/ChatPage';
import { PrivacyPayPage } from './pages/PrivacyPayPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Layout>
              <DiscoveryPage />
            </Layout>
          }
        />
        <Route
          path="/profile/:id"
          element={
            <Layout>
              <ProfilePage />
            </Layout>
          }
        />
        <Route
          path="/my-profile"
          element={
            <Layout>
              <MyProfilePage />
            </Layout>
          }
        />
        <Route
          path="/messages"
          element={
            <Layout>
              <ChatListPage />
            </Layout>
          }
        />
        <Route
          path="/chat/:depositId"
          element={
            <Layout>
              <ChatPage />
            </Layout>
          }
        />
        <Route path="/privacy-pay" element={<PrivacyPayPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
