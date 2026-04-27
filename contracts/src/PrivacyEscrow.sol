// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ZKVerifyRegistry.sol";
import "./interfaces/IERC8004Reputation.sol";

// ============ ERC-20 & EIP-2612 Minimal Interfaces ============

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IERC20Permit is IERC20 {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/**
 * @title PrivacyEscrow
 * @notice 隐私支付中转合约 —— Agent 仲裁 + ZK 隐私保护 + ERC-8004 信任评分
 * @dev 场景一：交友门槛费 —— 用户付款到合约，Agent 仲裁有效对话后释放资金
 *      场景二：匿名内容访问 —— 付费查看内容，内容创作者不知道访问者身份
 *
 *      ERC-8004 信任评分嵌入点：
 *      ┌──────────────────────────────────────────────────────────────┐
 *      │  1. 门槛费折扣 — 高信任分用户支付更低的门槛费                │
 *      │  2. 最低信誉门槛 — 接收方可设置最低信任分要求                │
 *      │  3. 快速释放 — 双方高信任分时 Agent 可跳过部分仲裁步骤       │
 *      │  4. 交互后自动触发 P2P 互评窗口                             │
 *      └──────────────────────────────────────────────────────────────┘
 */
contract PrivacyEscrow {

    // ============ Enums ============

    enum EscrowType {
        GATE_FEE,          // 交友门槛费
        CONTENT_ACCESS,    // 付费内容访问
        SERVICE_PAYMENT    // 服务支付
    }

    enum EscrowStatus {
        ACTIVE,      // 活跃（等待仲裁）
        RELEASED,    // 已释放（仲裁通过）
        REFUNDED,    // 已退款（仲裁未通过 / 超时）
        DISPUTED     // 争议中
    }

    /// @notice 用户自定义仲裁规则类型
    enum RuleType {
        CONVERSATION,        // 需要有效对话
        PHOTO_EXCHANGE,      // 需要交换照片
        CONTENT_DELIVERY,    // 需要内容交付
        OFFLINE_CHECKIN,     // 需要线下签到
        VIDEO_CALL,          // 需要视频通话
        SERVICE_COMPLETED,   // 需要服务完成
        CUSTOM_PROOF         // 自定义证明
    }

    // ============ Structs ============

    struct EscrowDeposit {
        bytes32 senderCommitment;    // 发送方 ZK 身份承诺
        bytes32 receiverCommitment;  // 接收方 ZK 身份承诺
        uint256 amount;              // 锁定金额
        uint256 originalAmount;      // 原始金额（折扣前）
        EscrowType escrowType;       // 托管类型
        EscrowStatus status;         // 状态
        uint256 createdAt;           // 创建时间
        uint256 deadline;            // 截止时间
        bytes32 conversationHash;    // 对话哈希（用于仲裁验证）
        uint256 ruleSetId;           // 关联的仲裁规则集 ID
        bool fastTrack;              // 是否快速通道（双方高信任分）
        bool isERC20;                // 是否使用 ERC-20 代币（true = ERC-20, false = 原生 ETH）
    }

    /// @notice 单条仲裁规则
    struct ArbitrationRule {
        RuleType ruleType;
        uint256 minThreshold;        // 最低阈值（如最少消息数、最短时长等）
        string description;          // 规则描述
        bool required;               // 是否必须满足
    }

    /// @notice 规则集：接收方定义的一组仲裁条件
    struct RuleSet {
        bytes32 creatorCommitment;   // 创建者 ZK 身份
        uint256[] ruleIds;           // 包含的规则 ID 列表
        uint256 gateFee;             // 门槛费（wei）
        uint8 minReputationScore;    // 最低信任分要求 (0 = 无要求)
        uint8 discountThreshold;     // 达到此信任分可享折扣 (0 = 无折扣)
        uint8 discountBps;           // 折扣比例 (basis points, e.g. 2000 = 20% off)
        bool active;
    }

    /// @notice ERC-8004 信任分配置（全局）
    struct ReputationConfig {
        uint8 fastTrackThreshold;    // 双方都 >= 此分数时启用快速通道 (默认 200)
        uint8 defaultMinScore;       // 全局默认最低信任分 (默认 0, 不限制)
        bool enabled;                // 是否启用信任分功能
    }

    // ============ State ============

    mapping(uint256 => EscrowDeposit) public deposits;
    uint256 public depositCount;

    mapping(uint256 => ArbitrationRule) public rules;
    uint256 public ruleCount;

    mapping(uint256 => RuleSet) public ruleSets;
    uint256 public ruleSetCount;

    ZKVerifyRegistry public registry;

    // ERC-20 支付代币（USDC）—— address(0) 表示仅支持 ETH
    IERC20Permit public paymentToken;

    // ERC-8004 集成
    address public agentRegistry8004;  // AgentRegistry8004 合约地址
    ReputationConfig public reputationConfig;

    // P2P 信任分缓存（commitment → score），由 AgentRegistry8004 同步
    mapping(bytes32 => uint8) public cachedP2PScores;

    // Agent 仲裁者白名单
    mapping(address => bool) public trustedAgents;

    address public owner;
    uint256 public platformFeeRate = 100; // 1% (basis points)

    // ============ Events ============

    event DepositCreated(uint256 indexed depositId, bytes32 senderCommitment, bytes32 receiverCommitment, uint256 amount, EscrowType escrowType);
    event DepositReleased(uint256 indexed depositId, address agent);
    event DepositRefunded(uint256 indexed depositId);
    event DepositDisputed(uint256 indexed depositId, address agent);
    event AgentAdded(address indexed agent);
    event RuleCreated(uint256 indexed ruleId, RuleType ruleType, bytes32 creatorCommitment);
    event RuleSetCreated(uint256 indexed ruleSetId, bytes32 creatorCommitment, uint256 gateFee);
    event ReputationDiscountApplied(uint256 indexed depositId, bytes32 senderCommitment, uint256 originalAmount, uint256 discountedAmount);
    event FastTrackEnabled(uint256 indexed depositId, bytes32 senderCommitment, bytes32 receiverCommitment);
    event P2PScoreUpdated(bytes32 indexed commitment, uint8 score);

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAgent() {
        require(trustedAgents[msg.sender], "Not trusted agent");
        _;
    }

    modifier onlyAgentRegistry() {
        require(msg.sender == agentRegistry8004, "Not AgentRegistry8004");
        _;
    }

    // ============ Constructor ============

    constructor(address _registry, address _paymentToken) {
        owner = msg.sender;
        registry = ZKVerifyRegistry(_registry);
        paymentToken = IERC20Permit(_paymentToken);
        trustedAgents[msg.sender] = true;

        // 默认信任分配置
        reputationConfig = ReputationConfig({
            fastTrackThreshold: 200,
            defaultMinScore: 0,
            enabled: true
        });
    }

    // ============ Agent & Config Management ============

    function addAgent(address _agent) external onlyOwner {
        trustedAgents[_agent] = true;
        emit AgentAdded(_agent);
    }

    function setAgentRegistry8004(address _agentRegistry) external onlyOwner {
        agentRegistry8004 = _agentRegistry;
    }

    function setPaymentToken(address _paymentToken) external onlyOwner {
        paymentToken = IERC20Permit(_paymentToken);
    }

    function setReputationConfig(
        uint8 _fastTrackThreshold,
        uint8 _defaultMinScore,
        bool _enabled
    ) external onlyOwner {
        reputationConfig = ReputationConfig({
            fastTrackThreshold: _fastTrackThreshold,
            defaultMinScore: _defaultMinScore,
            enabled: _enabled
        });
    }

    // ============ ERC-20 Permit 支付 ============

    /**
     * @notice 使用 EIP-2612 Permit 通过 ERC-20 代币创建存款
     * @dev Relayer 代表用户调用此函数，用户已通过签名授权
     * @param senderCommitment 发送方 ZK 身份承诺
     * @param receiverCommitment 接收方 ZK 身份承诺
     * @param escrowType 托管类型
     * @param duration 托管时长（秒）
     * @param ruleSetId 关联的规则集 ID
     * @param amount 代币金额
     * @param deadline permit 截止时间
     * @param v 签名 v
     * @param r 签名 r
     * @param s 签名 s
     * @param tokenHolder 代币持有人（真实支付者）
     */
    function depositViaPermit(
        bytes32 senderCommitment,
        bytes32 receiverCommitment,
        EscrowType escrowType,
        uint256 duration,
        uint256 ruleSetId,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address tokenHolder
    ) external returns (uint256) {
        require(address(paymentToken) != address(0), "Payment token not set");
        require(amount > 0, "Must deposit tokens");

        // 验证发送方至少有身份验证标签
        require(
            registry.hasValidTag(senderCommitment, ZKVerifyRegistry.TagType.IDENTITY),
            "Sender must have valid identity tag"
        );

        // 使用 Permit 授权合约转账
        paymentToken.permit(tokenHolder, address(this), amount, deadline, v, r, s);

        // 从代币持有人转账到本合约
        require(
            paymentToken.transferFrom(tokenHolder, address(this), amount),
            "Token transfer failed"
        );

        uint256 requiredAmount = amount;
        uint256 originalAmount = amount;
        bool fastTrack = false;

        // ---- ERC-8004 信任分逻辑 ----
        if (reputationConfig.enabled && ruleSetId < ruleSetCount) {
            RuleSet memory ruleSet = ruleSets[ruleSetId];
            require(ruleSet.active, "RuleSet not active");

            uint8 senderScore = cachedP2PScores[senderCommitment];
            uint8 receiverScore = cachedP2PScores[receiverCommitment];

            // 1. 最低信任分门槛
            if (ruleSet.minReputationScore > 0) {
                require(
                    senderScore >= ruleSet.minReputationScore,
                    "Sender reputation too low"
                );
            }

            // 2. 信任分折扣
            if (ruleSet.discountThreshold > 0 && senderScore >= ruleSet.discountThreshold) {
                uint256 discount = (ruleSet.gateFee * uint256(ruleSet.discountBps)) / 100;
                requiredAmount = ruleSet.gateFee - discount;

                // 多余的代币退还
                if (amount > requiredAmount) {
                    uint256 refund = amount - requiredAmount;
                    require(paymentToken.transfer(tokenHolder, refund), "Refund failed");
                }

                emit ReputationDiscountApplied(depositCount, senderCommitment, ruleSet.gateFee, requiredAmount);
            }

            // 3. 快速通道（双方高信任分）
            if (senderScore >= reputationConfig.fastTrackThreshold &&
                receiverScore >= reputationConfig.fastTrackThreshold) {
                fastTrack = true;
                emit FastTrackEnabled(depositCount, senderCommitment, receiverCommitment);
            }
        }

        uint256 depositId = depositCount++;

        deposits[depositId] = EscrowDeposit({
            senderCommitment: senderCommitment,
            receiverCommitment: receiverCommitment,
            amount: requiredAmount,
            originalAmount: originalAmount,
            escrowType: escrowType,
            status: EscrowStatus.ACTIVE,
            createdAt: block.timestamp,
            deadline: block.timestamp + duration,
            conversationHash: bytes32(0),
            ruleSetId: ruleSetId,
            fastTrack: fastTrack,
            isERC20: true
        });

        emit DepositCreated(depositId, senderCommitment, receiverCommitment, requiredAmount, escrowType);
        return depositId;
    }

    // ============ 用户自定义仲裁规则 ============

    /**
     * @notice 创建单条仲裁规则
     * @param ruleType 规则类型
     * @param minThreshold 最低阈值
     * @param description 规则描述
     * @param required 是否必须
     */
    function createRule(
        RuleType ruleType,
        uint256 minThreshold,
        string calldata description,
        bool required
    ) external returns (uint256) {
        uint256 ruleId = ruleCount++;
        rules[ruleId] = ArbitrationRule({
            ruleType: ruleType,
            minThreshold: minThreshold,
            description: description,
            required: required
        });
        emit RuleCreated(ruleId, ruleType, bytes32(0));
        return ruleId;
    }

    /**
     * @notice 创建规则集（组合多条规则 + 门槛费 + 信任分要求）
     * @param creatorCommitment 创建者 ZK 身份
     * @param ruleIds 包含的规则 ID 列表
     * @param gateFee 门槛费（wei）
     * @param minReputationScore 最低信任分 (0-255, 0 = 不限制)
     * @param discountThreshold 达到此分数享折扣 (0 = 无折扣)
     * @param discountBps 折扣比例 (basis points, 最大 5000 = 50%)
     */
    function createRuleSet(
        bytes32 creatorCommitment,
        uint256[] calldata ruleIds,
        uint256 gateFee,
        uint8 minReputationScore,
        uint8 discountThreshold,
        uint8 discountBps
    ) external returns (uint256) {
        require(discountBps <= 50, "Discount too high"); // max 50% stored as uint8 (0-50 = 0%-50%)
        // 验证所有 ruleId 存在
        for (uint256 i = 0; i < ruleIds.length; i++) {
            require(ruleIds[i] < ruleCount, "Invalid rule ID");
        }

        uint256 ruleSetId = ruleSetCount++;
        ruleSets[ruleSetId] = RuleSet({
            creatorCommitment: creatorCommitment,
            ruleIds: ruleIds,
            gateFee: gateFee,
            minReputationScore: minReputationScore,
            discountThreshold: discountThreshold,
            discountBps: discountBps,
            active: true
        });

        emit RuleSetCreated(ruleSetId, creatorCommitment, gateFee);
        return ruleSetId;
    }

    // ============ P2P 信任分同步 ============

    /**
     * @notice AgentRegistry8004 调用：同步用户 P2P 信任分到 Escrow
     * @dev 每次 P2P 评分更新后由 AgentRegistry8004 自动回调
     */
    function syncP2PScore(bytes32 commitment, uint8 score) external onlyAgentRegistry {
        cachedP2PScores[commitment] = score;
        emit P2PScoreUpdated(commitment, score);
    }

    /**
     * @notice Agent 批量同步信任分（定时任务）
     */
    function batchSyncScores(bytes32[] calldata commitments, uint8[] calldata scores) external onlyAgent {
        require(commitments.length == scores.length, "Length mismatch");
        for (uint256 i = 0; i < commitments.length; i++) {
            cachedP2PScores[commitments[i]] = scores[i];
            emit P2PScoreUpdated(commitments[i], scores[i]);
        }
    }

    // ============ Core: 创建存款（含信任分逻辑）============

    /**
     * @notice 创建隐私托管存款（ERC-8004 信任分增强版）
     *
     * @dev 信任分影响逻辑：
     *      1. 检查发送方信任分 >= ruleSet.minReputationScore（如设置）
     *      2. 若发送方信任分 >= ruleSet.discountThreshold → 折扣门槛费
     *      3. 若双方信任分 >= reputationConfig.fastTrackThreshold → 标记 fastTrack
     *
     * @param senderCommitment 发送方 ZK 身份承诺
     * @param receiverCommitment 接收方 ZK 身份承诺
     * @param escrowType 托管类型
     * @param duration 托管时长（秒）
     * @param ruleSetId 关联的规则集 ID（type(uint256).max = 无规则集）
     */
    function createDeposit(
        bytes32 senderCommitment,
        bytes32 receiverCommitment,
        EscrowType escrowType,
        uint256 duration,
        uint256 ruleSetId
    ) external payable returns (uint256) {
        require(msg.value > 0, "Must deposit ETH");

        // 验证发送方至少有身份验证标签
        require(
            registry.hasValidTag(senderCommitment, ZKVerifyRegistry.TagType.IDENTITY),
            "Sender must have valid identity tag"
        );

        uint256 requiredAmount = msg.value;
        uint256 originalAmount = msg.value;
        bool fastTrack = false;

        // ---- ERC-8004 信任分逻辑 ----
        if (reputationConfig.enabled && ruleSetId < ruleSetCount) {
            RuleSet memory ruleSet = ruleSets[ruleSetId];
            require(ruleSet.active, "RuleSet not active");

            uint8 senderScore = cachedP2PScores[senderCommitment];
            uint8 receiverScore = cachedP2PScores[receiverCommitment];

            // 1. 最低信任分门槛
            if (ruleSet.minReputationScore > 0) {
                require(
                    senderScore >= ruleSet.minReputationScore,
                    "Sender reputation too low"
                );
            }

            // 2. 信任分折扣
            if (ruleSet.discountThreshold > 0 && senderScore >= ruleSet.discountThreshold) {
                uint256 discount = (ruleSet.gateFee * uint256(ruleSet.discountBps)) / 100;
                requiredAmount = ruleSet.gateFee - discount;

                // 多余的 ETH 退还
                if (msg.value > requiredAmount) {
                    uint256 refund = msg.value - requiredAmount;
                    payable(msg.sender).transfer(refund);
                }

                emit ReputationDiscountApplied(depositCount, senderCommitment, ruleSet.gateFee, requiredAmount);
            }

            // 3. 快速通道（双方高信任分，Agent 可简化仲裁）
            if (senderScore >= reputationConfig.fastTrackThreshold &&
                receiverScore >= reputationConfig.fastTrackThreshold) {
                fastTrack = true;
                emit FastTrackEnabled(depositCount, senderCommitment, receiverCommitment);
            }
        }

        uint256 depositId = depositCount++;

        deposits[depositId] = EscrowDeposit({
            senderCommitment: senderCommitment,
            receiverCommitment: receiverCommitment,
            amount: requiredAmount,
            originalAmount: originalAmount,
            escrowType: escrowType,
            status: EscrowStatus.ACTIVE,
            createdAt: block.timestamp,
            deadline: block.timestamp + duration,
            conversationHash: bytes32(0),
            ruleSetId: ruleSetId,
            fastTrack: fastTrack,
            isERC20: false
        });

        emit DepositCreated(depositId, senderCommitment, receiverCommitment, requiredAmount, escrowType);
        return depositId;
    }

    /**
     * @notice 向后兼容的创建存款（无规则集）
     */
    function createDeposit(
        bytes32 senderCommitment,
        bytes32 receiverCommitment,
        EscrowType escrowType,
        uint256 duration
    ) external payable returns (uint256) {
        return this.createDeposit{value: msg.value}(
            senderCommitment,
            receiverCommitment,
            escrowType,
            duration,
            type(uint256).max // 无规则集
        );
    }

    // ============ Agent 仲裁操作 ============

    /**
     * @notice Agent 仲裁释放资金
     * @dev fastTrack 的 deposit 可以简化验证流程
     *      支持 ETH 和 ERC-20 代币
     */
    function releaseDeposit(
        uint256 depositId,
        address payable receiverAddress,
        bytes32 conversationHash
    ) external onlyAgent {
        EscrowDeposit storage deposit = deposits[depositId];
        require(deposit.status == EscrowStatus.ACTIVE, "Deposit not active");

        deposit.status = EscrowStatus.RELEASED;
        deposit.conversationHash = conversationHash;

        // 扣除平台费
        uint256 fee = (deposit.amount * platformFeeRate) / 10000;
        uint256 payout = deposit.amount - fee;

        // 根据支付类型转账
        if (deposit.isERC20) {
            require(paymentToken.transfer(receiverAddress, payout), "ERC-20 transfer failed");
        } else {
            receiverAddress.transfer(payout);
        }

        emit DepositReleased(depositId, msg.sender);
    }

    /**
     * @notice 超时自动退款或 Agent 判定退款
     *         支持 ETH 和 ERC-20 代币
     */
    function refundDeposit(
        uint256 depositId,
        address payable senderAddress
    ) external {
        EscrowDeposit storage deposit = deposits[depositId];
        require(deposit.status == EscrowStatus.ACTIVE, "Deposit not active");

        // 超时任何人可触发退款，未超时仅 Agent 可退款
        if (block.timestamp < deposit.deadline) {
            require(trustedAgents[msg.sender], "Only agent can refund before deadline");
        }

        deposit.status = EscrowStatus.REFUNDED;

        // 根据支付类型转账
        if (deposit.isERC20) {
            require(paymentToken.transfer(senderAddress, deposit.amount), "ERC-20 refund failed");
        } else {
            senderAddress.transfer(deposit.amount);
        }

        emit DepositRefunded(depositId);
    }

    /**
     * @notice Agent 标记争议
     */
    function disputeDeposit(uint256 depositId) external onlyAgent {
        EscrowDeposit storage deposit = deposits[depositId];
        require(deposit.status == EscrowStatus.ACTIVE, "Deposit not active");
        deposit.status = EscrowStatus.DISPUTED;
        emit DepositDisputed(depositId, msg.sender);
    }

    // ============ View Functions ============

    function getDeposit(uint256 depositId) external view returns (EscrowDeposit memory) {
        return deposits[depositId];
    }

    function getRuleSet(uint256 ruleSetId) external view returns (RuleSet memory) {
        return ruleSets[ruleSetId];
    }

    function getRule(uint256 ruleId) external view returns (ArbitrationRule memory) {
        return rules[ruleId];
    }

    function getSenderReputationScore(bytes32 commitment) external view returns (uint8) {
        return cachedP2PScores[commitment];
    }

    /**
     * @notice 计算实际需支付金额（含信任分折扣预览）
     * @dev 前端调用：用户创建存款前预览折扣
     */
    function previewDepositAmount(
        bytes32 senderCommitment,
        uint256 ruleSetId
    ) external view returns (uint256 requiredAmount, uint256 discount, bool willFastTrack) {
        if (!reputationConfig.enabled || ruleSetId >= ruleSetCount) {
            return (0, 0, false);
        }

        RuleSet memory ruleSet = ruleSets[ruleSetId];
        uint8 senderScore = cachedP2PScores[senderCommitment];

        requiredAmount = ruleSet.gateFee;
        discount = 0;
        willFastTrack = false;

        // 折扣计算
        if (ruleSet.discountThreshold > 0 && senderScore >= ruleSet.discountThreshold) {
            discount = (ruleSet.gateFee * uint256(ruleSet.discountBps)) / 100;
            requiredAmount = ruleSet.gateFee - discount;
        }

        // 快速通道预判（只能判断发送方，接收方需要实际创建时判断）
        if (senderScore >= reputationConfig.fastTrackThreshold) {
            willFastTrack = true; // 仅发送方满足，实际需双方都满足
        }
    }

    // ============ Admin ============

    function setPlatformFeeRate(uint256 _rate) external onlyOwner {
        require(_rate <= 500, "Fee too high"); // max 5%
        platformFeeRate = _rate;
    }

    function withdrawFees() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}
