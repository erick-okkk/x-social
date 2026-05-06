const express = require('express');
const cors = require('cors');
const { execSync, spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const CONTRACT_DIR = process.env.RAILGUN_CONTRACT_DIR
  || path.join(__dirname, '../railgun/xlayer-toolkit/railgun/contract');
const NVM_INIT = `export NVM_DIR="$HOME/.nvm" && [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm use 20 > /dev/null 2>&1`;

// 网络模式：local（默认）或 testnet
const NETWORK = process.env.RAILGUN_NETWORK || 'local';
const IS_TESTNET = NETWORK === 'testnet';
const HARDHAT_NETWORK = IS_TESTNET ? 'xlayer-testnet' : 'localhost';

const TESTNET_RPC = 'https://testrpc.xlayer.tech';
const EXPLORER_URL = 'https://www.oklink.com/xlayer-test/tx';

function run(cmd, timeout = 60000) {
  return execSync(
    `${NVM_INIT} && cd '${CONTRACT_DIR}' && ${cmd}`,
    { encoding: 'utf8', shell: '/bin/bash', timeout, stdio: ['pipe', 'pipe', 'pipe'] }
  );
}

function resetNode() {
  if (IS_TESTNET) return; // testnet 不需要重置本地节点
  console.log('[railgun] Stopping existing Hardhat node...');
  try { execSync(`lsof -ti :8545 | xargs kill -9`, { shell: '/bin/bash' }); } catch {}
  execSync('sleep 1', { shell: '/bin/bash' });
  console.log('[railgun] Starting fresh Hardhat node...');
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
    const rpc = IS_TESTNET ? TESTNET_RPC : 'http://localhost:8545';
    const result = execSync(
      `curl -s -X POST ${rpc} -H 'Content-Type: application/json' \
       -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const parsed = JSON.parse(result);
    res.json({
      ok: true,
      network: NETWORK,
      blockNumber: parseInt(parsed.result, 16),
      explorer: IS_TESTNET ? EXPLORER_URL : null,
    });
  } catch {
    res.status(503).json({ ok: false, error: `${NETWORK} node not reachable` });
  }
});

// 完整隐私支付流程
app.post('/api/privacy-pay', (req, res) => {
  try {
    resetNode(); // testnet 时跳过

    console.log(`[railgun] Running demo on ${HARDHAT_NETWORK}...`);
    const output = run(
      `npx hardhat run scripts/demo.ts --network ${HARDHAT_NETWORK}`,
      IS_TESTNET ? 300000 : 60000  // testnet 给 5 分钟（网络延迟 + SNARK proof）
    );
    console.log('[railgun] Done.');

    const shieldTx   = output.match(/Shield transaction hash: (0x[a-f0-9]+)/)?.[1];
    const transferTx = output.match(/Transfer transaction hash: (0x[a-f0-9]+)/)?.[1];
    const unshieldTx = output.match(/Unshield transaction hash: (0x[a-f0-9]+)/)?.[1];

    if (!shieldTx || !transferTx || !unshieldTx) {
      console.error('[railgun] Output:\n', output);
      return res.status(500).json({ ok: false, error: 'Could not parse tx hashes', output });
    }

    const explorerBase = IS_TESTNET ? EXPLORER_URL : null;
    res.json({
      ok: true,
      network: NETWORK,
      explorer: explorerBase,
      txs: {
        shield:   shieldTx,
        transfer: transferTx,
        unshield: unshieldTx,
        shieldUrl:   explorerBase ? `${explorerBase}/${shieldTx}`   : null,
        transferUrl: explorerBase ? `${explorerBase}/${transferTx}` : null,
        unshieldUrl: explorerBase ? `${explorerBase}/${unshieldTx}` : null,
      }
    });
  } catch (err) {
    console.error('[railgun] Error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Railgun proxy running on http://localhost:${PORT} [${NETWORK}]`);
});
