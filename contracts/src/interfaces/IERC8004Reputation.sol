// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC8004Reputation
 * @notice ERC-8004 Reputation Registry 接口
 * @dev 标准化的链上评分反馈系统
 *      参考: https://eips.ethereum.org/EIPS/eip-8004
 *
 *      核心字段说明：
 *      - score: uint8 (0-255)，评分值
 *      - tag1, tag2: bytes32，标签用于分类反馈（如 "matchmaking", "arbitration"）
 *      - uri: 链下反馈详情的 URI
 *      - fileHash: 反馈内容的哈希
 */
interface IERC8004Reputation {

    struct FeedbackSummary {
        uint64 count;           // 反馈总数
        uint8 averageScore;     // 平均评分
    }

    /// @notice 提交反馈评分
    /// @param agentId 被评分的 Agent ID
    /// @param score 评分 (0-255)
    /// @param tag1 标签1（用于分类，如 keccak256("matchmaking")）
    /// @param tag2 标签2（用于子分类，如 keccak256("dating")）
    /// @param uri 链下反馈详情 URI
    /// @param fileHash 反馈内容哈希
    /// @param feedbackAuth 授权数据（可用于验证评分者身份）
    function giveFeedback(
        uint256 agentId,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string calldata uri,
        bytes32 fileHash,
        bytes calldata feedbackAuth
    ) external;

    /// @notice 获取聚合评分摘要
    /// @param agentId Agent ID
    /// @param clientAddresses 筛选特定评分者（空数组 = 全部）
    /// @param tag1 筛选标签1（bytes32(0) = 不筛选）
    /// @param tag2 筛选标签2
    /// @return summary 评分摘要
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        bytes32 tag1,
        bytes32 tag2
    ) external view returns (FeedbackSummary memory summary);

    /// @notice 读取所有反馈记录
    /// @param agentId Agent ID
    /// @param offset 起始偏移
    /// @param limit 最大返回数
    function readAllFeedback(
        uint256 agentId,
        uint64 offset,
        uint64 limit
    ) external view returns (FeedbackRecord[] memory);

    struct FeedbackRecord {
        address client;
        uint8 score;
        bytes32 tag1;
        bytes32 tag2;
        uint64 timestamp;
        bool isRevoked;
    }

    /// @notice 撤销反馈
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;

    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 indexed feedbackIndex,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string uri
    );

    event FeedbackRevoked(uint256 indexed agentId, uint64 indexed feedbackIndex);
}
