import { ethers } from 'ethers';

export function formatAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatAmount(amount: string | bigint, decimals = 6): string {
  const value = typeof amount === 'string' ? amount : amount.toString();
  const formatted = ethers.formatUnits(value, decimals);
  return parseFloat(formatted).toFixed(2);
}

export function parseAmount(amount: string, decimals = 6): string {
  return ethers.parseUnits(amount, decimals).toString();
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US');
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('en-US');
}

export function timeUntilExpiry(expiresAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = expiresAt - now;

  if (secondsLeft <= 0) return 'Expired';

  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
