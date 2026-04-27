#!/usr/bin/env python3
"""
App Attest Assertion Verification Script

Verifies ECDSA signatures from Apple Secure Enclave (TEE).

Requirements:
    pip install cryptography cbor2

Usage:
    python verify_assertion.py --json signed_data.json --public-key public_key.der
    python verify_assertion.py --json signed_data.json --parse-only
"""

import argparse
import json
import base64
import hashlib
import struct
from typing import Tuple, Dict, Any

try:
    import cbor2
    from cryptography.hazmat.primitives import serialization, hashes
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.backends import default_backend
    from cryptography.exceptions import InvalidSignature
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install cryptography cbor2")
    exit(1)


def parse_assertion(assertion_b64: str) -> Dict[str, Any]:
    """Parse assertion and extract info."""
    assertion_data = base64.b64decode(assertion_b64)
    assertion = cbor2.loads(assertion_data)
    
    auth_data = assertion.get('authenticatorData')
    signature = assertion.get('signature')
    
    result = {
        'rp_id_hash': auth_data[:32].hex() if auth_data else None,
        'flags': auth_data[32] if auth_data else None,
        'counter': struct.unpack('>I', auth_data[33:37])[0] if auth_data else None,
        'signature_length': len(signature) if signature else 0,
        'raw_auth_data': auth_data,
        'raw_signature': signature
    }
    return result


def verify_assertion(
    signed_data: Dict[str, Any],
    public_key_bytes: bytes,
    stored_counter: int = 0
) -> Tuple[bool, int, str]:
    """
    Verify assertion signature.
    
    Args:
        signed_data: JSON with passportHash, evmAddress, assertion
        public_key_bytes: Public key in DER format
        stored_counter: Previous counter for replay protection
    """
    try:
        # Extract fields
        passport_hash = signed_data['passportHash']
        evm_address = signed_data['evmAddress']
        assertion_b64 = signed_data['assertion']
        
        # Decode assertion
        assertion_data = base64.b64decode(assertion_b64)
        assertion = cbor2.loads(assertion_data)
        
        signature = assertion['signature']
        auth_data = assertion['authenticatorData']
        
        # Check counter
        counter = struct.unpack('>I', auth_data[33:37])[0]
        if counter <= stored_counter:
            return False, stored_counter, f"Replay: counter {counter} <= {stored_counter}"
        
        # Reconstruct signed payload
        payload = {'passportHash': passport_hash, 'evmAddress': evm_address}
        request_data = json.dumps(payload, separators=(',', ':')).encode()
        
        # Compute nonce = SHA256(authData || SHA256(requestData))
        client_data_hash = hashlib.sha256(request_data).digest()
        nonce = hashlib.sha256(auth_data + client_data_hash).digest()
        
        # Verify ECDSA signature
        public_key = serialization.load_der_public_key(public_key_bytes, default_backend())
        public_key.verify(signature, nonce, ec.ECDSA(hashes.SHA256()))
        
        return True, counter, f"✅ Valid (counter: {counter})"
        
    except InvalidSignature:
        return False, stored_counter, "❌ Invalid signature"
    except Exception as e:
        return False, stored_counter, f"❌ Error: {e}"


def main():
    parser = argparse.ArgumentParser(description="Verify App Attest assertion")
    parser.add_argument('--json', type=str, required=True, help='Signed data JSON file')
    parser.add_argument('--public-key', type=str, help='Public key file (DER format)')
    parser.add_argument('--parse-only', action='store_true', help='Only parse, skip verification')
    parser.add_argument('--counter', type=int, default=0, help='Stored counter')
    
    args = parser.parse_args()
    
    # Load JSON
    with open(args.json, 'r') as f:
        signed_data = json.load(f)
    
    # Display info
    print("\n" + "="*50)
    print("SIGNED DATA")
    print("="*50)
    print(f"Passport Hash: {signed_data.get('passportHash')}")
    print(f"EVM Address:   {signed_data.get('evmAddress')}")
    print(f"Key ID:        {signed_data.get('keyId')}")
    print(f"Timestamp:     {signed_data.get('timestamp')}")
    
    # Parse assertion
    parsed = parse_assertion(signed_data['assertion'])
    print(f"\nAssertion:")
    print(f"  Counter:    {parsed['counter']}")
    print(f"  Sig Length: {parsed['signature_length']} bytes")
    print("="*50)
    
    if args.parse_only:
        print("\n(Parse only mode - verification skipped)")
        return
    
    if not args.public_key:
        print("\n⚠️  No public key. Use --public-key to verify, or --parse-only to skip.")
        return
    
    # Load public key (supports JSON from verify_attestation.py or raw DER)
    public_key_bytes = None
    if args.public_key.endswith('.json'):
        with open(args.public_key, 'r') as f:
            pk_data = json.load(f)
        # Extract DER from JSON (output of verify_attestation.py)
        if 'publicKey' in pk_data and 'der' in pk_data['publicKey']:
            public_key_bytes = bytes.fromhex(pk_data['publicKey']['der'])
            print(f"ℹ️  Loaded public key from JSON (keyId: {pk_data.get('keyId', 'N/A')})")
        elif 'publicKey' in pk_data and 'derB64' in pk_data['publicKey']:
            public_key_bytes = base64.b64decode(pk_data['publicKey']['derB64'])
            print(f"ℹ️  Loaded public key from JSON (keyId: {pk_data.get('keyId', 'N/A')})")
        else:
            print("❌ JSON file does not contain publicKey.der field")
            return
    else:
        with open(args.public_key, 'rb') as f:
            public_key_bytes = f.read()
    
    is_valid, new_counter, message = verify_assertion(signed_data, public_key_bytes, args.counter)
    print(f"\nResult: {message}")
    
    if is_valid:
        print(f"New counter: {new_counter}")


if __name__ == '__main__':
    main()
