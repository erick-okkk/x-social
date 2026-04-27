export const ZKVerifyRegistryABI = [
  {
    inputs: [
      { name: 'commitment', type: 'bytes32' },
      { name: 'tagType', type: 'string' },
    ],
    name: 'issueTag',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'commitment', type: 'bytes32' },
      { name: 'tagType', type: 'string' },
    ],
    name: 'hasValidTag',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    name: 'getUserTags',
    outputs: [
      {
        components: [
          { name: 'tagType', type: 'string' },
          { name: 'verified', type: 'bool' },
          { name: 'issuedAt', type: 'uint256' },
          { name: 'expiresAt', type: 'uint256' },
        ],
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

export const PrivacyEscrowABI = [
  {
    inputs: [
      { name: 'recipientCommitment', type: 'bytes32' },
      { name: 'ruleSetId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'createDeposit',
    outputs: [{ name: 'depositId', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recipientCommitment', type: 'bytes32' },
      { name: 'ruleSetId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    name: 'depositViaPermit',
    outputs: [{ name: 'depositId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'depositId', type: 'uint256' }],
    name: 'releaseDeposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'depositId', type: 'uint256' }],
    name: 'refundDeposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'ruleType', type: 'string' },
      { name: 'required', type: 'bool' },
      { name: 'bonus', type: 'bool' },
      { name: 'minValue', type: 'uint256' },
      { name: 'description', type: 'string' },
    ],
    name: 'createRule',
    outputs: [{ name: 'ruleId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'ruleIds', type: 'uint256[]' },
      { name: 'gateFee', type: 'uint256' },
      { name: 'minRepScore', type: 'uint256' },
      { name: 'discountThreshold', type: 'uint256' },
      { name: 'discountPercent', type: 'uint256' },
    ],
    name: 'createRuleSet',
    outputs: [{ name: 'ruleSetId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'depositId', type: 'uint256' }],
    name: 'getDeposit',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'depositer', type: 'bytes32' },
          { name: 'recipient', type: 'bytes32' },
          { name: 'amount', type: 'uint256' },
          { name: 'ruleSetId', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'expiresAt', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'ruleSetId', type: 'uint256' }],
    name: 'getRuleSet',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'ruleIds', type: 'uint256[]' },
          { name: 'gateFee', type: 'uint256' },
          { name: 'minRepScore', type: 'uint256' },
          { name: 'discountThreshold', type: 'uint256' },
          { name: 'discountPercent', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'ruleId', type: 'uint256' }],
    name: 'getRule',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'ruleType', type: 'string' },
          { name: 'required', type: 'bool' },
          { name: 'bonus', type: 'bool' },
          { name: 'minValue', type: 'uint256' },
          { name: 'description', type: 'string' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'commitment', type: 'bytes32' },
      { name: 'ruleSetId', type: 'uint256' },
    ],
    name: 'previewDepositAmount',
    outputs: [{ name: 'finalAmount', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

export const AnonymousContentAccessABI = [
  {
    inputs: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'accessLevel', type: 'uint8' },
    ],
    name: 'publishContent',
    outputs: [{ name: 'contentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contentId', type: 'uint256' },
      { name: 'proof', type: 'bytes' },
    ],
    name: 'accessContent',
    outputs: [{ name: 'content', type: 'bytes' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'commitment', type: 'bytes32' },
      { name: 'contentId', type: 'uint256' },
    ],
    name: 'verifyAccess',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'contentId', type: 'uint256' }],
    name: 'getContent',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'publisherCommitment', type: 'bytes32' },
          { name: 'contentHash', type: 'bytes32' },
          { name: 'accessLevel', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

export const AgentRegistry8004ABI = [
  {
    inputs: [
      { name: 'agentName', type: 'string' },
      { name: 'agentUrl', type: 'string' },
    ],
    name: 'registerAgent',
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'rating', type: 'uint8' },
    ],
    name: 'rateAgent',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recipientId', type: 'bytes32' },
      { name: 'score', type: 'int256' },
      { name: 'reason', type: 'string' },
    ],
    name: 'submitP2PFeedback',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    name: 'getP2PScore',
    outputs: [{ name: 'score', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
];
