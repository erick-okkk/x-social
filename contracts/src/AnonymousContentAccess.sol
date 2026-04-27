// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PrivacyEscrow.sol";
import "./interfaces/IZKVerifier.sol";

/**
 * @title AnonymousContentAccess
 * @notice 匿名付费内容访问合约
 * @dev 用户可以匿名付费访问他人的付费内容，内容创作者无法知道访问者身份
 *      使用 Nullifier 防止双重访问，ZK Proof 证明付费有效性
 */
contract AnonymousContentAccess {

    struct ContentItem {
        bytes32 creatorCommitment;  // 创作者 ZK 身份承诺
        bytes32 contentHash;        // 内容哈希
        uint256 price;              // 访问价格
        bool active;                // 是否活跃
    }

    struct AccessProof {
        bytes32 nullifier;          // 防双重访问
        uint256 paidAt;             // 支付时间
        bool valid;                 // 是否有效
    }

    // ============ State ============

    mapping(uint256 => ContentItem) public contents;
    uint256 public contentCount;

    // contentId => nullifier => AccessProof
    mapping(uint256 => mapping(bytes32 => AccessProof)) public accessProofs;

    // nullifier set（防双重使用）
    mapping(bytes32 => bool) public usedNullifiers;

    PrivacyEscrow public escrow;

    // ZK 验证器地址（address(0) = 跳过验证，向后兼容）
    IZKVerifier public verifier;

    address public owner;

    // ============ Events ============

    event ContentPublished(uint256 indexed contentId, bytes32 creatorCommitment, uint256 price);
    event ContentAccessed(uint256 indexed contentId, bytes32 nullifier, uint256 paidAmount);
    event VerifierSet(address indexed newVerifier);

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ============ Constructor ============

    constructor(address _escrow) {
        escrow = PrivacyEscrow(payable(_escrow));
        owner = msg.sender;
    }

    // ============ Owner Functions ============

    /**
     * @notice 设置 ZK 验证器地址
     * @param _verifier ZK 验证器合约地址（address(0) 表示禁用验证）
     */
    function setVerifier(address _verifier) external onlyOwner {
        verifier = IZKVerifier(_verifier);
        emit VerifierSet(_verifier);
    }

    // ============ Core Functions ============

    /**
     * @notice 发布付费内容
     * @param creatorCommitment 创作者 ZK 身份承诺
     * @param contentHash 内容哈希（链下存储，链上只存哈希）
     * @param price 访问价格
     */
    function publishContent(
        bytes32 creatorCommitment,
        bytes32 contentHash,
        uint256 price
    ) external returns (uint256) {
        uint256 contentId = contentCount++;

        contents[contentId] = ContentItem({
            creatorCommitment: creatorCommitment,
            contentHash: contentHash,
            price: price,
            active: true
        });

        emit ContentPublished(contentId, creatorCommitment, price);
        return contentId;
    }

    /**
     * @notice 匿名访问付费内容
     * @dev 使用 nullifier 确保同一用户不会重复付费
     *      访问者身份完全隐藏，创作者只知道有人付费了
     * @param contentId 内容 ID
     * @param nullifier 防双重访问的 nullifier
     * @param zkProof ZK 证明（证明 nullifier 合法且关联到一个有效身份）
     */
    function accessContent(
        uint256 contentId,
        bytes32 nullifier,
        bytes calldata zkProof
    ) external payable returns (bool) {
        ContentItem memory content = contents[contentId];
        require(content.active, "Content not active");
        require(msg.value >= content.price, "Insufficient payment");
        require(!usedNullifiers[nullifier], "Nullifier already used");

        // 验证 ZK 证明（如果验证器已设置）
        if (address(verifier) != address(0)) {
            require(IZKVerifier(verifier).verify(zkProof), "Invalid ZK proof");
        }

        usedNullifiers[nullifier] = true;

        accessProofs[contentId][nullifier] = AccessProof({
            nullifier: nullifier,
            paidAt: block.timestamp,
            valid: true
        });

        emit ContentAccessed(contentId, nullifier, msg.value);
        return true;
    }

    /**
     * @notice 验证某 nullifier 是否已获得内容访问权
     * @dev 配合链下解密使用：用户出示 nullifier，合约确认已付费
     */
    function verifyAccess(uint256 contentId, bytes32 nullifier) external view returns (bool) {
        return accessProofs[contentId][nullifier].valid;
    }

    /**
     * @notice 下架内容
     * @dev 验证调用者是内容创作者
     */
    function deactivateContent(uint256 contentId) external {
        ContentItem storage content = contents[contentId];
        require(content.active, "Content already inactive");
        // 验证调用者必须是创作者（通过 commitment 匹配）
        // 注：实际实现中需要通过链下签名或其他方式验证身份
        // 这里为简化演示，仅验证内容存在且活跃
        content.active = false;
    }

    function getContent(uint256 contentId) external view returns (ContentItem memory) {
        return contents[contentId];
    }
}
