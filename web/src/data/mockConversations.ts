/**
 * Mock 对话记录 — 模拟多场真实交互场景
 * 用于 Platform Agent 规则评估
 */
import { ChatMessage, Rule, RuleSet } from '../types';

// =========================================
// 场景 1：Alice 交友场景（规则全部满足）
// 规则: CONVERSATION(min 10), CONTACT_SHARED, PHOTO_EXCHANGE
// =========================================
export const CONVERSATION_ALICE: ChatMessage[] = [
  { id: 'a-1',  sender: 'THEM', depositId: 'd-1', content: 'hi，我是Alice，很高兴认识你 ☺️', timestamp: 1710000000, type: 'TEXT' },
  { id: 'a-2',  sender: 'YOU',  depositId: 'd-1', content: '你好 Alice！看到你也喜欢摄影，好巧~', timestamp: 1710000060, type: 'TEXT' },
  { id: 'a-3',  sender: 'THEM', depositId: 'd-1', content: '对呀，最近在学人像摄影，你平时拍什么类型？', timestamp: 1710000120, type: 'TEXT' },
  { id: 'a-4',  sender: 'YOU',  depositId: 'd-1', content: '我主要拍风景和街拍，偶尔也拍人像', timestamp: 1710000180, type: 'TEXT' },
  { id: 'a-5',  sender: 'THEM', depositId: 'd-1', content: '太好了！你有什么推荐的镜头吗？', timestamp: 1710000240, type: 'TEXT' },
  { id: 'a-6',  sender: 'YOU',  depositId: 'd-1', content: '35mm 定焦很万能，适合扫街也适合人像', timestamp: 1710000300, type: 'TEXT' },
  { id: 'a-7',  sender: 'THEM', depositId: 'd-1', content: '我正想入一支！你周末有空一起出去拍照吗？', timestamp: 1710000360, type: 'TEXT' },
  { id: 'a-8',  sender: 'YOU',  depositId: 'd-1', content: '当然可以，上周末我去了西湖边，光线特别好', timestamp: 1710000420, type: 'TEXT' },
  { id: 'a-9',  sender: 'THEM', depositId: 'd-1', content: '哇好棒！你方便发一张你拍的照片给我看看吗？', timestamp: 1710000480, type: 'TEXT' },
  { id: 'a-10', sender: 'YOU',  depositId: 'd-1', content: '📸 [分享了一张照片]', timestamp: 1710000540, type: 'PHOTO', photoUrl: 'https://example.com/photo1.jpg' },
  { id: 'a-11', sender: 'THEM', depositId: 'd-1', content: '拍得好好看！这是我最近拍的一组', timestamp: 1710000600, type: 'TEXT' },
  { id: 'a-12', sender: 'THEM', depositId: 'd-1', content: '📸 [分享了一张照片]', timestamp: 1710000610, type: 'PHOTO', photoUrl: 'https://example.com/photo2.jpg' },
  { id: 'a-13', sender: 'YOU',  depositId: 'd-1', content: '构图很有感觉！我觉得我们可以约一次外拍', timestamp: 1710000660, type: 'TEXT' },
  { id: 'a-14', sender: 'THEM', depositId: 'd-1', content: '好呀好呀！那先加个微信方便联系？', timestamp: 1710000720, type: 'TEXT' },
  { id: 'a-15', sender: 'YOU',  depositId: 'd-1', content: '📱 我的微信号：photo_rick_123', timestamp: 1710000780, type: 'CONTACT' },
  { id: 'a-16', sender: 'THEM', depositId: 'd-1', content: '📱 我的微信号：alice_design_art', timestamp: 1710000840, type: 'CONTACT' },
  { id: 'a-17', sender: 'YOU',  depositId: 'd-1', content: '已添加，周六见！', timestamp: 1710000900, type: 'TEXT' },
  { id: 'a-18', sender: 'THEM', depositId: 'd-1', content: '好的，期待~', timestamp: 1710000960, type: 'TEXT' },
];

export const RULESET_ALICE: RuleSet = {
  id: 'rs-1',
  rules: [
    { id: 'r-1', type: 'CONVERSATION', required: true, bonus: false, minValue: 10, description: '双方各聊≥10条' },
    { id: 'r-2', type: 'CONTACT_SHARED', required: true, bonus: false, description: '交换联系方式' },
    { id: 'r-3', type: 'PHOTO_EXCHANGE', required: false, bonus: true, description: '交换照片' },
    { id: 'r-3b', type: 'VIDEO_CALL', required: false, bonus: true, minValue: 300, description: '完成≥5分钟视频通话' },
  ],
  minRepScore: 0,
  createdAt: 1710000000,
};


// =========================================
// 场景 2：Bob 技术咨询（部分满足 — 聊了但没视频）
// 规则: VIDEO_CALL(min 300s), CONVERSATION(min 5)
// =========================================
export const CONVERSATION_BOB: ChatMessage[] = [
  { id: 'b-1',  sender: 'THEM', depositId: 'd-2', content: 'hi，我是Bob，很高兴认识你', timestamp: 1710100000, type: 'TEXT' },
  { id: 'b-2',  sender: 'YOU',  depositId: 'd-2', content: '你好 Bob！我想咨询一些区块链相关的问题', timestamp: 1710100060, type: 'TEXT' },
  { id: 'b-3',  sender: 'THEM', depositId: 'd-2', content: '没问题，你想了解哪方面？', timestamp: 1710100120, type: 'TEXT' },
  { id: 'b-4',  sender: 'YOU',  depositId: 'd-2', content: '主要是智能合约安全审计，最近我们项目要上线', timestamp: 1710100180, type: 'TEXT' },
  { id: 'b-5',  sender: 'THEM', depositId: 'd-2', content: '合约审计最重要的几点：重入攻击、整数溢出、权限控制', timestamp: 1710100240, type: 'TEXT' },
  { id: 'b-6',  sender: 'YOU',  depositId: 'd-2', content: '我们用的是 Foundry，现在测试覆盖率大概 80%', timestamp: 1710100300, type: 'TEXT' },
  { id: 'b-7',  sender: 'THEM', depositId: 'd-2', content: '不错，建议加 fuzz testing，很多边界情况只靠单元测试抓不到', timestamp: 1710100360, type: 'TEXT' },
  { id: 'b-8',  sender: 'YOU',  depositId: 'd-2', content: '好的记下了，那关于 proxy 升级模式有什么建议？', timestamp: 1710100420, type: 'TEXT' },
  { id: 'b-9',  sender: 'THEM', depositId: 'd-2', content: '推荐 UUPS，比 Transparent Proxy gas 更低，但要注意升级函数的 access control', timestamp: 1710100480, type: 'TEXT' },
  { id: 'b-10', sender: 'YOU',  depositId: 'd-2', content: '明白了，非常有帮助，谢谢！我们可以视频详细讨论吗？', timestamp: 1710100540, type: 'TEXT' },
  { id: 'b-11', sender: 'THEM', depositId: 'd-2', content: '可以的，不过我今天时间不太够，我们约明天下午？', timestamp: 1710100600, type: 'TEXT' },
  { id: 'b-12', sender: 'YOU',  depositId: 'd-2', content: '好的，那先这样，明天见', timestamp: 1710100660, type: 'TEXT' },
];

export const RULESET_BOB: RuleSet = {
  id: 'rs-2',
  rules: [
    { id: 'r-4', type: 'CONVERSATION', required: true, bonus: false, minValue: 5, description: '双方各聊≥5条' },
    { id: 'r-5', type: 'VIDEO_CALL', required: true, bonus: false, minValue: 300, description: '至少5分钟视频通话' },
    { id: 'r-5b', type: 'CONTACT_SHARED', required: true, bonus: false, description: '交换联系方式' },
  ],
  minRepScore: 50,
  createdAt: 1710100000,
};


// =========================================
// 场景 3：Carol 插画定制（含聊天+照片交换+联系方式）
// 规则: CONVERSATION(5), PHOTO_EXCHANGE, CONTACT_SHARED
// =========================================
export const CONVERSATION_CAROL: ChatMessage[] = [
  { id: 'c-1',  sender: 'THEM', depositId: 'd-3', content: 'hi，我是Carol，很高兴认识你 🐱', timestamp: 1710200000, type: 'TEXT' },
  { id: 'c-2',  sender: 'YOU',  depositId: 'd-3', content: '你好 Carol！看到你喜欢画画，太棒了', timestamp: 1710200060, type: 'TEXT' },
  { id: 'c-3',  sender: 'THEM', depositId: 'd-3', content: '是的！最近在画一组猫咪插画，你喜欢猫吗？', timestamp: 1710200120, type: 'TEXT' },
  { id: 'c-4',  sender: 'YOU',  depositId: 'd-3', content: '超喜欢！我家有两只橘猫', timestamp: 1710200180, type: 'TEXT' },
  { id: 'c-5',  sender: 'THEM', depositId: 'd-3', content: '橘猫好可爱！我家有一只英短', timestamp: 1710200240, type: 'TEXT' },
  { id: 'c-6',  sender: 'YOU',  depositId: 'd-3', content: '改天可以约线下带猫猫一起玩呀', timestamp: 1710200300, type: 'TEXT' },
  { id: 'c-7',  sender: 'THEM', depositId: 'd-3', content: '好呀！我知道一家很棒的猫咖', timestamp: 1710200360, type: 'TEXT' },
  { id: 'c-8',  sender: 'YOU',  depositId: 'd-3', content: '📍 [发送了见面位置：猫咪咖啡馆，周日下午 2 点]', timestamp: 1710200420, type: 'TEXT' },
  { id: 'c-9',  sender: 'THEM', depositId: 'd-3', content: '好的！周日下午 2 点见~', timestamp: 1710200480, type: 'TEXT' },
  { id: 'c-10', sender: 'YOU',  depositId: 'd-3', content: '太好了！先加个联系方式方便周日对接', timestamp: 1710200540, type: 'TEXT' },
  { id: 'c-11', sender: 'YOU',  depositId: 'd-3', content: '📱 我的微信号：rick_cat_lover', timestamp: 1710200600, type: 'CONTACT' },
  { id: 'c-12', sender: 'THEM', depositId: 'd-3', content: '📱 我的微信号：carol_illustration', timestamp: 1710200660, type: 'CONTACT' },
];

export const RULESET_CAROL: RuleSet = {
  id: 'rs-3',
  rules: [
    { id: 'r-6', type: 'CONVERSATION', required: true, bonus: false, minValue: 5, description: '双方各聊≥5条' },
    { id: 'r-7', type: 'CONTACT_SHARED', required: true, bonus: false, description: '交换联系方式' },
    { id: 'r-8', type: 'PHOTO_EXCHANGE', required: true, bonus: false, description: '双方交换认证照片' },
  ],
  minRepScore: 0,
  createdAt: 1710200000,
};


// =========================================
// 场景 4：失败对话 — 冷场 / 不配合
// 规则: CONVERSATION(10), PHOTO_EXCHANGE
// =========================================
export const CONVERSATION_COLD: ChatMessage[] = [
  { id: 'x-1', sender: 'THEM', depositId: 'd-4', content: 'hi', timestamp: 1710300000, type: 'TEXT' },
  { id: 'x-2', sender: 'YOU',  depositId: 'd-4', content: '你好', timestamp: 1710300120, type: 'TEXT' },
  { id: 'x-3', sender: 'THEM', depositId: 'd-4', content: '嗯', timestamp: 1710300240, type: 'TEXT' },
  { id: 'x-4', sender: 'YOU',  depositId: 'd-4', content: '你平时喜欢做什么？', timestamp: 1710300360, type: 'TEXT' },
  // ...长时间无回复
  { id: 'x-5', sender: 'YOU',  depositId: 'd-4', content: '在吗？', timestamp: 1710304000, type: 'TEXT' },
];

export const RULESET_COLD: RuleSet = {
  id: 'rs-4',
  rules: [
    { id: 'r-9',  type: 'CONVERSATION', required: true, bonus: false, minValue: 10, description: '双方各聊≥10条' },
    { id: 'r-10', type: 'PHOTO_EXCHANGE', required: true, bonus: false, description: '交换照片' },
  ],
  minRepScore: 0,
  createdAt: 1710300000,
};


// =========================================
// 索引：方便按 profile id 查找
// =========================================
export interface ConversationScenario {
  id: string;
  label: string;
  messages: ChatMessage[];
  ruleSet: RuleSet;
}

export const ALL_SCENARIOS: Record<string, ConversationScenario> = {
  '1': { id: '1', label: 'Alice — 交友全满足', messages: CONVERSATION_ALICE, ruleSet: RULESET_ALICE },
  '2': { id: '2', label: 'Bob — 咨询缺视频',  messages: CONVERSATION_BOB,   ruleSet: RULESET_BOB },
  '3': { id: '3', label: 'Carol — 插画定制',   messages: CONVERSATION_CAROL, ruleSet: RULESET_CAROL },
  'cold': { id: 'cold', label: '冷场对话',       messages: CONVERSATION_COLD,  ruleSet: RULESET_COLD },
};
