// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IZKVerifier
 * @notice ZK 证明验证器接口
 * @dev 不同的 ZK 验证场景实现不同的验证器
 */
interface IZKVerifier {

    /**
     * @notice 验证 ZK 证明
     * @param proof 证明数据
     * @return valid 是否有效
     */
    function verify(bytes calldata proof) external view returns (bool valid);

    /**
     * @notice 验证带有公共输入的 ZK 证明
     * @param proof 证明数据
     * @param publicInputs 公共输入
     * @return valid 是否有效
     */
    function verifyWithInputs(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external view returns (bool valid);
}
