import SwiftUI
import Combine

/// SwiftUI View for App Attest management and testing
struct AppAttestView: View {
    
    @StateObject private var viewModel = AppAttestViewModel()
    @State private var showingExportSheet = false
    @State private var showingProviderSheet = false
    
    var body: some View {
        NavigationView {
            List {
                // Status Section
                Section("Device Status") {
                    HStack {
                        Text("App Attest Supported")
                        Spacer()
                        Image(systemName: viewModel.isSupported ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundColor(viewModel.isSupported ? .green : .red)
                    }
                    
                    HStack {
                        Text("Key Generated")
                        Spacer()
                        Image(systemName: viewModel.keyId != nil ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(viewModel.keyId != nil ? .green : .gray)
                    }
                    
                    if let keyId = viewModel.keyId {
                        HStack {
                            Text("Key ID")
                            Spacer()
                            Text(String(keyId.prefix(16)) + "...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                
                // Challenge Provider Section
                Section("Challenge Provider") {
                    Button(action: { showingProviderSheet = true }) {
                        HStack {
                            Text("Source")
                            Spacer()
                            Text(viewModel.providerName)
                                .foregroundColor(.secondary)
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                        }
                    }
                    .foregroundColor(.primary)
                }
                
                // Actions Section
                Section("Actions") {
                    Button(action: {
                        Task { await viewModel.performFullAttestation() }
                    }) {
                        HStack {
                            Image(systemName: "checkmark.shield.fill")
                            Text("Start Attestation")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .disabled(!viewModel.isSupported || viewModel.isLoading)
                }
                
                // Sign & Send Test Section
                if viewModel.keyId != nil && viewModel.lastResult != nil {
                    Section("Sign & Send Message") {
                        TextField("Message to sign", text: $viewModel.testMessage)
                            .textFieldStyle(.roundedBorder)
                        
                        Button(action: {
                            Task { await viewModel.signAndSendMessage() }
                        }) {
                            HStack {
                                Image(systemName: "signature")
                                Text("Sign Message")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .disabled(viewModel.testMessage.isEmpty || viewModel.isLoading)
                        
                        if let assertionResult = viewModel.lastAssertionResult {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Assertion Generated")
                                    .font(.headline)
                                    .foregroundColor(.green)
                                
                                Text("Message: \(assertionResult.message)")
                                    .font(.caption)
                                
                                Text("Assertion Size: \(assertionResult.assertion.count) bytes")
                                    .font(.caption)
                                
                                Text("Timestamp: \(assertionResult.timestamp.formatted())")
                                    .font(.caption)
                                
                                Button("Copy Assertion (Base64)") {
                                    UIPasteboard.general.string = assertionResult.assertion.base64EncodedString()
                                }
                                .font(.caption)
                                
                                Button("Share Signed Request") {
                                    viewModel.shareSignedRequest(assertionResult)
                                }
                                .font(.caption)
                            }
                            .foregroundColor(.secondary)
                            .padding(.top, 8)
                        }
                    }
                }
                
                // Export Section
                Section("Export") {
                    Button("View Exported Attestations") {
                        showingExportSheet = true
                    }
                    
                    if let lastAttestation = viewModel.lastAttestationData {
                        Button("Share Last Attestation") {
                            viewModel.shareAttestation(lastAttestation)
                        }
                    }
                }
                
                // Result Section
                if let result = viewModel.lastResult {
                    Section("Last Result") {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Key ID: \(result.keyId)")
                                .font(.caption)
                            Text("Timestamp: \(result.timestamp.formatted())")
                                .font(.caption)
                            Text("Attestation Size: \(result.attestation.count) bytes")
                                .font(.caption)
                        }
                        .foregroundColor(.secondary)
                    }
                }
                
                // Error Section
                if let error = viewModel.errorMessage {
                    Section("Error") {
                        Text(error)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("App Attest")
            .overlay {
                if viewModel.isLoading {
                    ProgressView("Processing...")
                        .padding()
                        .background(Color(.systemBackground))
                        .cornerRadius(10)
                        .shadow(radius: 5)
                }
            }
            .sheet(isPresented: $showingExportSheet) {
                ExportedAttestationsView()
            }
            .sheet(isPresented: $showingProviderSheet) {
                ProviderSelectionView(viewModel: viewModel)
            }
        }
    }
}

// MARK: - Exported Attestations View

struct ExportedAttestationsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var attestations: [URL] = []
    
    var body: some View {
        NavigationView {
            List {
                if attestations.isEmpty {
                    Text("No exported attestations found")
                        .foregroundColor(.secondary)
                } else {
                    ForEach(attestations, id: \.path) { url in
                        VStack(alignment: .leading) {
                            Text(url.lastPathComponent)
                                .font(.headline)
                            Text(url.deletingLastPathComponent().path)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Exported Attestations")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear {
                attestations = AppAttestService.shared.getExportedAttestations()
            }
        }
    }
}

// MARK: - Provider Selection View

struct ProviderSelectionView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: AppAttestViewModel
    
    @State private var serverURL: String = ""
    @State private var contractAddress: String = ""
    @State private var chainId: String = "1"
    
    var body: some View {
        NavigationView {
            Form {
                Section("Select Provider") {
                    Button("Mock (Local Random)") {
                        viewModel.setProvider(.mock)
                        dismiss()
                    }
                }
                
                Section("Server Provider") {
                    TextField("Server URL", text: $serverURL)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                    
                    Button("Use Server") {
                        if let url = URL(string: serverURL) {
                            viewModel.setProvider(.server(url: url))
                            dismiss()
                        }
                    }
                    .disabled(serverURL.isEmpty)
                }
                
                Section("Blockchain Provider") {
                    TextField("Contract Address", text: $contractAddress)
                        .autocapitalization(.none)
                    
                    TextField("Chain ID", text: $chainId)
                        .keyboardType(.numberPad)
                    
                    Button("Use Blockchain") {
                        if let chain = Int(chainId), !contractAddress.isEmpty {
                            viewModel.setProvider(.blockchain(contractAddress: contractAddress, chainId: chain))
                            dismiss()
                        }
                    }
                    .disabled(contractAddress.isEmpty || chainId.isEmpty)
                }
            }
            .navigationTitle("Challenge Provider")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

// MARK: - View Model

@MainActor
class AppAttestViewModel: ObservableObject {
    
    @Published var isSupported: Bool = false
    @Published var keyId: String?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var providerName: String = "Mock (Local Random)"
    @Published var lastResult: AttestationResult?
    @Published var lastAttestationData: AttestationExportData?
    
    // Sign & Send
    @Published var testMessage: String = "Hello, this is a test message!"
    @Published var lastAssertionResult: AssertionResult?
    
    private let service = AppAttestService.shared
    
    init() {
        isSupported = service.isSupported
        keyId = service.getCurrentKeyId()
        providerName = ChallengeManager.shared.currentSourceName
        
        // Set up export callback
        service.onAttestationExport = { [weak self] data in
            DispatchQueue.main.async {
                self?.lastAttestationData = data
            }
        }
    }
    
    func generateKey() async {
        isLoading = true
        errorMessage = nil
        
        do {
            keyId = try await service.generateKey()
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func performAttestation() async {
        guard let keyId = keyId else { return }
        
        isLoading = true
        errorMessage = nil
        
        do {
            let _ = try await service.attestKey(keyId)
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func performFullAttestation() async {
        isLoading = true
        errorMessage = nil
        
        do {
            lastResult = try await service.performFullAttestation()
            keyId = lastResult?.keyId
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func setProvider(_ source: ChallengeSource) {
        ChallengeManager.shared.configure(source: source)
        providerName = ChallengeManager.shared.currentSourceName
    }
    
    func shareAttestation(_ data: AttestationExportData) {
        guard let jsonData = service.exportAttestationForSharing(data) else { return }
        
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("attestation.json")
        try? jsonData.write(to: tempURL)
        
        let activityVC = UIActivityViewController(activityItems: [tempURL], applicationActivities: nil)
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            rootVC.present(activityVC, animated: true)
        }
    }
    
    // MARK: - Sign & Send Message
    
    func signAndSendMessage() async {
        guard let keyId = keyId else {
            errorMessage = "No key available. Please run attestation first."
            return
        }
        
        guard !testMessage.isEmpty else {
            errorMessage = "Message cannot be empty"
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        do {
            let messageData = testMessage.data(using: .utf8)!
            let assertion = try await service.generateAssertion(keyId: keyId, requestData: messageData)
            
            lastAssertionResult = AssertionResult(
                keyId: keyId,
                message: testMessage,
                messageData: messageData,
                assertion: assertion,
                timestamp: Date()
            )
            
            print("[AppAttest] Message signed successfully")
            print("[AppAttest] Assertion size: \(assertion.count) bytes")
            
        } catch {
            errorMessage = "Failed to sign message: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
    
    func shareSignedRequest(_ result: AssertionResult) {
        let exportDict: [String: String] = [
            "keyId": result.keyId,
            "message": result.message,
            "messageBase64": result.messageData.base64EncodedString(),
            "assertion": result.assertion.base64EncodedString(),
            "timestamp": ISO8601DateFormatter().string(from: result.timestamp)
        ]
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: exportDict, options: .prettyPrinted) else { return }
        
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("signed_request.json")
        try? jsonData.write(to: tempURL)
        
        let activityVC = UIActivityViewController(activityItems: [tempURL], applicationActivities: nil)
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            rootVC.present(activityVC, animated: true)
        }
    }
}

// MARK: - Assertion Result

struct AssertionResult {
    let keyId: String
    let message: String
    let messageData: Data
    let assertion: Data
    let timestamp: Date
    
    var assertionBase64: String {
        return assertion.base64EncodedString()
    }
}

// MARK: - Preview

#Preview {
    AppAttestView()
}
