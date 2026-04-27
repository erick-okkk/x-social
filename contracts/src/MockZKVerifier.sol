// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IZKVerifier.sol";

/**
 * @title MockZKVerifier
 * @notice 开发/MVP 用 Mock ZK 验证器 —— 用于测试和早期开发
 * @dev 可在"总是通过"和"预批准映射"两种模式间切换
 *      生产环境应替换为实际的 ZK Verifier 实现
 */
contract MockZKVerifier is IZKVerifier {

    // ============ State ============

    address public owner;

    /// @notice 自动批准模式：当启用时，所有非空证明都通过
    bool public autoApproveEnabled = true;

    /// @notice 预批准证明哈希映射：proofHash => approved
    mapping(bytes32 => bool) public preApprovedProofs;

    // ============ Events ============

    event AutoApproveToggled(bool enabled);
    event ProofPreApproved(bytes32 indexed proofHash);
    event ProofRevoked(bytes32 indexed proofHash);

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
        autoApproveEnabled = true;
    }

    // ============ Owner Functions ============

    /**
     * @notice 切换自动批准模式
     * @param _enabled true = 所有非空证明都通过，false = 仅检查预批准列表
     */
    function setAutoApprove(bool _enabled) external onlyOwner {
        autoApproveEnabled = _enabled;
        emit AutoApproveToggled(_enabled);
    }

    /**
     * @notice 预批准一个证明哈希
     * @param proofHash 证明的 keccak256 哈希
     */
    function preApproveProof(bytes32 proofHash) external onlyOwner {
        require(proofHash != bytes32(0), "Invalid proof hash");
        preApprovedProofs[proofHash] = true;
        emit ProofPreApproved(proofHash);
    }

    /**
     * @notice 撤销一个证明的预批准
     * @param proofHash 证明的 keccak256 哈希
     */
    function revokeProof(bytes32 proofHash) external onlyOwner {
        require(preApprovedProofs[proofHash], "Proof not approved");
        preApprovedProofs[proofHash] = false;
        emit ProofRevoked(proofHash);
    }

    // ============ IZKVerifier Implementation ============

    /**
     * @notice 验证 ZK 证明
     * @param proof 证明数据
     * @return valid 是否有效
     */
    function verify(bytes calldata proof) external view override returns (bool valid) {
        // 不接受空证明
        if (proof.length == 0) {
            return false;
        }

        // 模式 1：自动批准启用
        if (autoApproveEnabled) {
            return true;
        }

        // 模式 2：检查预批准列表
        bytes32 proofHash = keccak256(proof);
        return preApprovedProofs[proofHash];
    }

    /**
     * @notice 验证带有公共输入的 ZK 证明
     * @param proof 证明数据
     * @param publicInputs 公共输入
     * @return valid 是否有效
     */
    function verifyWithInputs(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external view override returns (bool valid) {
        // 不接受空证明或空输入
        if (proof.length == 0 || publicInputs.length == 0) {
            return false;
        }

        // 模式 1：自动批准启用
        if (autoApproveEnabled) {
            return true;
        }

        // 模式 2：检查预批准列表
        // 包括 proof 和 publicInputs 的组合哈希
        bytes32 combinedHash = keccak256(abi.encodePacked(proof, publicInputs));
        return preApprovedProofs[combinedHash];
    }

    // ============ View Functions ============

    /**
     * @notice 检查某个证明哈希是否被预批准
     */
    function isProofApproved(bytes32 proofHash) external view returns (bool) {
        return preApprovedProofs[proofHash];
    }
}
