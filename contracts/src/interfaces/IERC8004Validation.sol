// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC8004Validation
 * @notice ERC-8004 Validation Registry 接口
 * @dev 通用的验证钩子：第三方验证者（stakers / zkML / TEE oracle / 可信法官）
 *      可以对 Agent 的工作结果进行独立验证并记录上链
 */
interface IERC8004Validation {

    enum ValidationStatus { PENDING, APPROVED, REJECTED, EXPIRED }

    struct ValidationRequest {
        uint256 agentId;
        bytes32 taskHash;          // 被验证任务的哈希
        address requester;
        ValidationStatus status;
        uint64 requestedAt;
        uint64 resolvedAt;
    }

    struct ValidationResult {
        address validator;
        ValidationStatus status;
        bytes32 resultHash;        // 验证结果哈希
        bytes proof;               // 验证证明（可以是 ZK proof）
        uint64 timestamp;
    }

    /// @notice 请求第三方验证
    function requestValidation(
        uint256 agentId,
        bytes32 taskHash,
        bytes calldata requestData
    ) external returns (uint256 validationId);

    /// @notice 验证者提交验证结果
    function recordValidation(
        uint256 validationId,
        ValidationStatus status,
        bytes32 resultHash,
        bytes calldata proof
    ) external;

    /// @notice 读取验证结果
    function getValidation(uint256 validationId)
        external view returns (ValidationRequest memory request, ValidationResult[] memory results);

    event ValidationRequested(uint256 indexed validationId, uint256 indexed agentId, bytes32 taskHash);
    event ValidationRecorded(uint256 indexed validationId, address indexed validator, ValidationStatus status);
}
