import Foundation
import DeviceCheck
import CryptoKit

/// App Attest Service for device attestation and assertion
/// Provides cryptographic proof that the app is genuine and running on a real Apple device
public class AppAttestService {
    
    public static let shared = AppAttestService()
    
    private let dcAppAttestService = DCAppAttestService.shared
    private var keyId: String?
    
    /// Key for storing attested keyId in UserDefaults
    private let attestedKeyIdKey = "com.datedate.appAttest.keyId"
    
    /// Challenge provider for getting challenges from different sources
    public var challengeProvider: ChallengeProvider = MockChallengeProvider()
    
    /// Callback for exporting attestation data for manual verification
    public var onAttestationExport: ((AttestationExportData) -> Void)?
    
    private init() {
        // Load previously attested keyId from storage
        loadAttestedKeyId()
    }
    
    // MARK: - Public API
    
    /// Check if device has been attested (has a valid keyId stored)
    public var isAttested: Bool {
        return keyId != nil
    }
    
    /// Check if App Attest is supported on this device
    public var isSupported: Bool {
        return dcAppAttestService.isSupported
    }
    
    /// Generate a new attestation key pair
    /// - Returns: The key identifier for the generated key
    public func generateKey() async throws -> String {
        guard isSupported else {
            throw AppAttestError.notSupported
        }
        
        return try await withCheckedThrowingContinuation { continuation in
            dcAppAttestService.generateKey { keyId, error in
                if let error = error {
                    continuation.resume(throwing: AppAttestError.keyGenerationFailed(error))
                } else if let keyId = keyId {
                    self.keyId = keyId
                    continuation.resume(returning: keyId)
                } else {
                    continuation.resume(throwing: AppAttestError.unknownError)
                }
            }
        }
    }
    
    /// Attest the key with Apple's servers
    /// - Parameter keyId: The key identifier to attest
    /// - Returns: The attestation object (CBOR encoded)
    public func attestKey(_ keyId: String) async throws -> Data {
        guard isSupported else {
            throw AppAttestError.notSupported
        }
        
        // Get server challenge from the configured provider
        let serverChallenge = try await challengeProvider.getChallenge()
        
        // Perform attestation with Apple
        let attestation = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Data, Error>) in
            dcAppAttestService.attestKey(keyId, clientDataHash: serverChallenge) { attestation, error in
                if let error = error {
                    continuation.resume(throwing: AppAttestError.attestationFailed(error))
                } else if let attestation = attestation {
                    continuation.resume(returning: attestation)
                } else {
                    continuation.resume(throwing: AppAttestError.unknownError)
                }
            }
        }
        
        // Export attestation data for verification
        let exportData = AttestationExportData(
            keyId: keyId,
            challenge: serverChallenge,
            attestation: attestation,
            timestamp: Date()
        )
        
        onAttestationExport?(exportData)
        
        // Save attestation for later export
        try saveAttestationToFile(exportData)
        
        // Persist the keyId for future use
        saveAttestedKeyId(keyId)
        
        return attestation
    }
    
    /// Generate an assertion for a request
    /// - Parameters:
    ///   - keyId: The attested key identifier
    ///   - requestData: The request data to sign
    /// - Returns: The assertion object
    public func generateAssertion(keyId: String, requestData: Data) async throws -> Data {
        guard isSupported else {
            throw AppAttestError.notSupported
        }
        
        // Create hash of the request data
        let requestDataHash = Data(SHA256.hash(data: requestData))
        
        return try await withCheckedThrowingContinuation { continuation in
            dcAppAttestService.generateAssertion(keyId, clientDataHash: requestDataHash) { assertion, error in
                if let error = error {
                    continuation.resume(throwing: AppAttestError.assertionFailed(error))
                } else if let assertion = assertion {
                    continuation.resume(returning: assertion)
                } else {
                    continuation.resume(throwing: AppAttestError.unknownError)
                }
            }
        }
    }
    
    /// Full attestation flow: generate key, attest, and return all data
    /// - Returns: Complete attestation result with all necessary data for verification
    public func performFullAttestation() async throws -> AttestationResult {
        // Step 1: Generate key
        let keyId = try await generateKey()
        
        // Step 2: Get server challenge
        let serverChallenge = try await challengeProvider.getChallenge()
        
        // Step 3: Attest key
        let attestation = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Data, Error>) in
            dcAppAttestService.attestKey(keyId, clientDataHash: serverChallenge) { attestation, error in
                if let error = error {
                    continuation.resume(throwing: AppAttestError.attestationFailed(error))
                } else if let attestation = attestation {
                    continuation.resume(returning: attestation)
                } else {
                    continuation.resume(throwing: AppAttestError.unknownError)
                }
            }
        }
        
        let result = AttestationResult(
            keyId: keyId,
            challenge: serverChallenge,
            attestation: attestation,
            timestamp: Date()
        )
        
        // Export for verification
        let exportData = AttestationExportData(
            keyId: keyId,
            challenge: serverChallenge,
            attestation: attestation,
            timestamp: Date()
        )
        
        onAttestationExport?(exportData)
        try saveAttestationToFile(exportData)
        
        // Persist the keyId for future use
        saveAttestedKeyId(keyId)
        
        return result
    }
    
    // MARK: - Key Management
    
    /// Get the current key ID if one has been generated
    public func getCurrentKeyId() -> String? {
        return keyId
    }
    
    /// Set a previously generated key ID (e.g., loaded from storage)
    public func setKeyId(_ keyId: String) {
        self.keyId = keyId
        saveAttestedKeyId(keyId)
    }
    
    /// Clear the stored attestation (for testing or re-attestation)
    public func clearAttestation() {
        keyId = nil
        UserDefaults.standard.removeObject(forKey: attestedKeyIdKey)
    }
    
    // MARK: - Persistence
    
    /// Load previously attested keyId from UserDefaults
    private func loadAttestedKeyId() {
        if let savedKeyId = UserDefaults.standard.string(forKey: attestedKeyIdKey) {
            keyId = savedKeyId
            print("[AppAttest] Loaded attested keyId from storage")
        }
    }
    
    /// Save attested keyId to UserDefaults
    private func saveAttestedKeyId(_ keyId: String) {
        UserDefaults.standard.set(keyId, forKey: attestedKeyIdKey)
        print("[AppAttest] Saved attested keyId to storage")
    }
    
    // MARK: - Export Functions
    
    /// Save attestation data to a file for manual verification
    private func saveAttestationToFile(_ data: AttestationExportData) throws {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let attestationFolder = documentsPath.appendingPathComponent("AppAttest", isDirectory: true)
        
        // Create folder if needed
        try FileManager.default.createDirectory(at: attestationFolder, withIntermediateDirectories: true)
        
        // Create filename with timestamp
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyyMMdd_HHmmss"
        let timestamp = dateFormatter.string(from: data.timestamp)
        
        // Save attestation as binary
        let attestationFile = attestationFolder.appendingPathComponent("attestation_\(timestamp).cbor")
        try data.attestation.write(to: attestationFile)
        
        // Save metadata as JSON
        let metadata: [String: Any] = [
            "keyId": data.keyId,
            "challenge": data.challenge.base64EncodedString(),
            "timestamp": ISO8601DateFormatter().string(from: data.timestamp),
            "attestationFile": attestationFile.lastPathComponent
        ]
        
        let metadataFile = attestationFolder.appendingPathComponent("attestation_\(timestamp).json")
        let jsonData = try JSONSerialization.data(withJSONObject: metadata, options: .prettyPrinted)
        try jsonData.write(to: metadataFile)
        
        print("[AppAttest] Attestation exported to: \(attestationFolder.path)")
    }
    
    /// Get all exported attestation files
    public func getExportedAttestations() -> [URL] {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let attestationFolder = documentsPath.appendingPathComponent("AppAttest", isDirectory: true)
        
        do {
            let files = try FileManager.default.contentsOfDirectory(at: attestationFolder, includingPropertiesForKeys: nil)
            return files.filter { $0.pathExtension == "json" }
        } catch {
            return []
        }
    }
    
    /// Export attestation data as shareable format
    public func exportAttestationForSharing(_ data: AttestationExportData) -> Data? {
        let exportDict: [String: String] = [
            "keyId": data.keyId,
            "challenge": data.challenge.base64EncodedString(),
            "attestation": data.attestation.base64EncodedString(),
            "timestamp": ISO8601DateFormatter().string(from: data.timestamp)
        ]
        
        return try? JSONSerialization.data(withJSONObject: exportDict, options: .prettyPrinted)
    }
}

// MARK: - Data Structures

/// Result of a successful attestation
public struct AttestationResult {
    public let keyId: String
    public let challenge: Data
    public let attestation: Data
    public let timestamp: Date
    
    /// Attestation as Base64 string for easy transport
    public var attestationBase64: String {
        return attestation.base64EncodedString()
    }
}

/// Data structure for exporting attestation for manual verification
public struct AttestationExportData {
    public let keyId: String
    public let challenge: Data
    public let attestation: Data
    public let timestamp: Date
}

// MARK: - Errors

public enum AppAttestError: LocalizedError {
    case notSupported
    case keyGenerationFailed(Error)
    case attestationFailed(Error)
    case assertionFailed(Error)
    case challengeNotAvailable
    case unknownError
    
    public var errorDescription: String? {
        switch self {
        case .notSupported:
            return "App Attest is not supported on this device"
        case .keyGenerationFailed(let error):
            return "Key generation failed: \(error.localizedDescription)"
        case .attestationFailed(let error):
            return "Attestation failed: \(error.localizedDescription)"
        case .assertionFailed(let error):
            return "Assertion generation failed: \(error.localizedDescription)"
        case .challengeNotAvailable:
            return "Challenge not available from provider"
        case .unknownError:
            return "An unknown error occurred"
        }
    }
}
