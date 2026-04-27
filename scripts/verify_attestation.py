#!/usr/bin/env python3
"""
Apple App Attest Attestation Verification Script

Verifies attestation data and outputs the public key and keyId.

Requirements:
    pip install cryptography cbor2

Usage:
    python verify_attestation.py --attestation <base64> --challenge <raw_bytes_or_hex> --team-id <team> --bundle-id <bundle> --env dev|prod
    python verify_attestation.py --file attestation.json
"""

import argparse
import base64
import hashlib
import struct
import json
from dataclasses import dataclass
from typing import Optional, List, Tuple

try:
    import cbor2
    from cryptography import x509
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.backends import default_backend
    from cryptography.x509.oid import ObjectIdentifier
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install cryptography cbor2")
    exit(1)

# Apple App Attest Root CA
APPLE_ROOT_CA_PEM = b"""-----BEGIN CERTIFICATE-----
MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYw
JAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwK
QXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNa
Fw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlv
biBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9y
bmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdh
NbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9au
Yen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/
MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYw
CgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn
53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijV
oyFraWVIyd/dganmrduC1bmTBGwD
-----END CERTIFICATE-----"""

APPLE_NONCE_OID = ObjectIdentifier("1.2.840.113635.100.8.2")


@dataclass
class VerificationResult:
    ok: bool
    public_key_uncompressed: Optional[bytes]  # 0x04 || X || Y (65 bytes)
    public_key_x: Optional[bytes]              # 32 bytes
    public_key_y: Optional[bytes]              # 32 bytes
    key_id: Optional[bytes]                    # SHA256(uncompressed) = 32 bytes
    key_id_b64: Optional[str]                  # base64 encoded key_id
    credential_id: Optional[bytes]             # from authData
    errors: List[str]
    
    def dump(self):
        print("\n" + "="*60)
        print("ATTESTATION VERIFICATION RESULT")
        print("="*60)
        print(f"✅ Valid: {self.ok}")
        
        if self.ok:
            print(f"\n🔑 Public Key (uncompressed, 65 bytes):")
            print(f"   {self.public_key_uncompressed.hex()}")
            print(f"\n🔑 Public Key X (32 bytes):")
            print(f"   {self.public_key_x.hex()}")
            print(f"\n🔑 Public Key Y (32 bytes):")
            print(f"   {self.public_key_y.hex()}")
            print(f"\n🆔 Key ID (SHA256 of uncompressed key):")
            print(f"   Hex: {self.key_id.hex()}")
            print(f"   B64: {self.key_id_b64}")
            print(f"\n📋 Credential ID from authData:")
            print(f"   Hex: {self.credential_id.hex()}")
            print(f"   B64: {base64.b64encode(self.credential_id).decode()}")
            
            # Verify credential_id == key_id
            if self.credential_id == self.key_id:
                print(f"\n✅ credentialId == keyId (correct)")
            else:
                print(f"\n⚠️  credentialId != keyId (mismatch)")
        
        if self.errors:
            print(f"\n❌ Errors:")
            for e in self.errors:
                print(f"   - {e}")
        print("="*60)


def extract_nonce_from_extension(payload: bytes) -> bytes:
    """Extract 32-byte nonce from Apple attestation extension."""
    def find_octet32(b: bytes, depth: int = 0) -> Optional[bytes]:
        if depth > 10 or len(b) < 2:
            return None
        i = 0
        while i < len(b):
            if i >= len(b):
                break
            tag = b[i]
            i += 1
            if i >= len(b):
                break
            length = b[i]
            i += 1
            if length & 0x80:
                n = length & 0x7F
                if i + n > len(b):
                    break
                length = int.from_bytes(b[i:i+n], 'big')
                i += n
            if i + length > len(b):
                break
            value = b[i:i+length]
            i += length
            # OCTET STRING with 32 bytes
            if tag == 0x04 and len(value) == 32:
                return value
            # Recurse into constructed types
            if tag & 0x20 or tag in (0x30, 0x31, 0x04):
                result = find_octet32(value, depth + 1)
                if result:
                    return result
        return None
    
    result = find_octet32(payload)
    if result is None:
        raise ValueError("Could not find 32-byte nonce in extension")
    return result


def verify_attestation(
    attestation_b64: str,
    challenge: bytes,
    team_id: str,
    bundle_id: str,
    env: str  # "dev" or "prod"
) -> VerificationResult:
    """
    Verify Apple App Attest attestation and extract public key.
    
    Returns VerificationResult with public key and keyId on success.
    """
    errors = []
    
    try:
        # 1. Decode attestation
        raw = base64.b64decode(attestation_b64)
        att = cbor2.loads(raw)
        
        fmt = att.get('fmt')
        if fmt != 'apple-appattest':
            errors.append(f"Invalid format: {fmt}")
            return VerificationResult(False, None, None, None, None, None, None, errors)
        
        att_stmt = att.get('attStmt', {})
        auth_data = att.get('authData')
        x5c = att_stmt.get('x5c', [])
        
        if len(x5c) < 2:
            errors.append("Certificate chain too short")
            return VerificationResult(False, None, None, None, None, None, None, errors)
        
        # 2. Parse authData
        rp_id_hash = auth_data[:32]
        flags = auth_data[32]
        sign_count = struct.unpack('>I', auth_data[33:37])[0]
        aaguid = auth_data[37:53]
        cred_id_len = struct.unpack('>H', auth_data[53:55])[0]
        credential_id = auth_data[55:55+cred_id_len]
        
        # 3. Verify rpIdHash
        expected_rp_hash = hashlib.sha256(f"{team_id}.{bundle_id}".encode()).digest()
        if rp_id_hash != expected_rp_hash:
            errors.append(f"rpIdHash mismatch")
        
        # 4. Verify flags (AT bit must be set)
        if not (flags & 0x40):
            errors.append("AT flag not set")
        
        # 5. Verify signCount == 0
        if sign_count != 0:
            errors.append(f"signCount should be 0, got {sign_count}")
        
        # 6. Verify aaguid
        expected_aaguid = b"appattestdevelop" if env == "dev" else b"appattest" + b"\x00" * 7
        if aaguid != expected_aaguid:
            errors.append(f"aaguid mismatch (expected {env})")
        
        # 7. Load and verify certificate chain
        leaf_cert = x509.load_der_x509_certificate(x5c[0], default_backend())
        intermediate = x509.load_der_x509_certificate(x5c[1], default_backend())
        root_ca = x509.load_pem_x509_certificate(APPLE_ROOT_CA_PEM, default_backend())
        
        # Verify signatures
        try:
            root_ca.public_key().verify(
                intermediate.signature,
                intermediate.tbs_certificate_bytes,
                ec.ECDSA(intermediate.signature_hash_algorithm)
            )
        except Exception as e:
            errors.append(f"Intermediate cert signature invalid: {e}")
        
        try:
            intermediate.public_key().verify(
                leaf_cert.signature,
                leaf_cert.tbs_certificate_bytes,
                ec.ECDSA(leaf_cert.signature_hash_algorithm)
            )
        except Exception as e:
            errors.append(f"Leaf cert signature invalid: {e}")
        
        # 8. Extract public key from leaf cert
        leaf_pk = leaf_cert.public_key()
        if not isinstance(leaf_pk, ec.EllipticCurvePublicKey):
            errors.append("Leaf cert public key is not EC")
            return VerificationResult(False, None, None, None, None, None, credential_id, errors)
        
        nums = leaf_pk.public_numbers()
        x_bytes = nums.x.to_bytes(32, 'big')
        y_bytes = nums.y.to_bytes(32, 'big')
        uncompressed = b'\x04' + x_bytes + y_bytes
        key_id = hashlib.sha256(uncompressed).digest()
        key_id_b64 = base64.b64encode(key_id).decode()
        
        # 9. Verify credentialId == SHA256(uncompressed public key)
        if credential_id != key_id:
            errors.append("credentialId != SHA256(publicKey)")
        
        # 10. Verify nonce
        try:
            ext = leaf_cert.extensions.get_extension_for_oid(APPLE_NONCE_OID)
            payload = ext.value.value if hasattr(ext.value, 'value') else bytes(ext.value)
            cert_nonce = extract_nonce_from_extension(payload)
            
            # Try both nonce computation methods:
            # Method 1: nonce = SHA256(authData || challenge)
            expected_nonce_1 = hashlib.sha256(auth_data + challenge).digest()
            # Method 2: nonce = SHA256(authData || SHA256(challenge))
            client_data_hash = hashlib.sha256(challenge).digest()
            expected_nonce_2 = hashlib.sha256(auth_data + client_data_hash).digest()
            
            if cert_nonce == expected_nonce_1:
                pass  # Method 1 matched
            elif cert_nonce == expected_nonce_2:
                pass  # Method 2 matched
            else:
                errors.append("Nonce mismatch")
                print(f"\n🔍 Debug - Nonce comparison:")
                print(f"   Cert nonce:     {cert_nonce.hex()}")
                print(f"   Expected (m1):  {expected_nonce_1.hex()}  # SHA256(authData || challenge)")
                print(f"   Expected (m2):  {expected_nonce_2.hex()}  # SHA256(authData || SHA256(challenge))")
                print(f"   Challenge:      {challenge}")
                print(f"   AuthData len:   {len(auth_data)}")
        except x509.ExtensionNotFound:
            errors.append("Nonce extension not found")
        except Exception as e:
            errors.append(f"Nonce verification error: {e}")
        
        ok = len(errors) == 0
        return VerificationResult(
            ok=ok,
            public_key_uncompressed=uncompressed,
            public_key_x=x_bytes,
            public_key_y=y_bytes,
            key_id=key_id,
            key_id_b64=key_id_b64,
            credential_id=credential_id,
            errors=errors
        )
        
    except Exception as e:
        errors.append(f"Parse error: {e}")
        return VerificationResult(False, None, None, None, None, None, None, errors)


def build_der_public_key(x: bytes, y: bytes) -> bytes:
    """Build DER-encoded SubjectPublicKeyInfo for EC P-256 public key."""
    # Uncompressed point: 0x04 || X || Y
    point = b'\x04' + x + y
    
    # EC public key DER structure:
    # SEQUENCE {
    #   SEQUENCE { OID(ecPublicKey), OID(prime256v1) }
    #   BIT STRING { uncompressed point }
    # }
    ec_public_key_oid = bytes.fromhex('2a8648ce3d0201')  # 1.2.840.10045.2.1
    prime256v1_oid = bytes.fromhex('2a8648ce3d030107')  # 1.2.840.10045.3.1.7
    
    def der_len(length: int) -> bytes:
        if length < 128:
            return bytes([length])
        elif length < 256:
            return bytes([0x81, length])
        else:
            return bytes([0x82, length >> 8, length & 0xff])
    
    # Algorithm identifier sequence
    algo_seq = b'\x30' + der_len(len(ec_public_key_oid) + len(prime256v1_oid) + 4)
    algo_seq += b'\x06' + der_len(len(ec_public_key_oid)) + ec_public_key_oid
    algo_seq += b'\x06' + der_len(len(prime256v1_oid)) + prime256v1_oid
    
    # Bit string (with 0 unused bits prefix)
    bit_string = b'\x03' + der_len(len(point) + 1) + b'\x00' + point
    
    # Outer sequence
    inner = algo_seq + bit_string
    der = b'\x30' + der_len(len(inner)) + inner
    
    return der


def save_public_key(result: VerificationResult, output_path: str):
    """Save public key to file in various formats."""
    if not result.ok or not result.public_key_uncompressed:
        print("Cannot save: verification failed")
        return
    
    # Build DER-encoded public key
    der_key = build_der_public_key(result.public_key_x, result.public_key_y)
    
    # Save as JSON with all formats (including DER)
    data = {
        "keyId": result.key_id_b64,
        "keyIdHex": result.key_id.hex(),
        "publicKey": {
            "uncompressed": result.public_key_uncompressed.hex(),
            "uncompressedB64": base64.b64encode(result.public_key_uncompressed).decode(),
            "der": der_key.hex(),
            "derB64": base64.b64encode(der_key).decode(),
            "x": result.public_key_x.hex(),
            "y": result.public_key_y.hex(),
            "xB64": base64.b64encode(result.public_key_x).decode(),
            "yB64": base64.b64encode(result.public_key_y).decode(),
        }
    }
    
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"\n💾 Public key saved to: {output_path}")
    
    # Also save DER file for direct use
    der_path = output_path.replace('.json', '.der')
    with open(der_path, 'wb') as f:
        f.write(der_key)
    print(f"💾 DER public key saved to: {der_path}")


def main():
    parser = argparse.ArgumentParser(description="Verify Apple App Attest attestation")
    parser.add_argument('--attestation', type=str, help='Attestation data (base64)')
    parser.add_argument('--challenge', type=str, help='Challenge (raw string or hex with 0x prefix)')
    parser.add_argument('--team-id', type=str, help='Team ID')
    parser.add_argument('--bundle-id', type=str, help='Bundle ID')
    parser.add_argument('--env', type=str, choices=['dev', 'prod'], default='dev', help='Environment')
    parser.add_argument('--file', type=str, help='JSON file with attestation data')
    parser.add_argument('--output', type=str, help='Output file for public key (JSON)')
    
    args = parser.parse_args()
    
    # Load from file if provided
    if args.file:
        with open(args.file, 'r') as f:
            data = json.load(f)
        attestation_b64 = data.get('attestation')
        challenge_str = data.get('challenge', '')
        team_id = data.get('teamId') or data.get('team_id')
        bundle_id = data.get('bundleId') or data.get('bundle_id')
        env = data.get('env', 'dev')
    else:
        attestation_b64 = args.attestation
        challenge_str = args.challenge or ''
        team_id = args.team_id
        bundle_id = args.bundle_id
        env = args.env
    
    if not attestation_b64:
        parser.print_help()
        print("\n❌ Error: --attestation or --file is required")
        return
    
    if not team_id or not bundle_id:
        parser.print_help()
        print("\n❌ Error: --team-id and --bundle-id are required")
        return
    
    # Parse challenge (supports: raw string, hex with 0x prefix, or base64)
    if challenge_str.startswith('0x'):
        # Hex format
        challenge = bytes.fromhex(challenge_str[2:])
    else:
        # Try base64 first (check if it looks like base64)
        try:
            # Base64 strings typically contain only A-Za-z0-9+/= and have specific length patterns
            decoded = base64.b64decode(challenge_str, validate=True)
            # If decoded successfully and looks like printable ASCII, it's likely base64-encoded
            if decoded.isascii():
                challenge = decoded
                print(f"ℹ️  Challenge decoded from base64: {decoded.decode('ascii')}")
            else:
                challenge = decoded
                print(f"ℹ️  Challenge decoded from base64 (binary): {len(decoded)} bytes")
        except Exception:
            # Not valid base64, use as raw string
            challenge = challenge_str.encode() if isinstance(challenge_str, str) else challenge_str
    
    # Verify
    result = verify_attestation(attestation_b64, challenge, team_id, bundle_id, env)
    result.dump()
    
    # Save if requested
    if args.output and result.ok:
        save_public_key(result, args.output)


if __name__ == '__main__':
    main()
