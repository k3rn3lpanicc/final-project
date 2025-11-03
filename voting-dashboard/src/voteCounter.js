import { ethers } from 'ethers';
import { buildBabyjub } from 'circomlibjs';

const BATCH_SIZE = 2; // Votes to process in each batch - VERY SMALL for testing real-time updates
const BLOCK_CHUNK_SIZE = 2000; // Maximum blocks to query per RPC request (adjust if needed)

/**
 * Derives an AES key from a shared secret point using SHA-256
 */
function deriveAESKey(sharedSecretX) {
  const sharedBytes = new Uint8Array(32);
  const hexStr = sharedSecretX.toString(16).padStart(64, '0');
  for (let i = 0; i < 32; i++) {
    sharedBytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
  }
  
  return crypto.subtle.digest('SHA-256', sharedBytes).then(hash => new Uint8Array(hash));
}

/**
 * Decrypts a vote encrypted with ECDH + AES-GCM
 */
async function decryptVote(encryptedData, privateKey, bjj) {
  // Remove 0x prefix if present
  const hexData = encryptedData.startsWith('0x') ? encryptedData.slice(2) : encryptedData;

  // Parse components: R_x (64) + R_y (64) + IV (24) + ciphertext+tag
  if (hexData.length < 152) {
    throw new Error(`Encrypted data too short: ${hexData.length} chars`);
  }

  const rx = BigInt('0x' + hexData.slice(0, 64));
  const ry = BigInt('0x' + hexData.slice(64, 128));
  const ivHex = hexData.slice(128, 152);
  const ciphertextHex = hexData.slice(152);

  // Debug logging
  console.log('Decryption attempt:', {
    dataLength: hexData.length,
    ivLength: ivHex.length,
    ciphertextLength: ciphertextHex.length,
    rx: rx.toString(16).substring(0, 10) + '...',
    ry: ry.toString(16).substring(0, 10) + '...',
  });

  // Convert R to curve point
  const R = [bjj.F.e(rx), bjj.F.e(ry)];

  // Compute shared secret: S = privKey * R
  const S = bjj.mulPointEscalar(R, privateKey);
  const sharedSecretX = BigInt(bjj.F.toObject(S[0]));

  console.log('Shared secret computed:', sharedSecretX.toString(16).substring(0, 10) + '...');

  // Derive AES key from shared secret
  const aesKey = await deriveAESKey(sharedSecretX);

  console.log('AES key derived, length:', aesKey.length);

  // Convert IV and ciphertext from hex to Uint8Array
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const ciphertextWithTag = new Uint8Array(ciphertextHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

  console.log('IV length:', iv.length, 'Ciphertext+Tag length:', ciphertextWithTag.length);

  // Import key for Web Crypto API
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    aesKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  console.log('Crypto key imported');

  try {
    // Decrypt using AES-GCM
    // Web Crypto API expects ciphertext with auth tag appended (last 16 bytes = 128 bits)
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // Auth tag is 128 bits (16 bytes)
      },
      cryptoKey,
      ciphertextWithTag
    );

    console.log('Decryption successful');

    // Convert to string
    const decoder = new TextDecoder();
    const plaintextStr = decoder.decode(plaintext);

    console.log('Plaintext:', plaintextStr);

    // Parse plaintext: "optionIndex|nonce"
    const parts = plaintextStr.split('|');
    if (parts.length !== 2) {
      throw new Error(`Invalid plaintext format: "${plaintextStr}"`);
    }

    const optionIndex = parseInt(parts[0], 10);
    const nonce = parts[1];

    if (isNaN(optionIndex)) {
      throw new Error(`Invalid optionIndex: "${parts[0]}"`);
    }

    return {
      optionIndex,
      nonce,
      plaintext: plaintextStr,
    };
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Process votes in batches
 */
async function processBatch(events, offset, privateKey, bjj, onProgress) {
  const results = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const voteNumber = offset + i + 1;

    try {
      const decrypted = await decryptVote(event.args.encryptedVote, privateKey, bjj);

      results.push({
        success: true,
        voteNumber,
        optionIndex: decrypted.optionIndex,
        nonce: decrypted.nonce,
        voterAddress: event.args.sender,
        transactionHash: event.transactionHash,
      });
    } catch (error) {
      results.push({
        success: false,
        voteNumber,
        error: error.message,
        voterAddress: event.args.sender,
        transactionHash: event.transactionHash,
      });
    }

    if (onProgress) {
      onProgress(voteNumber);
    }
    
    // Yield every 10 votes to allow UI updates
    if (i > 0 && i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return results;
}

/**
 * Get the deployment block of a contract
 * Uses a simple heuristic: start from recent blocks (last 50k) unless RPC supports historical queries
 */
async function getContractDeploymentBlock(contractAddress, provider, onLog) {
  try {
    onLog('Checking contract deployment...', 'info');
    
    // Verify contract exists
    const code = await provider.getCode(contractAddress);
    if (code === '0x') {
      throw new Error('No contract found at this address');
    }
    
    const currentBlock = await provider.getBlockNumber();
    
    // Strategy: Check if contract existed 50k blocks ago (with timeout)
    const blockToCheck = Math.max(0, currentBlock - 50000);
    
    try {
      const codeAtOldBlock = await Promise.race([
        provider.getCode(contractAddress, blockToCheck),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      
      if (codeAtOldBlock === '0x') {
        // Contract deployed in last 50k blocks
        onLog(`Contract deployed recently (within last 50k blocks)`, 'success');
        onLog(`Starting scan from block ${blockToCheck}`, 'info');
        return blockToCheck;
      } else {
        // Contract is older
        onLog('Contract is older than 50k blocks', 'info');
        onLog('Starting scan from block 0', 'info');
        return 0;
      }
    } catch (err) {
      // Historical queries not supported or timeout
      onLog('Historical state queries not supported by this RPC', 'warning');
      onLog('Starting scan from block 0 (safe fallback)', 'info');
      return 0;
    }
    
  } catch (error) {
    onLog(`Error checking deployment: ${error.message}`, 'warning');
    onLog('Starting from block 0...', 'info');
    return 0;
  }
}

/**
 * Fetch events in chunks to avoid RPC limits
 */
async function fetchEventsInChunks(contract, filter, provider, startBlock, onLog, onFetchProgress) {
  const currentBlock = await provider.getBlockNumber();
  const events = [];
  
  console.log('📦 fetchEventsInChunks called - blocks:', startBlock, 'to', currentBlock);
  onLog(`Current block: ${currentBlock}`, 'info');
  onLog(`Scanning from block ${startBlock} to ${currentBlock}`, 'info');
  
  const totalBlocks = currentBlock - startBlock;
  let scannedBlocks = 0;
  
  let fromBlock = startBlock;
  let chunkCount = 0;
  
  while (fromBlock <= currentBlock) {
    const toBlock = Math.min(fromBlock + BLOCK_CHUNK_SIZE - 1, currentBlock);
    chunkCount++;
    
    console.log(`📥 Fetching chunk ${chunkCount}: blocks ${fromBlock}-${toBlock}`);
    onLog(`Fetching events from block ${fromBlock} to ${toBlock} (chunk ${chunkCount})...`, 'info');
    
    try {
      const chunkEvents = await contract.queryFilter(filter, fromBlock, toBlock);
      events.push(...chunkEvents);
      
      console.log(`✅ Chunk ${chunkCount} fetched: ${chunkEvents.length} events`);
      if (chunkEvents.length > 0) {
        onLog(`Found ${chunkEvents.length} vote(s) in this chunk`, 'success');
      }
    } catch (error) {
      console.error(`❌ Error fetching chunk ${chunkCount}:`, error);
      onLog(`Warning: Error fetching chunk ${chunkCount}: ${error.message}`, 'warning');
      // Continue with next chunk
    }
    
    scannedBlocks += (toBlock - fromBlock + 1);
    
    // Call progress callback to update UI
    if (onFetchProgress) {
      const progress = (scannedBlocks / totalBlocks) * 100;
      onFetchProgress({
        chunkCount,
        scannedBlocks,
        totalBlocks,
        progress,
        eventsFound: events.length
      });
    }
    
    fromBlock = toBlock + 1;
    
    // Yield after each chunk to allow UI updates - LONGER DELAY
    console.log('⏸️ Yielding for UI update...');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('✅ All chunks fetched, total events:', events.length);
  return events;
}

/**
 * Count votes for an election
 */
export async function countVotes(contractAddress, electionId, privateKey, rpcUrl, manualStartBlock, callbacks) {
  const { onLog, onProgress, onComplete, onUpdate } = callbacks;

  console.log('🎬 countVotes function STARTED');
  console.log('📝 Parameters:', { contractAddress, electionId, rpcUrl, hasOnUpdate: !!onUpdate });

  try {
    console.log('1️⃣ About to connect to blockchain...');
    onLog('Connecting to blockchain...', 'info');
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    console.log('✅ Provider created');
    
    // Load contract ABI - use the correct VoteSubmitted event signature
    const electionABI = [
      "event VoteSubmitted(uint256 indexed electionId, uint256 indexed nullifierHash, bytes encryptedVote, address indexed sender)"
    ];

    console.log('2️⃣ Creating contract instance...');
    const contract = new ethers.Contract(contractAddress, electionABI, provider);
    console.log('✅ Contract created');

    onLog(`Connected to contract: ${contractAddress}`, 'success');
    
    console.log('3️⃣ Determining start block...');
    // Determine start block
    let startBlock;
    if (manualStartBlock !== undefined) {
      startBlock = manualStartBlock;
      onLog(`Using manual start block: ${startBlock}`, 'info');
    } else {
      // Auto-detect contract deployment block
      startBlock = await getContractDeploymentBlock(contractAddress, provider, onLog);
    }
    console.log('✅ Start block determined:', startBlock);
    
    console.log('4️⃣ Fetching votes...');
    onLog(`Fetching votes for election ID: ${electionId}`, 'info');

    // Query events in chunks to avoid RPC limits
    console.log('5️⃣ Querying events and processing in real-time...');
    const filter = contract.filters.VoteSubmitted(electionId);
    
    console.log('6️⃣ Initializing Baby Jubjub...');
    onLog('Initializing cryptographic library...', 'info');
    const bjj = await buildBabyjub();
    console.log('✅ Baby Jubjub initialized');

    // Convert private key to BigInt
    console.log('7️⃣ Converting private key...');
    const privKeyBigInt = BigInt(privateKey);
    console.log('✅ Private key converted');

    console.log('8️⃣ STARTING REAL-TIME PROCESSING');
    onLog('Starting vote decryption and counting...', 'info');
    const startTime = Date.now();

    const voteCounts = {};
    const validVotes = [];
    const invalidVotes = [];
    let processedCount = 0;
    let totalEvents = 0;

    // Fetch and process chunks in real-time
    const currentBlock = await provider.getBlockNumber();
    const totalBlocks = currentBlock - startBlock;
    let scannedBlocks = 0;
    let fromBlock = startBlock;
    let chunkCount = 0;
    
    onLog(`Current block: ${currentBlock}`, 'info');
    onLog(`Scanning from block ${startBlock} to ${currentBlock}`, 'info');
    
    while (fromBlock <= currentBlock) {
      const toBlock = Math.min(fromBlock + BLOCK_CHUNK_SIZE - 1, currentBlock);
      chunkCount++;
      
      console.log(`📥 Fetching chunk ${chunkCount}: blocks ${fromBlock}-${toBlock}`);
      onLog(`Fetching events from block ${fromBlock} to ${toBlock} (chunk ${chunkCount})...`, 'info');
      
      let chunkEvents = [];
      try {
        chunkEvents = await contract.queryFilter(filter, fromBlock, toBlock);
        console.log(`✅ Chunk ${chunkCount} fetched: ${chunkEvents.length} events`);
        if (chunkEvents.length > 0) {
          onLog(`Found ${chunkEvents.length} vote(s) in this chunk`, 'success');
        }
      } catch (error) {
        console.error(`❌ Error fetching chunk ${chunkCount}:`, error);
        onLog(`Warning: Error fetching chunk ${chunkCount}: ${error.message}`, 'warning');
      }
      
      // Process votes from this chunk immediately
      if (chunkEvents.length > 0) {
        console.log(`🔄 Processing ${chunkEvents.length} votes from chunk ${chunkCount}...`);
        
        for (const event of chunkEvents) {
          totalEvents++;
          const voteNumber = totalEvents;
          
          try {
            console.log(`💫 Processing vote ${voteNumber}...`);
            const decrypted = await decryptVote(event.args.encryptedVote, privKeyBigInt, bjj);
            
            validVotes.push({
              success: true,
              voteNumber,
              optionIndex: decrypted.optionIndex,
              nonce: decrypted.nonce,
              voterAddress: event.args.sender,
              transactionHash: event.transactionHash,
            });
            
            if (!voteCounts[decrypted.optionIndex]) {
              voteCounts[decrypted.optionIndex] = 0;
            }
            voteCounts[decrypted.optionIndex]++;
            
            console.log(`✅ Vote ${voteNumber} counted for option ${decrypted.optionIndex}`);
          } catch (error) {
            console.error(`❌ Vote ${voteNumber} decryption failed:`, error.message);
            invalidVotes.push({
              success: false,
              voteNumber,
              error: error.message,
              voterAddress: event.args.sender,
              transactionHash: event.transactionHash,
            });
          }
          
          processedCount++;
          
          // Yield every vote to allow UI updates
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Update results after processing this chunk
        const elapsed = (Date.now() - startTime) / 1000;
        const updateData = {
          voteCounts: { ...voteCounts },
          validVotes: validVotes.length,
          invalidVotes: invalidVotes.length,
          totalVotes: totalEvents,
          processed: processedCount,
          progress: (processedCount / Math.max(totalEvents, 1)) * 100,
          elapsed,
        };
        
        console.log('🔥 CHUNK PROCESSED:', {
          chunk: chunkCount,
          processed: processedCount,
          validVotes: validVotes.length,
          voteCounts: updateData.voteCounts
        });
        
        if (onUpdate) {
          console.log('📞 Calling onUpdate with data:', updateData);
          onUpdate(updateData);
        }
        
        // Longer delay to see updates
        console.log('⏱️ WAITING 500ms before next chunk...');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('⏱️ WAIT COMPLETE, continuing...');
      }
      
      scannedBlocks += (toBlock - fromBlock + 1);
      
      // Update progress bar based on block scanning progress
      if (onProgress) {
        const blockProgress = (scannedBlocks / totalBlocks) * 100;
        const elapsed = (Date.now() - startTime) / 1000;
        const blocksPerSec = scannedBlocks / elapsed;
        const remainingBlocks = totalBlocks - scannedBlocks;
        const eta = remainingBlocks / blocksPerSec;
        
        onProgress({
          processed: scannedBlocks,
          total: totalBlocks,
          progress: blockProgress,
          rate: blocksPerSec,
          elapsed,
          eta,
        });
      }
      
      fromBlock = toBlock + 1;
      
      // Small yield between chunks
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log('✅ All chunks fetched and processed, total events:', totalEvents);

    console.log('✅ All chunks fetched and processed, total events:', totalEvents);
    onLog(`Found ${totalEvents} vote(s) total`, 'success');

    if (totalEvents === 0) {
      console.log('⚠️ No votes found, returning early');
      onComplete({
        totalVotes: 0,
        validVotes: 0,
        invalidVotes: 0,
        voteCounts: {},
        detailedVotes: [],
        invalidVoteDetails: [],
        processingTime: 0,
      });
      return;
    }

    const totalTime = (Date.now() - startTime) / 1000;

    onLog(`Processing complete! Total time: ${totalTime.toFixed(2)}s`, 'success');
    onLog(`Valid votes: ${validVotes.length}`, 'success');
    onLog(`Invalid votes: ${invalidVotes.length}`, 'warning');

    const results = {
      contractAddress,
      electionId,
      timestamp: new Date().toISOString(),
      totalVotes: totalEvents,
      validVotes: validVotes.length,
      invalidVotes: invalidVotes.length,
      voteCounts,
      detailedVotes: validVotes,
      invalidVoteDetails: invalidVotes,
      processingTime: totalTime,
    };

    if (onComplete) {
      onComplete(results);
    }

    return results;
  } catch (error) {
    onLog(`Error: ${error.message}`, 'error');
    throw error;
  }
}
