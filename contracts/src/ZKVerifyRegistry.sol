// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IZKVerifier.sol";

/**
 * @title ZKVerifyRegistry
 * @notice 核心 ZK 验证注册表 —— 管理用户的 ZK 验证标签
 * @dev 用户通过线下 ZK 电路验证后，由可信 Relayer 将验证结果上链
 *      所有验证数据以 commitment hash 形式存储，不泄露任何明文信息
 */
contract ZKVerifyRegistry {

    // ============ Structs ============

    struct VerifyTag {
        bytes32 tagHash;          // keccak256(tagType, commitment)
        TagType tagType;          // 标签类型
        uint256 issuedAt;         // 颁发时间
        uint256 expiresAt;        // 过期时间
        address issuer;           // 颁发者（可信 Relayer）
        bool revoked;             // 是否已撤销
    }

    enum TagType {
        IDENTITY,       // 身份证明（人脸 vs 证件匹配）
        HEALTH_REPORT,  // 体检报告验证
        AGE_RANGE,      // 年龄范围证明（如 >18, 20-30 等）
        INCOME_RANGE,   // 收入范围证明
        EDUCATION,      // 学历验证
        SOCIAL_SCORE,   // 社交信用评分范围
        CUSTOM          // 自定义标签
    }

    // ============ State ============

    // userCommitment => tagHash => VerifyTag
    mapping(bytes32 => mapping(bytes32 => VerifyTag)) public tags;

    // userCommitment => tagHash[]
    mapping(bytes32 => bytes32[]) public userTagHashes;

    // 可信 Relayer 白名单
    mapping(address => bool) public trustedRelayers;

    // ZK 验证器地址（address(0) = 跳过验证，向后兼容）
    IZKVerifier public verifier;

    // actionNullifier => 已使用（防止同一属性被颁发两次）
    mapping(bytes32 => bool) public usedNullifiers;

    address public owner;

    // ============ Events ============

    event TagIssued(bytes32 indexed userCommitment, bytes32 indexed tagHash, TagType tagType, uint256 expiresAt);
    event TagRevoked(bytes32 indexed userCommitment, bytes32 indexed tagHash);
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event VerifierSet(address indexed newVerifier);
    event TagIssuedWithInputs(bytes32 indexed userCommitment, bytes32 indexed tagHash, TagType tagType, uint256[] publicInputs, uint256 expiresAt);
    event NullifierUsed(bytes32 indexed actionNullifier, bytes32 indexed tagHash);

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyRelayer() {
        require(trustedRelayers[msg.sender], "Not trusted relayer");
        _;
    }

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
        trustedRelayers[msg.sender] = true;
    }

    // ============ Relayer Management ============

    function addRelayer(address _relayer) external onlyOwner {
        trustedRelayers[_relayer] = true;
        emit RelayerAdded(_relayer);
    }

    function removeRelayer(address _relayer) external onlyOwner {
        trustedRelayers[_relayer] = false;
        emit RelayerRemoved(_relayer);
    }

    /**
     * @notice 设置 ZK 验证器地址
     * @param _verifier ZK 验证器合约地址（address(0) 表示禁用验证）
     */
    function setVerifier(address _verifier) external onlyOwner {
        verifier = IZKVerifier(_verifier);
        emit VerifierSet(_verifier);
    }

    // ============ Tag Issuance ============

    /**
     * @notice 颁发 ZK 验证标签
     * @param userCommitment 用户身份承诺值 (Poseidon hash of secret + nullifier)
     * @param tagType 标签类型
     * @param zkProof ZK 证明数据（由链下验证器验证后提交）
     * @param validDuration 有效期（秒）
     * @param actionNullifier 操作 nullifier（防止同一属性被颁发两次）
     */
    function issueTag(
        bytes32 userCommitment,
        TagType tagType,
        bytes calldata zkProof,
        uint256 validDuration,
        bytes32 actionNullifier
    ) external onlyRelayer returns (bytes32) {
        // 检查 nullifier 是否已被使用（防止重复颁发）
        require(!usedNullifiers[actionNullifier], "Nullifier already used");

        // 验证 ZK 证明（如果验证器已设置）
        if (address(verifier) != address(0)) {
            require(IZKVerifier(verifier).verify(zkProof), "Invalid ZK proof");
        }

        bytes32 tagHash = keccak256(abi.encodePacked(userCommitment, tagType, block.timestamp));

        // 标记 nullifier 已使用
        usedNullifiers[actionNullifier] = true;

        tags[userCommitment][tagHash] = VerifyTag({
            tagHash: tagHash,
            tagType: tagType,
            issuedAt: block.timestamp,
            expiresAt: block.timestamp + validDuration,
            issuer: msg.sender,
            revoked: false
        });

        userTagHashes[userCommitment].push(tagHash);

        emit TagIssued(userCommitment, tagHash, tagType, block.timestamp + validDuration);
        emit NullifierUsed(actionNullifier, tagHash);
        return tagHash;
    }

    /**
     * @notice 撤销标签
     */
    function revokeTag(bytes32 userCommitment, bytes32 tagHash) external onlyRelayer {
        require(tags[userCommitment][tagHash].issuedAt > 0, "Tag not found");
        tags[userCommitment][tagHash].revoked = true;
        emit TagRevoked(userCommitment, tagHash);
    }

    /**
     * @notice 颁发带有公共输入的 ZK 验证标签（用于 RangeProof 等需要特定输入的场景）
     * @param userCommitment 用户身份承诺值
     * @param tagType 标签类型
     * @param zkProof ZK 证明数据
     * @param publicInputs 公共输入（例如范围证明的下界和上界）
     * @param validDuration 有效期（秒）
     * @param actionNullifier 操作 nullifier（防止重复颁发）
     */
    function issueTagWithInputs(
        bytes32 userCommitment,
        TagType tagType,
        bytes calldata zkProof,
        uint256[] calldata publicInputs,
        uint256 validDuration,
        bytes32 actionNullifier
    ) external onlyRelayer returns (bytes32) {
        // 检查 nullifier 是否已被使用
        require(!usedNullifiers[actionNullifier], "Nullifier already used");

        // 验证 ZK 证明（如果验证器已设置）
        if (address(verifier) != address(0)) {
            require(IZKVerifier(verifier).verifyWithInputs(zkProof, publicInputs), "Invalid ZK proof with inputs");
        }

        bytes32 tagHash = keccak256(abi.encodePacked(userCommitment, tagType, publicInputs, block.timestamp));

        // 标记 nullifier 已使用
        usedNullifiers[actionNullifier] = true;

        tags[userCommitment][tagHash] = VerifyTag({
            tagHash: tagHash,
            tagType: tagType,
            issuedAt: block.timestamp,
            expiresAt: block.timestamp + validDuration,
            issuer: msg.sender,
            revoked: false
        });

        userTagHashes[userCommitment].push(tagHash);

        emit TagIssuedWithInputs(userCommitment, tagHash, tagType, publicInputs, block.timestamp + validDuration);
        emit NullifierUsed(actionNullifier, tagHash);
        return tagHash;
    }

    // ============ Verification ============

    /**
     * @notice 验证用户是否拥有某类型的有效标签（不暴露具体内容）
     * @param userCommitment 用户身份承诺值
     * @param tagType 要验证的标签类型
     * @return valid 是否拥有有效标签
     */
    function hasValidTag(bytes32 userCommitment, TagType tagType) external view returns (bool valid) {
        bytes32[] memory hashes = userTagHashes[userCommitment];
        for (uint256 i = 0; i < hashes.length; i++) {
            VerifyTag memory tag = tags[userCommitment][hashes[i]];
            if (tag.tagType == tagType && !tag.revoked && block.timestamp <= tag.expiresAt) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice 获取用户所有标签哈希
     */
    function getUserTags(bytes32 userCommitment) external view returns (bytes32[] memory) {
        return userTagHashes[userCommitment];
    }
}
