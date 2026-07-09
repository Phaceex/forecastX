import { AccountLayout } from '@solana/spl-token';
const buf = Buffer.alloc(165);
const decoded = AccountLayout.decode(buf);
console.log('Decoded keys:', Object.keys(decoded));
console.log('Decoded amount:', typeof decoded.amount, decoded.amount);
