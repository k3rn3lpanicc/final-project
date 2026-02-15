# Multi-Chain Configuration Guide

This voting system supports deployment across multiple EVM-compatible blockchains. This guide explains how to configure and use different networks.

## Supported Networks

The system currently supports:

1. **BSC Testnet** - Binance Smart Chain Testnet
2. **SKALE Testnet** - SKALE Network Testnet  
3. **Hardhat Local** - Local development network

## Configuration

### Frontend (Voter Dashboard)

Chain configuration is located in `frontend/src/config/chains.ts`.

To change the default chain, create a `.env` file:

```bash
VITE_DEFAULT_CHAIN=skaleTestnet  # Options: bscTestnet, skaleTestnet, hardhat
VITE_API_URL=http://localhost:3000
```

Users can switch networks in the UI using the network selector dropdown.

### Backend

Chain configuration is in `backend/src/config/chains.config.ts`.

Add to `.env`:

```bash
DEFAULT_CHAIN=skaleTestnet
```

### Admin Dashboard

Chain configuration is in `admin-dashboard/src/config/chains.ts`.

Add to `.env`:

```bash
VITE_DEFAULT_CHAIN=skaleTestnet
```

### Scripts

Scripts like `count_votes.js` now accept a chain parameter:

```bash
# Count votes on SKALE testnet
node count_votes.js 1 skaleTestnet

# Count votes on Hardhat local node
node count_votes.js 1 hardhat

# Count votes on BSC testnet
node count_votes.js 1 bscTestnet
```

## Adding a New Network

To add support for a new EVM chain:

1. **Update `chains.ts` files** in frontend, backend, and admin-dashboard:

```typescript
mynewchain: {
    chainId: 1234,
    chainIdHex: '0x4d2',
    name: 'My New Chain',
    rpcUrl: 'https://rpc.mynewchain.com',
    blockExplorer: 'https://explorer.mynewchain.com',
    nativeCurrency: {
        name: 'TOKEN',
        symbol: 'TKN',
        decimals: 18,
    },
    contracts: {
        verifier: '0x...', // Deploy and add address
        election: '0x...', // Deploy and add address
    },
}
```

2. **Deploy contracts** to the new chain:

```bash
npx hardhat run scripts/deploy.js --network mynewchain
```

3. **Update contract addresses** in the chain configuration

4. **Test the setup**

## MetaMask Integration

The frontend now uses MetaMask for all blockchain interactions:

- **No private keys** are stored in the frontend
- Users connect their MetaMask wallet
- The system automatically requests network switching
- If the network isn't in MetaMask, it will be added automatically

### Connecting Wallet

1. Click "Connect Wallet" button
2. Approve the connection in MetaMask
3. If on wrong network, approve the network switch
4. Start voting!

## Contract Deployment

When deploying to a new network, deploy both contracts:

### 1. VoteSchemeVerifier.sol

```bash
npx hardhat run scripts/deploy-verifier.js --network <network-name>
```

### 2. Election.sol

```bash
npx hardhat run scripts/deploy-election.js --network <network-name>
```

Update the contract addresses in all `chains.ts` files.

## Environment Variables Summary

### Frontend `.env`
```bash
VITE_DEFAULT_CHAIN=skaleTestnet
VITE_API_URL=http://localhost:3000
```

### Backend `.env`
```bash
DEFAULT_CHAIN=skaleTestnet
DATABASE_PATH=./database.sqlite
ADMIN_PRIVATE_KEY=your_private_key_here
JWT_SECRET=your_jwt_secret_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_password_here
```

### Admin Dashboard `.env`
```bash
VITE_DEFAULT_CHAIN=skaleTestnet
VITE_API_URL=http://localhost:3000
```

## Security Considerations

1. **Never commit private keys** to version control
2. **Use environment variables** for all sensitive data
3. **Verify contract addresses** before deployment
4. **Test on testnets** before mainnet deployment
5. **Audit smart contracts** before production use

## Troubleshooting

### "Network not supported" error

- Check that the chain ID matches in the configuration
- Verify the RPC URL is accessible
- Ensure contracts are deployed on that network

### "MetaMask not installed"

- Install MetaMask browser extension
- Refresh the page after installation

### Transaction failures

- Check wallet has enough native tokens for gas
- Verify contract addresses are correct
- Check network is not congested

## Gas Fees

Different networks have different gas costs:

- **BSC Testnet**: Free testnet BNB from faucet
- **SKALE Testnet**: Free sFUEL (zero gas fees)
- **Hardhat Local**: Free for testing

## Further Resources

- [MetaMask Documentation](https://docs.metamask.io/)
- [EVM Chain List](https://chainlist.org/)
- [Hardhat Network](https://hardhat.org/hardhat-network/)
