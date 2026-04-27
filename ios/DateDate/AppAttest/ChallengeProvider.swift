import Foundation

/// Protocol for providing challenges for App Attest
/// Implement this protocol to provide challenges from different sources
public protocol ChallengeProvider {
    /// Get a challenge for attestation or assertion
    /// - Returns: Challenge data (should be at least 16 bytes of random data)
    func getChallenge() async throws -> Data
    
    /// Provider name for logging/debugging
    var providerName: String { get }
}

/// Challenge source type for configuration
public enum ChallengeSource {
    case mock
    case server(url: URL)
    case blockchain(contractAddress: String, chainId: Int)
    case custom(ChallengeProvider)
}

/// Manager for configuring and switching challenge providers
public class ChallengeManager {
    
    public static let shared = ChallengeManager()
    
    private var currentProvider: ChallengeProvider = MockChallengeProvider()
    
    private init() {}
    
    /// Current challenge source description
    public var currentSourceName: String {
        return currentProvider.providerName
    }
    
    /// Configure the challenge source
    /// - Parameter source: The source to use for challenges
    public func configure(source: ChallengeSource) {
        switch source {
        case .mock:
            currentProvider = MockChallengeProvider()
            
        case .server(let url):
            currentProvider = ServerChallengeProvider(serverURL: url)
            
        case .blockchain(let contractAddress, let chainId):
            currentProvider = BlockchainChallengeProvider(
                contractAddress: contractAddress,
                chainId: chainId
            )
            
        case .custom(let provider):
            currentProvider = provider
        }
        
        // Update AppAttestService with new provider
        AppAttestService.shared.challengeProvider = currentProvider
        
        print("[ChallengeManager] Configured provider: \(currentProvider.providerName)")
    }
    
    /// Get the current provider
    public func getProvider() -> ChallengeProvider {
        return currentProvider
    }
    
    /// Get a challenge using the current provider
    public func getChallenge() async throws -> Data {
        return try await currentProvider.getChallenge()
    }
}
