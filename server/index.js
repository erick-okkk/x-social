const express = require('express');
const cors = require('cors');
const { execSync, spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const CONTRACT_DIR = path.join(__dirname, '../railgun/contract');
const NVM_INIT = `export NVM_DIR="$HOME/.nvm" && [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm use 20 > /dev/null 2>&1`;

function run(cmd, timeout = 60000) {
  return execSync(
    `${NVM_INIT} && cd '${CONTRACT_DIR}' && ${cmd}`,
    { encoding: 'utf8', shell: '/bin/bash', timeout, stdio: ['pipe', 'pipe', 'pipe'] }
  );
}

function resetNode() {
  console.log('[railgun] Stopping existing Hardhat node...');
  try { execSync(`lsof -ti :8545 | xargs kill -9`, { shell: '/bin/bash' }); } catch {}
  execSync('sleep 1', { shell: '/bin/bash' });
  console.log('[railgun] Starting fresh Hardhat node...');
  // 用 spawn detached 启动节点
  const nodeProc = spawn('/bin/bash', ['-c',
    `${NVM_INIT} && cd '${CONTRACT_DIR}' && npx hardhat node`
  ], { detached: true, stdio: 'ignore' });
  nodeProc.unref();
  execSync('sleep 4', { shell: '/bin/bash' });
  console.log('[railgun] Deploying contracts...');
  run('npx hardhat deploy:test --network localhost', 30000);
  console.log('[railgun] Node ready.');
}

// 健康检查
app.get('/api/health', (req, res) => {
  try {
    const result = execSync(
      `curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
       -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`,
      { encoding: 'utf8', timeout: 3000 }
    );
    const parsed = JSON.parse(result);
    res.json({ ok: true, blockNumber: parseInt(parsed.result, 16) });
  } catch {
    res.status(503).json({ ok: false, error: 'Hardhat node not running' });
  }
});

// 完整隐私支付流程
app.post('/api/privacy-pay', (req, res) => {
  try {
    // 重置到干净状态，避免 merkle tree 状态污染
    resetNode();

    console.log('[railgun] Running demo script...');
    const output = run('npx hardhat run scripts/demo.ts --network localhost', 60000);
    console.log('[railgun] Done.');

    const shieldTx   = output.match(/Shield transaction hash: (0x[a-f0-9]+)/)?.[1];
    const transferTx = output.match(/Transfer transaction hash: (0x[a-f0-9]+)/)?.[1];
    const unshieldTx = output.match(/Unshield transaction hash: (0x[a-f0-9]+)/)?.[1];

    if (!shieldTx || !transferTx || !unshieldTx) {
      console.error('[railgun] Output:\n', output);
      return res.status(500).json({ ok: false, error: 'Could not parse tx hashes', output });
    }

    res.json({ ok: true, txs: { shield: shieldTx, transfer: transferTx, unshield: unshieldTx } });
  } catch (err) {
    console.error('[railgun] Error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Railgun proxy running on http://localhost:${PORT}`);
});
