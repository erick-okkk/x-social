#!/usr/bin/env python3
"""
FaceNet to CoreML Converter

This script downloads a pre-trained FaceNet model and converts it to CoreML format
for use in iOS applications.
"""

import torch
import torch.nn as nn
import coremltools as ct
from facenet_pytorch import InceptionResnetV1
import numpy as np

def main():
    print("Step 1: Loading pre-trained FaceNet model (VGGFace2)...")
    
    # Load the pre-trained FaceNet model
    # 'vggface2' - trained on VGGFace2 dataset
    # 'casia-webface' - trained on CASIA-Webface dataset
    model = InceptionResnetV1(pretrained='vggface2').eval()
    
    print("Step 2: Creating example input...")
    # FaceNet expects 160x160 RGB images, normalized to [-1, 1]
    # Input shape: (batch_size, 3, 160, 160)
    example_input = torch.randn(1, 3, 160, 160)
    
    print("Step 3: Tracing the model with TorchScript...")
    traced_model = torch.jit.trace(model, example_input)
    
    print("Step 4: Converting to CoreML format...")
    
    # Convert to CoreML
    mlmodel = ct.convert(
        traced_model,
        inputs=[
            ct.TensorType(
                name="input_image",
                shape=(1, 3, 160, 160),
                dtype=np.float32
            )
        ],
        outputs=[
            ct.TensorType(name="embedding")
        ],
        minimum_deployment_target=ct.target.iOS15,
        convert_to="mlprogram"  # Use ML Program format for better performance
    )
    
    # Add metadata
    mlmodel.author = "FaceNet (converted from facenet-pytorch)"
    mlmodel.license = "MIT License"
    mlmodel.short_description = "FaceNet face recognition model that outputs 512-dimensional embeddings"
    mlmodel.version = "1.0"
    
    # Add input/output descriptions
    spec = mlmodel.get_spec()
    
    print("Step 5: Saving CoreML model...")
    output_path = "DateDate/ML/FaceNet.mlpackage"
    mlmodel.save(output_path)
    
    print(f"\n✅ Successfully converted FaceNet to CoreML!")
    print(f"   Model saved to: {output_path}")
    print(f"\n📝 Model Info:")
    print(f"   - Input: 160x160 RGB image (normalized to [-1, 1])")
    print(f"   - Output: 512-dimensional face embedding")
    print(f"   - Use L2 distance or cosine similarity to compare embeddings")
    
    # Test the model
    print("\n🧪 Testing model output shape...")
    with torch.no_grad():
        test_output = model(example_input)
        print(f"   Embedding shape: {test_output.shape}")
        print(f"   Embedding norm: {torch.norm(test_output).item():.4f}")

if __name__ == "__main__":
    main()
