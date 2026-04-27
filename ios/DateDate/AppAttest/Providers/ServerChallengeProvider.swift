import Foundation

/// Server-based challenge provider
/// Fetches challenges from a backend server API
public class ServerChallengeProvider: ChallengeProvider {
    
    private let serverURL: URL
    private let session: URLSession
    
    /// Optional authentication token
    public var authToken: String?
    
    /// Request timeout interval
    public var timeoutInterval: TimeInterval = 30
    
    public var providerName: String {
        return "Server (\(serverURL.host ?? "unknown"))"
    }
    
    /// Initialize with server URL
    /// - Parameter serverURL: Base URL for the challenge API
    public init(serverURL: URL) {
        self.serverURL = serverURL
        self.session = URLSession.shared
    }
    
    /// Initialize with server URL and custom session
    /// - Parameters:
    ///   - serverURL: Base URL for the challenge API
    ///   - session: Custom URLSession for requests
    public init(serverURL: URL, session: URLSession) {
        self.serverURL = serverURL
        self.session = session
    }
    
    public func getChallenge() async throws -> Data {
        // Build the request URL
        let challengeURL = serverURL.appendingPathComponent("challenge")
        
        var request = URLRequest(url: challengeURL)
        request.httpMethod = "POST"
        request.timeoutInterval = timeoutInterval
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add auth token if available
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // Add device info for logging
        let requestBody: [String: Any] = [
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "platform": "iOS",
            "purpose": "app_attest"
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        // Perform request
        let (data, response) = try await session.data(for: request)
        
        // Validate response
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ServerChallengeError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw ServerChallengeError.serverError(statusCode: httpResponse.statusCode)
        }
        
        // Parse response
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let challengeBase64 = json["challenge"] as? String,
              let challengeData = Data(base64Encoded: challengeBase64) else {
            throw ServerChallengeError.invalidChallengeFormat
        }
        
        print("[ServerChallenge] Received challenge from server: \(challengeData.hexString)")
        
        return challengeData
    }
}

// MARK: - Server Errors

public enum ServerChallengeError: LocalizedError {
    case invalidResponse
    case serverError(statusCode: Int)
    case invalidChallengeFormat
    case networkError(Error)
    
    public var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from server"
        case .serverError(let statusCode):
            return "Server returned error: \(statusCode)"
        case .invalidChallengeFormat:
            return "Challenge format is invalid"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

// MARK: - Example Server API Response Format

/*
 Expected server response format:
 
 POST /challenge
 
 Request:
 {
     "timestamp": "2024-01-01T12:00:00Z",
     "platform": "iOS",
     "purpose": "app_attest"
 }
 
 Response:
 {
     "challenge": "base64_encoded_32_bytes",
     "expires_at": "2024-01-01T12:05:00Z",
     "challenge_id": "uuid-for-tracking"
 }
 */
