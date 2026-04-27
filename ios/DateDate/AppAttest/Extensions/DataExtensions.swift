import Foundation

// MARK: - Data Extensions for Hex Encoding/Decoding

extension Data {
    
    /// Initialize Data from a hex string
    /// - Parameter hexString: Hex encoded string (e.g., "48656c6c6f")
    /// - Returns: nil if the string is not valid hex
    init?(hexString: String) {
        let hex = hexString.replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "0x", with: "") // Remove 0x prefix if present
        
        guard hex.count % 2 == 0 else { return nil }
        
        var data = Data()
        var index = hex.startIndex
        
        while index < hex.endIndex {
            let nextIndex = hex.index(index, offsetBy: 2)
            guard let byte = UInt8(hex[index..<nextIndex], radix: 16) else { return nil }
            data.append(byte)
            index = nextIndex
        }
        
        self = data
    }
    
    /// Convert Data to lowercase hex string
    var hexString: String {
        return map { String(format: "%02x", $0) }.joined()
    }
    
    /// Convert Data to uppercase hex string
    var hexStringUppercase: String {
        return map { String(format: "%02X", $0) }.joined()
    }
    
    /// Convert Data to hex string with 0x prefix
    var hexStringWithPrefix: String {
        return "0x" + hexString
    }
}
