/**
 * Platform Agent — 规则评估引擎
 *
 * 模拟 DESIGN.md 中的 Platform Agent 行为：
 * - NLP 证据收集：分析聊天记录
 * - 规则评估：逐条检查 RuleSet 中的规则是否满足
 * - 仲裁决策：给出最终是否释放 Escrow 的建议
 *
 * 评估维度（7 种规则类型）：
 *   CONVERSATION    — 消息条数是否达标
 *   PHOTO_EXCHANGE  — 双方是否交换照片
 *   CONTACT_SHARED  — 双方是否分享联系方式
 *   SEND_LOCATION   — 是否发送了见面位置
 *   DUAL_CHECKIN    — 双方是否到达签到
 *   VIDEO_CALL      — 是否完成视频通话
 *   TRANSFER        — 是否完成转账
 */

import { ChatMessage, Rule, RuleSet } from '../types';

// ==========================================
// 单条规则评估结果
// ==========================================
export interface RuleEvaluation {
  rule: Rule;
  passed: boolean;
  evidence: string[];       // 支撑证据（具体消息摘要）
  details: string;          // Agent 分析说明
  currentValue?: number;    // 当前达到的值（如消息条数）
  targetValue?: number;     // 目标值
}

// ==========================================
// 整体评估结果
// ==========================================
export interface EvaluationResult {
  ruleSet: RuleSet;
  evaluations: RuleEvaluation[];
  overallPassed: boolean;      // 所有 required 规则全部通过
  requiredPassed: number;
  requiredTotal: number;
  bonusPassed: number;
  bonusTotal: number;
  recommendation: 'RELEASE' | 'HOLD' | 'REFUND';
  agentSummary: string;        // Agent 的评估总结
  evaluatedAt: number;
  conversationQuality: {
    avgResponseTime: number;    // 平均回复间隔（秒）
    engagementScore: number;    // 0-100 参与度
    sentimentScore: number;     // 0-100 情感分（正面程度）
  };
}

// ==========================================
// 证据收集器 — 从对话中提取结构化信号
// ==========================================
interface ConversationSignals {
  totalMessages: number;
  youMessages: number;
  themMessages: number;
  photosSentByYou: number;
  photosSentByThem: number;
  contactSharedByYou: boolean;
  contactSharedByThem: boolean;
  locationSentByYou: boolean;
  locationSentByThem: boolean;
  checkinByYou: boolean;
  checkinByThem: boolean;
  videoCallInitiated: boolean;
  videoCallDuration: number;       // 秒（mock 估算）
  transferCompleted: boolean;
  transferAmount: number;
  avgResponseTimeSec: number;
  conversationDurationSec: number;
  engagementScore: number;         // 0-100
  sentimentScore: number;          // 0-100
}

function collectSignals(messages: ChatMessage[]): ConversationSignals {
  const nonSystem = messages.filter(m => m.type !== 'SYSTEM' && m.type !== 'SERVICE_CARD');

  const youMsgs = nonSystem.filter(m => m.sender === 'YOU');
  const themMsgs = nonSystem.filter(m => m.sender === 'THEM');

  // 照片
  const photosSentByYou = messages.filter(m => m.sender === 'YOU' && m.type === 'PHOTO').length;
  const photosSentByThem = messages.filter(m => m.sender === 'THEM' && m.type === 'PHOTO').length;

  // 联系方式
  const contactSharedByYou = messages.some(m => m.sender === 'YOU' && m.type === 'CONTACT');
  const contactSharedByThem = messages.some(m => m.sender === 'THEM' && m.type === 'CONTACT');

  // 发送位置
  const locationSentByYou = messages.some(m =>
    m.sender === 'YOU' && (m.content.includes('发送了见面位置') || m.content.includes('📍'))
  );
  const locationSentByThem = messages.some(m =>
    m.sender === 'THEM' && (m.content.includes('发送了见面位置') || m.content.includes('📍'))
  );

  // 到达签到
  const checkinByYou = messages.some(m =>
    m.sender === 'YOU' && (m.content.includes('确认签到') || m.content.includes('已到达'))
  );
  const checkinByThem = messages.some(m =>
    m.sender === 'THEM' && (m.content.includes('确认签到') || m.content.includes('已到达'))
  );

  // 视频通话
  const videoCallInitiated = messages.some(m =>
    m.content.includes('视频通话') || m.content.includes('视频聊天')
  );

  // 视频通话时长估算：如果有视频相关消息并且对方回应了，给 mock 时长
  let videoCallDuration = 0;
  if (videoCallInitiated) {
    const videoMsg = messages.find(m => m.content.includes('视频通话'));
    const afterVideoMsgs = videoMsg
      ? messages.filter(m => m.timestamp > videoMsg.timestamp)
      : [];
    // 如果后续有回应表明完成了视频，给 mock 时长；否则为 0
    const videoCompleted = afterVideoMsgs.some(m =>
      m.content.includes('视频结束') || m.content.includes('通话很愉快')
    );
    videoCallDuration = videoCompleted ? 600 : 0; // mock: 完成了给10分钟
  }

  // 转账
  const transferMsgs = messages.filter(m =>
    m.content.includes('发起转账') || (m.type === 'SYSTEM' && m.content.includes('转账') && m.content.includes('已发送'))
  );
  const transferCompleted = transferMsgs.length > 0;
  let transferAmount = 0;
  if (transferCompleted) {
    const match = transferMsgs[0].content.match(/\$(\d+\.?\d*)/);
    if (match) transferAmount = parseFloat(match[1]);
  }

  // 回复间隔
  let avgResponseTimeSec = 0;
  if (nonSystem.length > 1) {
    const intervals: number[] = [];
    for (let i = 1; i < nonSystem.length; i++) {
      if (nonSystem[i].sender !== nonSystem[i - 1].sender) {
        intervals.push(nonSystem[i].timestamp - nonSystem[i - 1].timestamp);
      }
    }
    avgResponseTimeSec = intervals.length > 0
      ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
      : 0;
  }

  // 对话总时长
  const conversationDurationSec = nonSystem.length > 1
    ? nonSystem[nonSystem.length - 1].timestamp - nonSystem[0].timestamp
    : 0;

  // 参与度 (0-100)：双方消息比例越接近 50:50 分越高，消息越多分越高
  const balance = youMsgs.length > 0 && themMsgs.length > 0
    ? 1 - Math.abs(youMsgs.length - themMsgs.length) / (youMsgs.length + themMsgs.length)
    : 0;
  const volumeScore = Math.min(nonSystem.length / 20, 1) * 50;
  const balanceScore = balance * 50;
  const engagementScore = Math.round(volumeScore + balanceScore);

  // 情感分 (0-100)：简单基于关键词
  const positiveWords = ['开心', '喜欢', '棒', '好呀', '太好了', '期待', '不错', '可爱', '好看', '☺️', '🐱', '有趣'];
  const negativeWords = ['不行', '算了', '无聊', '再说', '不太'];
  let posCount = 0;
  let negCount = 0;
  nonSystem.forEach(m => {
    positiveWords.forEach(w => { if (m.content.includes(w)) posCount++; });
    negativeWords.forEach(w => { if (m.content.includes(w)) negCount++; });
  });
  const sentimentScore = Math.min(100, Math.max(0, 50 + (posCount - negCount) * 10));

  return {
    totalMessages: nonSystem.length,
    youMessages: youMsgs.length,
    themMessages: themMsgs.length,
    photosSentByYou,
    photosSentByThem,
    contactSharedByYou,
    contactSharedByThem,
    locationSentByYou,
    locationSentByThem,
    checkinByYou,
    checkinByThem,
    videoCallInitiated,
    videoCallDuration,
    transferCompleted,
    transferAmount,
    avgResponseTimeSec,
    conversationDurationSec,
    engagementScore,
    sentimentScore,
  };
}

// ==========================================
// 单条规则评估
// ==========================================
function evaluateRule(rule: Rule, signals: ConversationSignals, messages: ChatMessage[]): RuleEvaluation {
  switch (rule.type) {
    case 'CONVERSATION': {
      const minVal = rule.minValue || 5;
      const minSide = Math.min(signals.youMessages, signals.themMessages);
      const passed = minSide >= minVal;
      const evidence: string[] = [];
      if (signals.youMessages > 0) evidence.push(`你发送了 ${signals.youMessages} 条消息`);
      if (signals.themMessages > 0) evidence.push(`对方发送了 ${signals.themMessages} 条消息`);
      return {
        rule,
        passed,
        evidence,
        currentValue: minSide,
        targetValue: minVal,
        details: passed
          ? `对话条数达标：双方最少一方发送 ${minSide} 条（目标 ≥${minVal}），对话参与度均衡`
          : `对话条数不足：双方最少一方仅发送 ${minSide} 条（需要 ≥${minVal}）`,
      };
    }

    case 'PHOTO_EXCHANGE': {
      const passed = signals.photosSentByYou > 0 && signals.photosSentByThem > 0;
      const evidence: string[] = [];
      const photoMsgs = messages.filter(m => m.type === 'PHOTO');
      photoMsgs.forEach(m => {
        evidence.push(`${m.sender === 'YOU' ? '你' : '对方'}在 ${new Date(m.timestamp * 1000).toLocaleTimeString()} 分享了照片`);
      });
      return {
        rule,
        passed,
        evidence,
        details: passed
          ? `照片交换完成：双方各分享了照片（你 ${signals.photosSentByYou} 张，对方 ${signals.photosSentByThem} 张）`
          : `照片交换未完成：你 ${signals.photosSentByYou} 张，对方 ${signals.photosSentByThem} 张`,
      };
    }

    case 'CONTACT_SHARED': {
      const passed = signals.contactSharedByYou && signals.contactSharedByThem;
      const evidence: string[] = [];
      const contactMsgs = messages.filter(m => m.type === 'CONTACT');
      contactMsgs.forEach(m => {
        evidence.push(`${m.sender === 'YOU' ? '你' : '对方'}分享了联系方式`);
      });
      return {
        rule,
        passed,
        evidence,
        details: passed
          ? '联系方式交换完成：双方均已分享联系方式'
          : `联系方式交换未完成：${!signals.contactSharedByYou ? '你未分享' : ''}${!signals.contactSharedByThem ? '对方未分享' : ''}`,
      };
    }

    case 'SEND_LOCATION': {
      const passed = signals.locationSentByYou || signals.locationSentByThem;
      const evidence: string[] = [];
      const locMsgs = messages.filter(m => m.content.includes('见面位置') || (m.content.includes('📍') && m.sender !== 'SYSTEM'));
      locMsgs.forEach(m => {
        evidence.push(`${m.sender === 'YOU' ? '你' : '对方'}发送了见面位置`);
      });
      return {
        rule,
        passed,
        evidence,
        details: passed
          ? '见面位置已发送'
          : '尚未发送见面位置',
      };
    }

    case 'DUAL_CHECKIN': {
      const passed = signals.checkinByYou && signals.checkinByThem;
      const evidence: string[] = [];
      if (signals.checkinByYou) evidence.push('你已到达签到');
      if (signals.checkinByThem) evidence.push('对方已到达签到');
      return {
        rule,
        passed,
        evidence,
        details: passed
          ? '双方均已到达签到确认'
          : `签到未完成：${!signals.checkinByYou ? '你未签到' : ''}${!signals.checkinByYou && !signals.checkinByThem ? '，' : ''}${!signals.checkinByThem ? '对方未签到' : ''}`,
      };
    }

    case 'VIDEO_CALL': {
      const minDuration = rule.minValue || 300;
      const passed = signals.videoCallDuration >= minDuration;
      const evidence: string[] = [];
      if (signals.videoCallInitiated) {
        evidence.push('视频通话已发起');
        if (signals.videoCallDuration > 0) {
          evidence.push(`通话时长约 ${Math.round(signals.videoCallDuration / 60)} 分钟`);
        } else {
          evidence.push('通话未完成或未确认');
        }
      }
      return {
        rule,
        passed,
        evidence,
        currentValue: signals.videoCallDuration,
        targetValue: minDuration,
        details: passed
          ? `视频通话完成：时长 ${Math.round(signals.videoCallDuration / 60)} 分钟（目标 ≥${Math.round(minDuration / 60)} 分钟）`
          : signals.videoCallInitiated
            ? `视频通话未完成：已发起但${signals.videoCallDuration === 0 ? '未确认完成' : `时长仅 ${Math.round(signals.videoCallDuration / 60)} 分钟`}（需要 ≥${Math.round(minDuration / 60)} 分钟）`
            : `视频通话未发起（需要 ≥${Math.round(minDuration / 60)} 分钟）`,
      };
    }

    case 'TRANSFER': {
      const passed = signals.transferCompleted;
      const evidence: string[] = [];
      const payMsgs = messages.filter(m =>
        m.content.includes('发起转账') || (m.type === 'SYSTEM' && m.content.includes('转账'))
      );
      payMsgs.forEach(m => {
        evidence.push(`${m.sender === 'YOU' ? '你' : '系统'}：「${m.content.slice(0, 50)}」`);
      });
      return {
        rule,
        passed,
        evidence,
        currentValue: signals.transferAmount,
        targetValue: rule.minValue,
        details: passed
          ? `转账已完成：$${signals.transferAmount.toFixed(2)} USDC`
          : '未检测到转账记录',
      };
    }

    default:
      return {
        rule,
        passed: false,
        evidence: [],
        details: `未知规则类型: ${rule.type}`,
      };
  }
}

// ==========================================
// Platform Agent 主评估函数
// ==========================================
export function evaluateConversation(
  messages: ChatMessage[],
  ruleSet: RuleSet,
): EvaluationResult {
  const signals = collectSignals(messages);

  const evaluations = ruleSet.rules.map(rule => evaluateRule(rule, signals, messages));

  const requiredEvals = evaluations.filter(e => e.rule.required);
  const bonusEvals = evaluations.filter(e => e.rule.bonus);
  const requiredPassed = requiredEvals.filter(e => e.passed).length;
  const requiredTotal = requiredEvals.length;
  const bonusPassed = bonusEvals.filter(e => e.passed).length;
  const bonusTotal = bonusEvals.length;
  const overallPassed = requiredPassed === requiredTotal;

  // 推荐决策
  let recommendation: EvaluationResult['recommendation'];
  if (overallPassed) {
    recommendation = 'RELEASE';
  } else if (requiredPassed > 0 || bonusPassed > 0) {
    recommendation = 'HOLD';
  } else {
    recommendation = 'REFUND';
  }

  // 生成 Agent 总结
  const summaryParts: string[] = [];
  summaryParts.push(`📊 Platform Agent 评估完成`);
  summaryParts.push(`共 ${messages.length} 条消息，对话时长 ${Math.round(signals.conversationDurationSec / 60)} 分钟`);
  summaryParts.push(`参与度 ${signals.engagementScore}/100，情感正面度 ${signals.sentimentScore}/100`);
  summaryParts.push(`必要规则通过 ${requiredPassed}/${requiredTotal}${bonusTotal > 0 ? `，加分项 ${bonusPassed}/${bonusTotal}` : ''}`);

  if (recommendation === 'RELEASE') {
    summaryParts.push(`✅ 建议：释放 Escrow 资金`);
  } else if (recommendation === 'HOLD') {
    const failedRules = evaluations.filter(e => e.rule.required && !e.passed);
    summaryParts.push(`⏳ 建议：暂不释放，以下规则未满足：${failedRules.map(e => e.rule.description).join('、')}`);
  } else {
    summaryParts.push(`❌ 建议：退款 — 对话质量未达标`);
  }

  return {
    ruleSet,
    evaluations,
    overallPassed,
    requiredPassed,
    requiredTotal,
    bonusPassed,
    bonusTotal,
    recommendation,
    agentSummary: summaryParts.join('\n'),
    evaluatedAt: Math.floor(Date.now() / 1000),
    conversationQuality: {
      avgResponseTime: signals.avgResponseTimeSec,
      engagementScore: signals.engagementScore,
      sentimentScore: signals.sentimentScore,
    },
  };
}
