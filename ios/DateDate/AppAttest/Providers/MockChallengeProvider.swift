import Foundation

/// Mock challenge provider for development and testing
/// Uses fixed "test_server_challenge" by default for reproducible testing
public class MockChallengeProvider: ChallengeProvider {
    
    /// Default fixed challenge string
    public static let defaultChallengeString = "test_server_challenge"
    
    public var providerName: String {
        return "Mock (Fixed: test_server_challenge)"
    }
    
    /// Fixed challenge for reproducible testing
    /// Defaults to "test_server_challenge"
    private var fixedChallenge: Data
    
    /// Optional: Simulated network delay
    public var simulatedDelay: TimeInterval = 0
    
    /// Optional: Simulate failure rate (0.0 - 1.0)
    public var failureRate: Double = 0
    
    /// Initialize with default fixed challenge "test_server_challenge"
    public init() {
        self.fixedChallenge = Self.defaultChallengeString.data(using: .utf8)!
    }
    
    /// Initialize with a fixed challenge for testing
    /// - Parameter fixedChallenge: The challenge to always return
    public init(fixedChallenge: Data) {
        self.fixedChallenge = fixedChallenge
    }
    
    /// Initialize with a hex string challenge for testing
    /// - Parameter hexString: Hex encoded challenge string
    public init(hexString: String) {
        self.fixedChallenge = Data(hexString: hexString) ?? Self.defaultChallengeString.data(using: .utf8)!
    }
    
    public func getChallenge() async throws -> Data {
        // Simulate network delay if configured
        if simulatedDelay > 0 {
            try await Task.sleep(nanoseconds: UInt64(simulatedDelay * 1_000_000_000))
        }
        
        // Simulate random failures if configured
        if failureRate > 0 && Double.random(in: 0...1) < failureRate {
            throw MockChallengeError.simulatedFailure
        }
        
        // Always return the fixed challenge
        print("[MockChallenge] Using fixed challenge: \(String(data: fixedChallenge, encoding: .utf8) ?? fixedChallenge.hexString)")
        return fixedChallenge
    }
}

// MARK: - Mock Errors

public enum MockChallengeError: LocalizedError {
    case randomGenerationFailed
    case simulatedFailure
    
    public var errorDescription: String? {
        switch self {
        case .randomGenerationFailed:
            return "Failed to generate random bytes"
        case .simulatedFailure:
            return "Simulated failure for testing"
        }
    }
}

// Note: Data hex extensions are defined in Extensions/DataExtensions.swift
