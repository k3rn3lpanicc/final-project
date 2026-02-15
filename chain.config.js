// Chain configuration for scripts (count_votes, decrypt_votes, etc.)
export const CHAINS = {
	bscTestnet: {
		chainId: 97,
		name: 'BSC Testnet',
		rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
		blockExplorer: 'https://testnet.bscscan.com',
		contracts: {
			verifier: '0xD8dc4B2a315012bCae0987f1758B7861BD266E78',
			election: '0x814E3417224f85C0c1508d17076447A1bC8a43b7',
		},
	},
	skaleTestnet: {
		chainId: 1351057110,
		name: 'SKALE Testnet',
		rpcUrl: 'https://mainnet.skalenodes.com/v1/honorable-steel-rasalhague',
		blockExplorer: 'https://honorable-steel-rasalhague.explorer.mainnet.skalenodes.com',
		contracts: {
			verifier: '0xD8dc4B2a315012bCae0987f1758B7861BD266E78',
			election: '0x814E3417224f85C0c1508d17076447A1bC8a43b7',
		},
	},
	hardhat: {
		chainId: 31337,
		name: 'Hardhat Local',
		rpcUrl: 'http://127.0.0.1:8545',
		blockExplorer: 'http://localhost:8545',
		contracts: {
			verifier: '0xD8dc4B2a315012bCae0987f1758B7861BD266E78',
			election: '0x814E3417224f85C0c1508d17076447A1bC8a43b7',
		},
	},
};

export function getChainConfig(chainKey = 'skaleTestnet') {
	const config = CHAINS[chainKey];
	if (!config) {
		throw new Error(`Chain configuration not found: ${chainKey}`);
	}
	return config;
}
