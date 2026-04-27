// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IERC8004Reputation.sol";
import "./PrivacyEscrow.sol";

interface IPrivacyEscrowScoreSync {
    function syncP2PScore(bytes32 commitment, uint8 score) external;
}

/**
 * @title AgentRegistry8004
 * @notice 将 ERC-8004 评分体系嵌入 Everything ZK Verify 平台
 *
 * @dev ERC-8004 在本项目中的 3 层嵌入：
 *
 *      ┌─────────────────────────────────────────────────────────┐
 *      │  Layer 1: Agent 身份 (Identity Registry)                │
 *      │  · 我们的 Agent（撮合/仲裁/隐私网关）注册为 ERC-8004 Agent │
 *      │  · 每个 Agent 获得链上 NFT 身份，可被跨平台发现           │
 *      ├─────────────────────────────────────────────────────────┤
 *      │  Layer 2: 多维评分 (Reputation Registry)                 │
 *      │  · 用户给 Agent 打分 → Agent 的服务质量链上可查           │
 *      │  · 用户给用户打分 → 交互后的 P2P 信任评分（匿名）        │
 *      │  · 按 tag 维度分类：matchmaking / arbitration / content  │
 *      ├─────────────────────────────────────────────────────────┤
 *      │  Layer 3: 仲裁验证 (Validation Registry)                 │
 *      │  · Agent 的仲裁决策可被第三方验证者独立审核              │
 *      │  · ZK 验证标签颁发可被 zkML/TEE 验证者重新验证           │
 *      └─────────────────────────────────────────────────────────┘
 *
 *      评分维度（通过 tag1/tag2 编码）：
 *
 *      | tag1 (服务类型)       | tag2 (场景)              | 含义                    |
 *      |----------------------|--------------------------|------------------------|
 *      | keccak("matchmaking")| keccak("dating")         | 交友撮合质量            |
 *      | keccak("matchmaking")| keccak("ecommerce")      | 电商撮合质量            |
 *      | keccak("arbitration")| keccak("gate_fee")       | 门槛费仲裁公正性        |
 *      | keccak("arbitration")| keccak("service")        | 服务仲裁公正性          |
 *      | keccak("content")    | keccak("access")         | 内容访问体验            |
 *      | keccak("identity")   | keccak("verification")   | 身份验证速度/体验       |
 *      | keccak("p2p")        | keccak("interaction")    | 用户间交互体验（匿名）  |
 */
contract AgentRegistry8004 {

    // ============ 常量 Tag 定义 ============

    bytes32 public constant TAG_MATCHMAKING = keccak256("matchmaking");
    bytes32 public constant TAG_ARBITRATION = keccak256("arbitration");
    bytes32 public constant TAG_CONTENT     = keccak256("content");
    bytes32 public constant TAG_IDENTITY    = keccak256("identity");
    bytes32 public constant TAG_P2P         = keccak256("p2p");

    bytes32 public constant TAG_DATING      = keccak256("dating");
    bytes32 public constant TAG_ECOMMERCE   = keccak256("ecommerce");
    bytes32 public constant TAG_GATE_FEE    = keccak256("gate_fee");
    bytes32 public constant TAG_SERVICE     = keccak256("service");
    bytes32 public constant TAG_ACCESS      = keccak256("access");
    bytes32 public constant TAG_VERIFICATION= keccak256("verification");
    bytes32 public constant TAG_INTERACTION = keccak256("interaction");

    // ============ Structs ============

    struct AgentProfile {
        uint256 erc8004AgentId;      // ERC-8004 Identity NFT ID
        address agentAddress;
        string agentType;            // "matchmaker" | "arbitrator" | "gateway"
        bool active;
    }

    /// @dev 用户间匿名评分记录（P2P）
    struct P2PFeedback {
        bytes32 fromCommitment;      // 评分者 ZK 身份
        bytes32 toCommitment;        // 被评者 ZK 身份
        uint8 score;                 // 0-255
        bytes32 tag1;
        bytes32 tag2;
        uint256 depositId;           // 关联的 Escrow 交互 ID
        uint256 timestamp;
    }

    // ============ State ============

    IERC8004Reputation public reputationRegistry;
    PrivacyEscrow public escrow;
    address public owner;

    // 已注册 Agent
    mapping(address => AgentProfile) public agents;
    address[] public agentList;

    // P2P 评分（commitment → feedbacks received）
    mapping(bytes32 => P2PFeedback[]) public p2pFeedbacks;

    // commitment → 聚合评分缓存
    mapping(bytes32 => P2PScoreSummary) public p2pScores;

    struct P2PScoreSummary {
        uint64 totalCount;
        uint256 totalScore;          // 累加的原始分
        uint8 averageScore;          // 最新计算的平均分
        uint64 lastUpdated;
    }

    // 已评分标记（防止双重评分：keccak(from, to, depositId) → bool）
    mapping(bytes32 => bool) public hasRated;

    // ============ Events ============

    event AgentRegistered(address indexed agentAddress, uint256 erc8004AgentId, string agentType);
    event AgentFeedbackSubmitted(uint256 indexed erc8004AgentId, address indexed user, uint8 score, bytes32 tag1, bytes32 tag2);
    event P2PFeedbackSubmitted(bytes32 indexed fromCommitment, bytes32 indexed toCommitment, uint8 score, uint256 depositId);
    event P2PScoreUpdated(bytes32 indexed commitment, uint8 newAverage, uint64 totalCount);

    // ============ Modifiers ============

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    // ============ Constructor ============

    constructor(address _reputationRegistry, address _escrow) {
        owner = msg.sender;
        reputationRegistry = IERC8004Reputation(_reputationRegistry);
        escrow = PrivacyEscrow(payable(_escrow));
    }

    // ============ Agent 注册 ============

    /**
     * @notice 将我们的 Agent 注册到 ERC-8004 Identity Registry
     * @param agentAddress Agent 的链上地址
     * @param erc8004AgentId 已在 ERC-8004 Identity Registry 注册的 ID
     * @param agentType Agent 类型
     */
    function registerAgent(
        address agentAddress,
        uint256 erc8004AgentId,
        string calldata agentType
    ) external onlyOwner {
        agents[agentAddress] = AgentProfile({
            erc8004AgentId: erc8004AgentId,
            agentAddress: agentAddress,
            agentType: agentType,
            active: true
        });
        agentList.push(agentAddress);
        emit AgentRegistered(agentAddress, erc8004AgentId, agentType);
    }

    // ============ Layer 2: 用户给 Agent 评分 ============

    /**
     * @notice 用户对 Agent 的某次服务进行评分
     * @dev 评分直接写入 ERC-8004 Reputation Registry，链上可查
     *
     * 示例：
     *   rateAgent(matchmakerAddr, 200, TAG_MATCHMAKING, TAG_DATING, "", 0x0)
     *   → 给撮合 Agent 的交友服务打 200/255 分
     *
     *   rateAgent(arbitratorAddr, 240, TAG_ARBITRATION, TAG_GATE_FEE, "", 0x0)
     *   → 给仲裁 Agent 的门槛费仲裁打 240/255 分
     */
    function rateAgent(
        address agentAddress,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string calldata uri,
        bytes32 fileHash
    ) external {
        AgentProfile memory agent = agents[agentAddress];
        require(agent.active, "Agent not active");

        // 写入 ERC-8004 Reputation Registry
        reputationRegistry.giveFeedback(
            agent.erc8004AgentId,
            score,
            tag1,
            tag2,
            uri,
            fileHash,
            "" // feedbackAuth — 可以用 ZK Proof 证明评分者是真实交互用户
        );

        emit AgentFeedbackSubmitted(agent.erc8004AgentId, msg.sender, score, tag1, tag2);
    }

    /**
     * @notice 查询 Agent 的聚合评分
     * @param agentAddress Agent 地址
     * @param tag1 服务类型筛选（bytes32(0) = 全部）
     * @param tag2 场景筛选
     */
    function getAgentScore(
        address agentAddress,
        bytes32 tag1,
        bytes32 tag2
    ) external view returns (uint64 count, uint8 averageScore) {
        AgentProfile memory agent = agents[agentAddress];
        require(agent.erc8004AgentId > 0, "Agent not registered");

        address[] memory empty = new address[](0);
        IERC8004Reputation.FeedbackSummary memory summary =
            reputationRegistry.getSummary(agent.erc8004AgentId, empty, tag1, tag2);

        return (summary.count, summary.averageScore);
    }

    // ============ Layer 2: 用户间 P2P 匿名评分 ============

    /**
     * @notice 交互完成后，用户对对方进行匿名评分
     * @dev 评分与 Escrow depositId 绑定：
     *      - 只有参与了该 Escrow 的双方才能互评
     *      - 评分基于 ZK commitment，不暴露真实身份
     *      - 同一 depositId 同方向只能评一次
     *
     * @param fromCommitment 评分者 ZK 身份
     * @param toCommitment 被评者 ZK 身份
     * @param score 评分 (0-255)
     * @param depositId 关联的 Escrow 交互 ID
     * @param tag1 标签1
     * @param tag2 标签2
     */
    function submitP2PFeedback(
        bytes32 fromCommitment,
        bytes32 toCommitment,
        uint8 score,
        uint256 depositId,
        bytes32 tag1,
        bytes32 tag2
    ) external {
        // 防双重评分
        bytes32 rateKey = keccak256(abi.encodePacked(fromCommitment, toCommitment, depositId));
        require(!hasRated[rateKey], "Already rated for this interaction");

        // 验证 depositId 存在且已完成（released 或 refunded）
        PrivacyEscrow.EscrowDeposit memory deposit = escrow.getDeposit(depositId);
        require(
            deposit.status == PrivacyEscrow.EscrowStatus.RELEASED ||
            deposit.status == PrivacyEscrow.EscrowStatus.REFUNDED,
            "Deposit not settled"
        );

        // 验证评分者是该 deposit 的参与方
        require(
            deposit.senderCommitment == fromCommitment ||
            deposit.receiverCommitment == fromCommitment,
            "Not a participant"
        );
        // 验证被评者是对方
        require(
            deposit.senderCommitment == toCommitment ||
            deposit.receiverCommitment == toCommitment,
            "Target not a participant"
        );

        hasRated[rateKey] = true;

        // 存储 P2P 评分
        p2pFeedbacks[toCommitment].push(P2PFeedback({
            fromCommitment: fromCommitment,
            toCommitment: toCommitment,
            score: score,
            tag1: tag1,
            tag2: tag2,
            depositId: depositId,
            timestamp: block.timestamp
        }));

        // 更新聚合分数
        P2PScoreSummary storage summary = p2pScores[toCommitment];
        summary.totalCount++;
        summary.totalScore += score;
        summary.averageScore = uint8(summary.totalScore / summary.totalCount);
        summary.lastUpdated = uint64(block.timestamp);

        emit P2PFeedbackSubmitted(fromCommitment, toCommitment, score, depositId);
        emit P2PScoreUpdated(toCommitment, summary.averageScore, summary.totalCount);

        // 自动同步信任分到 PrivacyEscrow（用于门槛费折扣和最低信誉门槛）
        if (address(escrow) != address(0)) {
            try IPrivacyEscrowScoreSync(address(escrow)).syncP2PScore(
                toCommitment, summary.averageScore
            ) {} catch {}
        }
    }

    // ============ 评分查询 ============

    /**
     * @notice 查询用户的 P2P 信任评分
     * @dev 撮合时可以用这个分数作为匹配因子
     *      "这个人在过去的交互中评分如何？"
     */
    function getP2PScore(bytes32 commitment)
        external view returns (uint8 averageScore, uint64 totalCount)
    {
        P2PScoreSummary memory s = p2pScores[commitment];
        return (s.averageScore, s.totalCount);
    }

    /**
     * @notice 查询用户在某个维度的评分
     * @dev 筛选特定 tag 的评分，比如只看"交友"维度
     */
    function getP2PScoreByTag(bytes32 commitment, bytes32 tag1, bytes32 tag2)
        external view returns (uint8 averageScore, uint64 count)
    {
        P2PFeedback[] memory feedbacks = p2pFeedbacks[commitment];
        uint256 total = 0;
        uint64 cnt = 0;

        for (uint256 i = 0; i < feedbacks.length; i++) {
            bool match1 = (tag1 == bytes32(0)) || (feedbacks[i].tag1 == tag1);
            bool match2 = (tag2 == bytes32(0)) || (feedbacks[i].tag2 == tag2);
            if (match1 && match2) {
                total += feedbacks[i].score;
                cnt++;
            }
        }

        if (cnt == 0) return (0, 0);
        return (uint8(total / cnt), cnt);
    }

    /**
     * @notice 获取用户的所有评分记录
     */
    function getP2PFeedbacks(bytes32 commitment)
        external view returns (P2PFeedback[] memory)
    {
        return p2pFeedbacks[commitment];
    }
}
