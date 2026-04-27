import { ethers } from 'ethers';

export function generateCommitment(address: string, salt: string = ''): string {
  const combinedData = ethers.solidityPacked(
    ['address', 'string'],
    [address, salt]
  );

  const hash = ethers.keccak256(combinedData);
  return hash;
}

export function generateCommitmentFromData(data: Record<string, string>): string {
  const jsonString = JSON.stringify(data);
  const encoded = ethers.toUtf8Bytes(jsonString);
  return ethers.keccak256(encoded);
}
