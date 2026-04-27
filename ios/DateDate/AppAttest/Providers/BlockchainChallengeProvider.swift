import Foundation

/// Blockchain-based challenge provider
/// Fetches challenges from a smart contract on-chain
public class BlockchainChallengeProvider: ChallengeProvider {
    
    private let contractAddress: String
    private let chainId: Int
    private var rpcURL: URL?
    
    public var providerName: String {
        return "Blockchain (Chain: \(chainId), Contract: \(shortAddress))"
    }
    
    private var shortAddress: String {
        let prefix = String(contractAddress.prefix(6))
        let suffix = String(contractAddress.suffix(4))
        return "\(prefix)...\(suffix)"
    }
    
    /// Well-known RPC endpoints for common chains
    private static let defaultRPCEndpoints: [Int: String] = [
        1: "https://eth-mainnet.g.alchemy.com/v2/demo",      // Ethereum Mainnet
        5: "https://eth-goerli.g.alchemy.com/v2/demo",       // Goerli Testnet
        11155111: "https://eth-sepolia.g.alchemy.com/v2/demo", // Sepolia Testnet
        137: "https://polygon-rpc.com",                       // Polygon Mainnet
        80001: "https://rpc-mumbai.maticvigil.com",          // Polygon Mumbai
        42161: "https://arb1.arbitrum.io/rpc",               // Arbitrum One
        10: "https://mainnet.optimism.io",                    // Optimism
        56: "https://bsc-dataseed.binance.org",              // BSC
        43114: "https://api.avax.network/ext/bc/C/rpc"       // Avalanche
    ]
    
    /// Initialize with contract address and chain ID
    /// - Parameters:
    ///   - contractAddress: The smart contract address for challenge generation
    ///   - chainId: The blockchain chain ID
    public init(contractAddress: String, chainId: Int) {
        self.contractAddress = contractAddress
        self.chainId = chainId
        
        // Set default RPC URL for known chains
        if let defaultURL = Self.defaultRPCEndpoints[chainId] {
            self.rpcURL = URL(string: defaultURL)
        }
    }
    
    /// Set custom RPC URL
    /// - Parameter url: The RPC endpoint URL
    public func setRPCURL(_ url: URL) {
        self.rpcURL = url
    }
    
    /// Set RPC URL from string
    /// - Parameter urlString: The RPC endpoint URL string
    public func setRPCURL(_ urlString: String) {
        self.rpcURL = URL(string: urlString)
    }
    
    public func getChallenge() async throws -> Data {
        guard let rpcURL = rpcURL else {
            throw BlockchainChallengeError.rpcNotConfigured
        }
        
        // Call the smart contract's getChallenge() function
        // Function signature: getChallenge() returns (bytes32)
        // Keccak256("getChallenge()") = 0x5ec01e4d...
        let functionSelector = "0x5ec01e4d"
        
        let callData: [String: Any] = [
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [
                [
                    "to": contractAddress,
                    "data": functionSelector
                ],
                "latest"
            ],
            "id": 1
        ]
        
        var request = URLRequest(url: rpcURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: callData)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw BlockchainChallengeError.rpcError
        }
        
        // Parse JSON-RPC response
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw BlockchainChallengeError.invalidResponse
        }
        
        // Check for JSON-RPC error
        if let error = json["error"] as? [String: Any],
           let message = error["message"] as? String {
            throw BlockchainChallengeError.contractError(message)
        }
        
        // Extract result
        guard let result = json["result"] as? String else {
            throw BlockchainChallengeError.invalidResponse
        }
        
        // Remove 0x prefix and convert to Data
        let hexString = result.hasPrefix("0x") ? String(result.dropFirst(2)) : result
        
        guard let challengeData = Data(hexString: hexString) else {
            throw BlockchainChallengeError.invalidChallengeFormat
        }
        
        print("[BlockchainChallenge] Received challenge from chain \(chainId): \(challengeData.hexString)")
        
        return challengeData
    }
    
    /// Generate a challenge transaction (for contracts that require tx)
    /// - Returns: Transaction data for signing
    public func generateChallengeTransaction() -> [String: Any] {
        // Function signature: generateChallenge() 
        let functionSelector = "0x1c7d13a3"
        
        return [
            "to": contractAddress,
            "data": functionSelector,
            "chainId": String(format: "0x%x", chainId)
        ]
    }
}

// MARK: - Blockchain Errors

public enum BlockchainChallengeError: LocalizedError {
    case rpcNotConfigured
    case rpcError
    case invalidResponse
    case invalidChallengeFormat
    case contractError(String)
    
    public var errorDescription: String? {
        switch self {
        case .rpcNotConfigured:
            return "RPC endpoint not configured for this chain"
        case .rpcError:
            return "RPC request failed"
        case .invalidResponse:
            return "Invalid response from RPC"
        case .invalidChallengeFormat:
            return "Challenge data format is invalid"
        case .contractError(let message):
            return "Contract error: \(message)"
        }
    }
}

// MARK: - Example Solidity Contract

/*
 Example Solidity contract for challenge generation:
 
 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.0;
 
 contract AppAttestChallenge {
     mapping(address => bytes32) public challenges;
     mapping(bytes32 => uint256) public challengeTimestamps;
     
     uint256 public constant CHALLENGE_VALIDITY = 5 minutes;
     
     event ChallengeGenerated(address indexed requester, bytes32 challenge);
     
     function generateChallenge() external returns (bytes32) {
         bytes32 challenge = keccak256(abi.encodePacked(
             block.timestamp,
             block.prevrandao,
             msg.sender,
             blockhash(block.number - 1)
         ));
         
         challenges[msg.sender] = challenge;
         challengeTimestamps[challenge] = block.timestamp;
         
         emit ChallengeGenerated(msg.sender, challenge);
         return challenge;
     }
     
     function getChallenge() external view returns (bytes32) {
         return challenges[msg.sender];
     }
     
     function verifyChallenge(bytes32 challenge) external view returns (bool) {
         uint256 timestamp = challengeTimestamps[challenge];
         if (timestamp == 0) return false;
         return block.timestamp <= timestamp + CHALLENGE_VALIDITY;
     }
 }
 */
