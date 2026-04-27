// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC8004Identity
 * @notice ERC-8004 Identity Registry 接口
 * @dev 基于 ERC-721 的 Agent 身份注册表，每个 Agent 获得一个链上 NFT 身份
 *      参考: https://eips.ethereum.org/EIPS/eip-8004
 */
interface IERC8004Identity {
    /// @notice 注册新 Agent，铸造身份 NFT
    /// @param to Agent 所有者地址
    /// @param registrationURI Agent 注册信息的 URI（指向 JSON metadata）
    /// @return agentId 铸造的 NFT tokenId
    function register(address to, string calldata registrationURI) external returns (uint256 agentId);

    /// @notice 更新 Agent 注册信息
    function updateRegistration(uint256 agentId, string calldata registrationURI) external;

    /// @notice 获取 Agent 注册信息 URI
    function registrationURI(uint256 agentId) external view returns (string memory);

    /// @notice 检查某地址是否为已注册 Agent
    function isRegistered(address agent) external view returns (bool);

    /// @notice 获取地址对应的 agentId
    function agentIdOf(address agent) external view returns (uint256);

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string registrationURI);
    event RegistrationUpdated(uint256 indexed agentId, string registrationURI);
}
