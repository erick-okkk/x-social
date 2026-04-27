/**
 * Everything ZK Verify SDK
 *
 * 面向开发者的 SDK，封装所有 ZK 验证 + 隐私交互功能：
 * - 身份验证提交
 * - 匹配池注册
 * - 隐私支付
 * - 匿名内容访问
 */

export { ZKVerifyClient } from './lib/client';
export { PrivacyPayment } from './lib/payment';
export { AnonymousAccess } from './lib/anonymousAccess';
export * from './types';
