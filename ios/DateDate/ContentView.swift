//
//  ContentView.swift
//  DateDate
//
//  Created by Harold on 2026/1/28.
//

import SwiftUI
import NFCPassportReader
import CryptoKit

struct ContentView: View {
    @State private var showScanner = false
    @State private var showFaceCapture = false
    @State private var scanError: String?
    @State private var passportData: MRZData?
    @State private var passportImage: UIImage?
    @State private var capturedFaceImage: UIImage?
    @State private var passportDetails: String = ""
    @State private var isNFCReading = false
    @State private var isComparingFaces = false
    @State private var faceComparisonResult: FaceComparisonResult?
    
    // EVM Address and signing
    @State private var evmAddress: String = ""
    @State private var isSigning = false
    @State private var signedResult: SignedPassportData?
    @State private var showExportSheet = false
    
    // Full passport data for hashing
    @State private var fullPassportInfo: PassportFullInfo?
    
    // Passport Reader instance
    private let passportReader = PassportReader()
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    if let data = passportData {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Scanned MRZ Data:")
                                .font(.headline)
                            Text("Doc Number: \(data.documentNumber)")
                            Text("Birth Date: \(formatDate(data.birthDate))")
                            Text("Expiry Date: \(formatDate(data.expiryDate))")
                            
                            Divider()
                            
                            if isNFCReading {
                                ProgressView("Reading NFC Chip...")
                            } else {
                                if let image = passportImage {
                                    HStack {
                                        VStack {
                                            Text("Passport Photo")
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                            Image(uiImage: image)
                                                .resizable()
                                                .scaledToFit()
                                                .frame(height: 150)
                                                .cornerRadius(8)
                                        }
                                        
                                        if let capturedImage = capturedFaceImage {
                                            VStack {
                                                Text("Captured Photo")
                                                    .font(.caption)
                                                    .foregroundColor(.secondary)
                                                Image(uiImage: capturedImage)
                                                    .resizable()
                                                    .scaledToFit()
                                                    .frame(height: 150)
                                                    .cornerRadius(8)
                                            }
                                        }
                                    }
                                    
                                    // Face comparison result
                                    if let result = faceComparisonResult {
                                        HStack {
                                            Image(systemName: result.isMatch ? "checkmark.circle.fill" : "xmark.circle.fill")
                                                .foregroundColor(result.isMatch ? .green : .red)
                                            Text(result.message)
                                                .font(.subheadline)
                                                .foregroundColor(result.isMatch ? .green : .red)
                                        }
                                        .padding()
                                        .background(result.isMatch ? Color.green.opacity(0.1) : Color.red.opacity(0.1))
                                        .cornerRadius(8)
                                        
                                        // Show EVM binding section if face matched
                                        if result.isMatch {
                                            Divider()
                                            evmBindingSection
                                        }
                                    }
                                    
                                    // Face verification button (only show if not matched yet)
                                    if faceComparisonResult == nil || faceComparisonResult?.isMatch == false {
                                        if isComparingFaces {
                                            ProgressView("Comparing faces...")
                                        } else {
                                            Button(action: { showFaceCapture = true }) {
                                                Label("Verify Face", systemImage: "faceid")
                                                    .font(.title3)
                                                    .frame(maxWidth: .infinity)
                                                    .padding()
                                                    .background(Color.green)
                                                    .foregroundColor(.white)
                                                    .cornerRadius(10)
                                            }
                                        }
                                    }
                                }
                                
                                Text(passportDetails)
                                    .font(.caption)
                                
                                if passportImage == nil {
                                    Button(action: startNFCRead) {
                                        Label("Start NFC Read", systemImage: "wave.3.right.circle.fill")
                                            .font(.title2)
                                            .frame(maxWidth: .infinity)
                                            .padding()
                                            .background(Color.blue)
                                            .foregroundColor(.white)
                                            .cornerRadius(10)
                                    }
                                }
                            }
                        }
                        .padding()
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(12)
                        .padding()
                        
                        Button("Reset") {
                            resetAll()
                        }
                    } else {
                        VStack {
                            Image(systemName: "text.viewfinder")
                                .font(.system(size: 60))
                                .foregroundColor(.gray)
                            Text("Please scan the bottom text line (MRZ) of your passport")
                                .multilineTextAlignment(.center)
                                .padding()
                            
                            Button(action: { showScanner = true }) {
                                Text("Scan Passport MRZ")
                                    .font(.headline)
                                    .padding()
                                    .frame(maxWidth: .infinity)
                                    .background(Color.blue)
                                    .foregroundColor(.white)
                                    .cornerRadius(10)
                            }
                            .padding(.horizontal)
                        }
                    }
                    
                    if let error = scanError {
                        Text(error)
                            .foregroundColor(.red)
                            .padding()
                    }
                }
            }
            .navigationTitle("Passport NFC")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    NavigationLink(destination: AppAttestView()) {
                        Image(systemName: "checkmark.shield")
                    }
                }
            }
            .sheet(isPresented: $showScanner) {
                MRZScannerView { mrzText in
                    print("MRZ Scanned: \(mrzText)")
                    if let data = PassportUtils.parseMRZ(mrzString: mrzText) {
                        self.passportData = data
                        self.scanError = nil
                    } else {
                        self.scanError = "Failed to parse MRZ data"
                    }
                    self.showScanner = false
                }
            }
            .sheet(isPresented: $showFaceCapture) {
                if let passportImg = passportImage {
                    FaceCaptureView(passportImage: passportImg) { capturedImage, result in
                        self.capturedFaceImage = capturedImage
                        self.faceComparisonResult = result
                    }
                }
            }
            .sheet(isPresented: $showExportSheet) {
                if let result = signedResult {
                    ExportSignedDataView(signedData: result)
                }
            }
        }
    }
    
    func resetAll() {
        passportData = nil
        passportDetails = ""
        passportImage = nil
        capturedFaceImage = nil
        faceComparisonResult = nil
        scanError = nil
        evmAddress = ""
        signedResult = nil
        fullPassportInfo = nil
    }
    
    // MARK: - EVM Binding Section
    
    private var evmBindingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Bind to EVM Address")
                .font(.headline)
            
            TextField("0x...", text: $evmAddress)
                .textFieldStyle(.roundedBorder)
                .autocapitalization(.none)
                .disableAutocorrection(true)
                .font(.system(.body, design: .monospaced))
            
            if !isValidEVMAddress(evmAddress) && !evmAddress.isEmpty {
                Text("Invalid EVM address format")
                    .font(.caption)
                    .foregroundColor(.red)
            }
            
            if isSigning {
                ProgressView("Signing with App Attest...")
            } else {
                HStack(spacing: 12) {
                    Button(action: signAndSendToServer) {
                        Label("Send to Server", systemImage: "arrow.up.circle.fill")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(isValidEVMAddress(evmAddress) ? Color.blue : Color.gray)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                    .disabled(!isValidEVMAddress(evmAddress))
                    
                    Button(action: signAndExport) {
                        Label("Export", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(isValidEVMAddress(evmAddress) ? Color.orange : Color.gray)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                    .disabled(!isValidEVMAddress(evmAddress))
                }
            }
            
            // Show signed result
            if let result = signedResult {
                VStack(alignment: .leading, spacing: 8) {
                    Text("✓ Signed Successfully")
                        .font(.headline)
                        .foregroundColor(.green)
                    
                    Group {
                        Text("Passport Hash:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(result.passportHash)
                            .font(.system(.caption2, design: .monospaced))
                            .lineLimit(1)
                            .truncationMode(.middle)
                        
                        Text("EVM Address:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(result.evmAddress)
                            .font(.system(.caption2, design: .monospaced))
                        
                        Text("Assertion Size: \(result.assertion.count) bytes")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
                .background(Color.green.opacity(0.1))
                .cornerRadius(8)
            }
        }
    }
    
    // MARK: - EVM Address Validation
    
    private func isValidEVMAddress(_ address: String) -> Bool {
        // Basic validation: starts with 0x and has 40 hex characters
        let pattern = "^0x[a-fA-F0-9]{40}$"
        return address.range(of: pattern, options: .regularExpression) != nil
    }
    
    // MARK: - Signing Functions
    
    private func signAndSendToServer() {
        Task {
            await signPassportData(sendToServer: true)
        }
    }
    
    private func signAndExport() {
        Task {
            await signPassportData(sendToServer: false)
            showExportSheet = true
        }
    }
    
    private func signPassportData(sendToServer: Bool) async {
        guard let passportInfo = fullPassportInfo else {
            scanError = "Passport data not available"
            return
        }
        
        guard isValidEVMAddress(evmAddress) else {
            scanError = "Invalid EVM address"
            return
        }
        
        await MainActor.run { isSigning = true }
        
        do {
            // Step 1: Hash passport data
            let passportHash = hashPassportInfo(passportInfo)
            
            // Step 2: Create payload
            let payload = BindingPayload(
                passportHash: passportHash,
                evmAddress: evmAddress.lowercased()
            )
            
            let payloadData = try JSONEncoder().encode(payload)
            
            // Step 3: Sign with App Attest
            let service = AppAttestService.shared
            guard let keyId = service.getCurrentKeyId() else {
                // Need to perform attestation first
                let result = try await service.performFullAttestation()
                await signWithKey(keyId: result.keyId, payloadData: payloadData, payload: payload, sendToServer: sendToServer)
                return
            }
            
            await signWithKey(keyId: keyId, payloadData: payloadData, payload: payload, sendToServer: sendToServer)
            
        } catch {
            await MainActor.run {
                scanError = "Signing failed: \(error.localizedDescription)"
                isSigning = false
            }
        }
    }
    
    private func signWithKey(keyId: String, payloadData: Data, payload: BindingPayload, sendToServer: Bool) async {
        do {
            let service = AppAttestService.shared
            let assertion = try await service.generateAssertion(keyId: keyId, requestData: payloadData)
            
            let result = SignedPassportData(
                passportHash: payload.passportHash,
                evmAddress: payload.evmAddress,
                assertion: assertion,
                keyId: keyId,
                timestamp: Date()
            )
            
            await MainActor.run {
                self.signedResult = result
                self.isSigning = false
            }
            
            if sendToServer {
                await submitToServer(result: result)
            }
            
        } catch {
            await MainActor.run {
                scanError = "Signing failed: \(error.localizedDescription)"
                isSigning = false
            }
        }
    }
    
    private func submitToServer(result: SignedPassportData) async {
        // Get server URL from challenge provider
        guard let serverURL = getServerURL() else {
            await MainActor.run {
                scanError = "Server URL not configured. Please set up Server Challenge Provider."
            }
            return
        }
        
        let requestBody: [String: String] = [
            "passportHash": result.passportHash,
            "evmAddress": result.evmAddress,
            "assertion": result.assertion.base64EncodedString(),
            "keyId": result.keyId,
            "timestamp": ISO8601DateFormatter().string(from: result.timestamp)
        ]
        
        guard let bodyData = try? JSONSerialization.data(withJSONObject: requestBody) else {
            return
        }
        
        var request = URLRequest(url: serverURL.appendingPathComponent("/bind"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = bodyData
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                await MainActor.run {
                    scanError = nil
                    // Show success
                }
            } else {
                await MainActor.run {
                    scanError = "Server returned error"
                }
            }
        } catch {
            await MainActor.run {
                scanError = "Network error: \(error.localizedDescription)"
            }
        }
    }
    
    private func getServerURL() -> URL? {
        // Try to get URL from ChallengeManager if using server provider
        // For now, return nil to indicate not configured
        // In production, this would check the current challenge provider
        return nil
    }
    
    private func hashPassportInfo(_ info: PassportFullInfo) -> String {
        // Combine ALL passport chip data for maximum entropy
        var dataToHash = Data()
        
        // 1. Add text fields (basic identity info)
        let textFields = "\(info.documentNumber)|\(info.firstName)|\(info.lastName)|\(info.nationality)|\(info.gender)|\(info.birthDate)|\(info.expiryDate)"
        dataToHash.append(Data(textFields.utf8))
        
        // 2. Add photo data (high entropy - unique biometric)
        if let photoData = info.photoData {
            dataToHash.append(photoData)
        }
        
        // 3. Add raw DG1 data (MRZ raw bytes from chip)
        if let dg1 = info.dg1Data {
            dataToHash.append(dg1)
        }
        
        // 4. Add raw DG2 data (Face image data group - full biometric)
        if let dg2 = info.dg2Data {
            dataToHash.append(dg2)
        }
        
        // 5. Add SOD data (Security Object - contains cryptographic hashes of all DGs)
        if let sod = info.sodData {
            dataToHash.append(sod)
        }
        
        // SHA-256 hash of all combined data
        let hash = SHA256.hash(data: dataToHash)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
    
    func formatDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        return f.string(from: date)
    }
    
    func compareFaces() {
        guard let passportImg = passportImage, let capturedImg = capturedFaceImage else {
            scanError = "Missing photo"
            return
        }
        
        isComparingFaces = true
        
        Task {
            let result = await FaceComparisonService.compareFaces(
                passportImage: passportImg,
                capturedImage: capturedImg
            )
            
            await MainActor.run {
                self.faceComparisonResult = result
                self.isComparingFaces = false
            }
        }
    }
    
    func startNFCRead() {
        guard let data = passportData else { return }
        
        let mrzKey = PassportUtils.getMRZKey(
            passportNumber: data.documentNumber,
            birthDate: data.birthDate,
            expiryDate: data.expiryDate
        )
        
        // This key (e.g. "12345678<898012772508315") is used for BAC (Basic Access Control)
        
        isNFCReading = true
        scanError = nil
        
        Task {
            do {
                // Usually we read DG1 (MRZ), DG2 (Face), SOD (Security Object)
                // .DG1, .DG2, .DG11, .DG12, .DG14, .SOD
                let passport = try await passportReader.readPassport(mrzKey: mrzKey, tags: [.DG1, .DG2, .DG11, .SOD])
                
                await MainActor.run {
                    self.passportDetails = """
                    Name: \(passport.firstName) \(passport.lastName)
                    Gender: \(passport.gender)
                    Nationality: \(passport.nationality)
                    """
                    self.passportImage = passport.passportImage
                    self.isNFCReading = false
                    
                    // Store full passport info for hashing (including raw chip data for entropy)
                    let dateFormatter = DateFormatter()
                    dateFormatter.dateFormat = "yyMMdd"
                    
                    // Get raw data from data groups for maximum entropy
                    let dg1Raw: Data? = passport.dataGroupsRead[.DG1].map { Data($0.data) }
                    let dg2Raw: Data? = passport.dataGroupsRead[.DG2].map { Data($0.data) }
                    let sodRaw: Data? = passport.dataGroupsRead[.SOD].map { Data($0.data) }
                    
                    // Get photo as JPEG data
                    let photoData = passport.passportImage?.jpegData(compressionQuality: 1.0)
                    
                    self.fullPassportInfo = PassportFullInfo(
                        documentNumber: data.documentNumber,
                        firstName: passport.firstName,
                        lastName: passport.lastName,
                        nationality: passport.nationality,
                        gender: passport.gender,
                        birthDate: dateFormatter.string(from: data.birthDate),
                        expiryDate: dateFormatter.string(from: data.expiryDate),
                        photoData: photoData,
                        sodData: sodRaw,
                        dg1Data: dg1Raw,
                        dg2Data: dg2Raw
                    )
                }
            } catch {
                await MainActor.run {
                    self.passportDetails = "Error: \(error.localizedDescription)"
                    self.isNFCReading = false
                }
            }
        }
    }
}

#Preview {
    ContentView()
}

// MARK: - Data Structures

struct PassportFullInfo {
    let documentNumber: String
    let firstName: String
    let lastName: String
    let nationality: String
    let gender: String
    let birthDate: String
    let expiryDate: String
    
    // Raw photo data from passport chip for hashing (high entropy)
    let photoData: Data?
    
    // Optional: Additional data groups from chip
    let sodData: Data?  // Security Object Document (includes hashes of all DGs)
    let dg1Data: Data?  // MRZ data group raw bytes
    let dg2Data: Data?  // Face image data group raw bytes
}

struct BindingPayload: Codable {
    let passportHash: String
    let evmAddress: String
}

struct SignedPassportData {
    let passportHash: String
    let evmAddress: String
    let assertion: Data
    let keyId: String
    let timestamp: Date
    
    func toJSON() -> [String: String] {
        return [
            "passportHash": passportHash,
            "evmAddress": evmAddress,
            "assertion": assertion.base64EncodedString(),
            "keyId": keyId,
            "timestamp": ISO8601DateFormatter().string(from: timestamp)
        ]
    }
}

// MARK: - Export View

struct ExportSignedDataView: View {
    let signedData: SignedPassportData
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.green)
                
                Text("Signed Data Ready")
                    .font(.title)
                    .fontWeight(.bold)
                
                VStack(alignment: .leading, spacing: 12) {
                    Group {
                        Text("Passport Hash:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(signedData.passportHash)
                            .font(.system(.caption, design: .monospaced))
                            .lineLimit(2)
                        
                        Text("EVM Address:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(signedData.evmAddress)
                            .font(.system(.caption, design: .monospaced))
                        
                        Text("Key ID:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(signedData.keyId)
                            .font(.system(.caption2, design: .monospaced))
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                }
                .padding()
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(12)
                
                Spacer()
                
                VStack(spacing: 12) {
                    Button(action: copyToClipboard) {
                        Label("Copy JSON", systemImage: "doc.on.doc")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                    
                    Button(action: shareJSON) {
                        Label("Share", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.orange)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                }
            }
            .padding()
            .navigationTitle("Export")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
    
    private func copyToClipboard() {
        let json = signedData.toJSON()
        if let data = try? JSONSerialization.data(withJSONObject: json, options: .prettyPrinted),
           let string = String(data: data, encoding: .utf8) {
            UIPasteboard.general.string = string
        }
    }
    
    private func shareJSON() {
        let json = signedData.toJSON()
        guard let data = try? JSONSerialization.data(withJSONObject: json, options: .prettyPrinted) else { return }
        
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("passport_binding.json")
        try? data.write(to: tempURL)
        
        let activityVC = UIActivityViewController(activityItems: [tempURL], applicationActivities: nil)
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            rootVC.present(activityVC, animated: true)
        }
    }
}
