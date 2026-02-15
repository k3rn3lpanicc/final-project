// Chain configuration for admin dashboard
export interface ChainConfig {
	chainId: number;
	chainIdHex: string;
	name: string;
	rpcUrl: string;
	blockExplorer: string;
	contracts: {
		verifier: string;
		election: string;
	};
}

export const CHAINS: Record<string, ChainConfig> = {
	bscTestnet: {
		chainId: 97,
		chainIdHex: '0x61',
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
		chainIdHex: '0x50877c76',
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
		chainIdHex: '0x7a69',
		name: 'Hardhat Local',
		rpcUrl: 'http://127.0.0.1:8545',
		blockExplorer: 'http://localhost:8545',
		contracts: {
			verifier: '0xD8dc4B2a315012bCae0987f1758B7861BD266E78',
			election: '0x814E3417224f85C0c1508d17076447A1bC8a43b7',
		},
	},
};

// Default chain (can be changed via environment variable)
export const DEFAULT_CHAIN_KEY = (import.meta.env.VITE_DEFAULT_CHAIN as string) || 'skaleTestnet';

export function getChainConfig(chainKey?: string): ChainConfig {
	const key = chainKey || DEFAULT_CHAIN_KEY;
	const config = CHAINS[key];

	if (!config) {
		throw new Error(`Chain configuration not found for: ${key}`);
	}

	return config;
}

export function getChainByChainId(chainId: number): ChainConfig | undefined {
	return Object.values(CHAINS).find((chain) => chain.chainId === chainId);
}
