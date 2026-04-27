# DateDate

Passport NFC reading and face verification application.

## Features

- 📷 Scan passport MRZ (Machine Readable Zone)
- 📱 Read passport chip data via NFC
- 👤 Real-time face comparison to verify passport holder

## Requirements

- iOS 15.0+
- Xcode 15.0+
- Python 3.8+ (for ML model generation)
- Physical device (NFC and camera cannot be used in simulator)

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-username/DateDate.git
cd DateDate
```

### 2. Generate FaceNet CoreML Model

The model file is not included in the repository due to its size. Generate it with:

```bash
# Install Python dependencies
pip install torch facenet-pytorch coremltools numpy

# Run conversion script
python convert_facenet.py
```

This will generate `FaceNet.mlpackage` in the `DateDate/ML/` directory.

### 3. Add Model to Xcode

1. Open `DateDate.xcodeproj`
2. Drag `DateDate/ML/FaceNet.mlpackage` into Xcode's project navigator
3. In the dialog:
   - ✅ Check "Copy items if needed"
   - ✅ Check target "DateDate"
4. Click "Finish"

### 4. Configure Signing

1. In Xcode, select the project → Signing & Capabilities
2. Select your development team
3. Ensure "Near Field Communication Tag Reading" is enabled

### 5. Run

Build and run the project on a physical device.

## Model Information

| Property | Value |
|----------|-------|
| Model | FaceNet (InceptionResnetV1) |
| Pre-trained Dataset | VGGFace2 |
| Input | 160×160 RGB image, normalized to [-1, 1] |
| Output | 512-dimensional face embedding vector |
| Comparison Method | Cosine similarity / Euclidean distance |

## Project Structure

```
DateDate/
├── DateDate/
│   ├── ContentView.swift          # Main UI
│   ├── MRZScannerView.swift        # MRZ scanning view
│   ├── FaceCaptureView.swift       # Face capture view
│   ├── FaceNetService.swift        # FaceNet inference service
│   ├── PassportUtils.swift         # MRZ parsing utilities
│   ├── Info.plist                  # Permission configuration
│   └── ML/
│       └── FaceNet.mlpackage       # CoreML model (needs generation)
├── convert_facenet.py              # Model conversion script
└── README.md
```

## License

MIT License