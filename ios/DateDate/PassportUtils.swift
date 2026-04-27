import Foundation

struct MRZData {
    let documentNumber: String
    let birthDate: Date
    let expiryDate: Date
    
    // The format required by NFCPassportReader is usually:
    // passportNumber + checksum + birthDate (YYMMDD) + checksum + expiryDate (YYMMDD) + checksum
    // Note: The NFCPassportReader library handles the final logic often, but we need to pass the "passport number", "date of birth", and "expiry date" correctly.
    // However, the standard `readPassport` function usually takes `passportNumber`, `birthDate`, `expiryDate` string args OR a generated "MRZ Key".
    // Let's look at the library API interpretation.
    // The library usually has: readPassport(mrzKey: ...)
    // mrzKey = passportNumber + passportNumberChecksum + dob + dobChecksum + expiry + expiryChecksum
}

class PassportUtils {
    
    static func getMRZKey(passportNumber: String, birthDate: Date, expiryDate: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyMMdd"
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        
        let dobString = formatter.string(from: birthDate)
        let expiryString = formatter.string(from: expiryDate)
        
        let passportChecksum = calcChecksum(passportNumber)
        let dobChecksum = calcChecksum(dobString)
        let expiryChecksum = calcChecksum(expiryString)
        
        return "\(passportNumber)\(passportChecksum)\(dobString)\(dobChecksum)\(expiryString)\(expiryChecksum)"
    }
    
    // ICAO 9303 Checksum: 7, 3, 1 weights
    static func calcChecksum(_ text: String) -> Int {
        let mapping: [Character: Int] = [
            "0":0, "1":1, "2":2, "3":3, "4":4, "5":5, "6":6, "7":7, "8":8, "9":9,
            "A":10, "B":11, "C":12, "D":13, "E":14, "F":15, "G":16, "H":17, "I":18, "J":19,
            "K":20, "L":21, "M":22, "N":23, "O":24, "P":25, "Q":26, "R":27, "S":28, "T":29,
            "U":30, "V":31, "W":32, "X":33, "Y":34, "Z":35, "<":0
        ]
        
        // Weights repeat 7, 3, 1
        let weights = [7, 3, 1]
        var total = 0
        
        let uppercased = text.uppercased()
        
        for (index, char) in uppercased.enumerated() {
            guard let val = mapping[char] else { continue }
            let weight = weights[index % 3]
            total += val * weight
        }
        
        return total % 10
    }
    
    // Parser for TD3 MRZ (2-line passport format, each line 44 chars)
    // Line 1: P<NATIONALITY<SURNAME<<GIVEN<NAMES<<<<<<<<<<<<<<<
    // Line 2: DOCUMENT_NUMBER<CHECK_DIGIT NATIONALITY DOB CHECK SEX EXPIRY CHECK ...
    // Line 2 Structure:
    // 0-8   : Document Number (9 chars, padded with <)
    // 9     : Check digit for document number
    // 10-12 : Nationality (3 chars)
    // 13-18 : Date of birth (YYMMDD)
    // 19    : Check digit for DOB
    // 20    : Sex (M/F/<)
    // 21-26 : Date of expiry (YYMMDD)
    // 27    : Check digit for expiry
    // 28-41 : Optional data
    // 42    : Check digit for optional data
    // 43    : Overall check digit
    static func parseMRZ(mrzString: String) -> MRZData? {
        // Split by newline to get both lines
        let lines = mrzString.components(separatedBy: "\n")
        
        // We need at least 2 lines for TD3
        guard lines.count >= 2 else {
            // Try parsing as single line (line 2 only)
            return parseLine2(lines[0])
        }
        
        // Line 2 contains the data we need
        let line2 = lines[1].uppercased().replacingOccurrences(of: " ", with: "")
        return parseLine2(line2)
    }
    
    private static func parseLine2(_ line: String) -> MRZData? {
        let cleanLine = line.uppercased().replacingOccurrences(of: " ", with: "")
        guard cleanLine.count >= 28 else { return nil }
        
        // Document number is positions 0-8 (9 characters)
        let docNumber = extract(cleanLine, 0, 9).replacingOccurrences(of: "<", with: "")
        // DOB is positions 13-18
        let dobString = extract(cleanLine, 13, 6)
        // Expiry is positions 21-26
        let expiryString = extract(cleanLine, 21, 6)
        
        // Convert dates
        let formatter = DateFormatter()
        formatter.dateFormat = "yyMMdd"
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        
        // Handle pivot year for DOB (assume people are not born in the future)
        // For expiry, dates in 20xx are normal
        guard let dob = parseDate(dobString, isPast: true),
              let expiry = parseDate(expiryString, isPast: false) else {
            return nil
        }
        
        return MRZData(documentNumber: docNumber, birthDate: dob, expiryDate: expiry)
    }
    
    private static func parseDate(_ dateString: String, isPast: Bool) -> Date? {
        guard dateString.count == 6 else { return nil }
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyMMdd"
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        
        guard let date = formatter.date(from: dateString) else { return nil }
        
        // For birth dates, if the parsed date is in the future, subtract 100 years
        if isPast && date > Date() {
            let calendar = Calendar.current
            return calendar.date(byAdding: .year, value: -100, to: date)
        }
        
        return date
    }
    
    private static func extract(_ str: String, _ start: Int, _ len: Int) -> String {
        let startIndex = str.index(str.startIndex, offsetBy: start)
        let endIndex = str.index(str.startIndex, offsetBy: start + len)
        return String(str[startIndex..<endIndex])
    }
}
