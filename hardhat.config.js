import '@nomicfoundation/hardhat-ethers';

export default {
	solidity: {
		version: '0.8.20',
		settings: {
			optimizer: { enabled: true, runs: 200 },
		},
	},
	networks: {
		hardhat: {
			type: 'edr-simulated',
			chainId: 31337,
		},
	},
	paths: {
		sources: './contracts',
		tests: './test',
		cache: './cache',
		artifacts: './artifacts',
	},
};
