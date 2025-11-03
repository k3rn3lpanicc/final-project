import './style.css';
import { countVotes } from './voteCounter.js';

let isProcessing = false;
let currentResults = null;
let electionOptions = {}; // Store election options fetched from backend

// DOM Elements
const form = document.getElementById('counting-form');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const progressSection = document.getElementById('progress-section');
const resultsSection = document.getElementById('results-section');
const logContainer = document.getElementById('log-container');

// Progress elements
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const voteCount = document.getElementById('vote-count');
const processingRate = document.getElementById('processing-rate');
const elapsedTime = document.getElementById('elapsed-time');
const etaTime = document.getElementById('eta-time');

// Results elements
const totalVotesEl = document.getElementById('total-votes');
const validVotesEl = document.getElementById('valid-votes');
const invalidVotesEl = document.getElementById('invalid-votes');
const processingTimeEl = document.getElementById('processing-time');
const voteDistribution = document.getElementById('vote-distribution');
const invalidVotesSection = document.getElementById('invalid-votes-section');
const invalidVotesList = document.getElementById('invalid-votes-list');
const downloadBtn = document.getElementById('download-btn');

// Fetch election options from backend
async function fetchElectionOptions(electionId, backendUrl) {
  try {
    log(`Fetching election details for election ID ${electionId}...`, 'info');
    const response = await fetch(`${backendUrl}/elections`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch elections: ${response.statusText}`);
    }
    
    const elections = await response.json();
    const election = elections.find(e => e.id === parseInt(electionId));
    
    if (!election) {
      throw new Error(`Election with ID ${electionId} not found`);
    }
    
    if (!election.options || !Array.isArray(election.options)) {
      throw new Error('Election options not found or invalid');
    }
    
    // Create a mapping from index to option name
    const optionsMap = {};
    election.options.forEach((option, index) => {
      optionsMap[index] = option;
    });
    
    log(`✅ Election details loaded: ${election.name}`, 'success');
    log(`Options: ${election.options.join(', ')}`, 'info');
    
    return optionsMap;
  } catch (error) {
    log(`⚠️ Failed to fetch election options: ${error.message}`, 'error');
    log('Will display option indices instead of names', 'warning');
    return {};
  }
}

// Logger function
function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// Progress updater
function updateProgress(data) {
  console.log('📈 PROGRESS UPDATE:', data.processed, '/', data.total);
  
  const { processed, total, progress, rate, elapsed, eta } = data;
  
  // Force immediate DOM update
  requestAnimationFrame(() => {
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${progress.toFixed(1)}%`;
    voteCount.textContent = `Blocks: ${processed} / ${total}`;
    processingRate.textContent = `${rate.toFixed(0)} blocks/sec`;
    elapsedTime.textContent = `Elapsed: ${elapsed.toFixed(1)}s`;
    etaTime.textContent = `ETA: ${Math.ceil(eta)}s`;
    
    // Force reflow
    void progressFill.offsetHeight;
    
    console.log('✅ Progress UI updated');
  });
}

// Update results incrementally (called after each batch)
function updateResultsIncremental(data) {
  console.log('🎯 UI UPDATE FUNCTION CALLED:', {
    validVotes: data.validVotes,
    voteCounts: data.voteCounts
  });
  
  // Use double requestAnimationFrame to ensure repaint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Force show results section
      resultsSection.style.display = 'block';
      
      // Update summary stats
      totalVotesEl.textContent = data.totalVotes;
      validVotesEl.textContent = data.validVotes;
      invalidVotesEl.textContent = data.invalidVotes;
      processingTimeEl.textContent = `${data.elapsed.toFixed(2)}s`;
      
      console.log('📊 Stats updated, building vote distribution...');
      
      // Display vote distribution
      voteDistribution.innerHTML = '<h3 style="color: #2ecc71;">⚡ Vote Distribution (LIVE)</h3>';
      
      if (Object.keys(data.voteCounts).length > 0) {
        const sortedOptions = Object.keys(data.voteCounts)
          .map(Number)
          .sort((a, b) => a - b);
        
        for (const optionIndex of sortedOptions) {
          const count = data.voteCounts[optionIndex];
          const percentage = data.validVotes > 0 ? ((count / data.validVotes) * 100).toFixed(2) : 0;
          
          // Get option name from electionOptions or fallback to index
          const optionName = electionOptions[optionIndex] || `Option ${optionIndex}`;
          
          const optionDiv = document.createElement('div');
          optionDiv.className = 'vote-option';
          optionDiv.innerHTML = `
            <div class="vote-option-header">
              <span class="option-name">${optionName}</span>
              <span class="option-count">${count} votes (${percentage}%)</span>
            </div>
            <div class="vote-bar-container">
              <div class="vote-bar" style="width: ${percentage}%">${percentage}%</div>
            </div>
          `;
          voteDistribution.appendChild(optionDiv);
        }
        console.log('✅ Vote distribution rendered with', Object.keys(data.voteCounts).length, 'options');
      } else {
        voteDistribution.innerHTML += '<p>Processing votes...</p>';
      }
      
      // Force multiple reflows to ensure rendering
      void resultsSection.offsetHeight;
      void voteDistribution.offsetHeight;
      
      console.log('✨ UI update complete!');
    });
  });
}

// Display final results
function displayResults(results) {
  currentResults = results;
  
  // Update summary stats
  totalVotesEl.textContent = results.totalVotes;
  validVotesEl.textContent = results.validVotes;
  invalidVotesEl.textContent = results.invalidVotes;
  processingTimeEl.textContent = `${results.processingTime.toFixed(2)}s`;
  
  // Display vote distribution
  voteDistribution.innerHTML = '<h3>Vote Distribution</h3>';
  
  if (Object.keys(results.voteCounts).length > 0) {
    const sortedOptions = Object.keys(results.voteCounts)
      .map(Number)
      .sort((a, b) => a - b);
    
    for (const optionIndex of sortedOptions) {
      const count = results.voteCounts[optionIndex];
      const percentage = ((count / results.validVotes) * 100).toFixed(2);
      
      // Get option name from electionOptions or fallback to index
      const optionName = electionOptions[optionIndex] || `Option ${optionIndex}`;
      
      const optionDiv = document.createElement('div');
      optionDiv.className = 'vote-option';
      optionDiv.innerHTML = `
        <div class="vote-option-header">
          <span class="option-name">${optionName}</span>
          <span class="option-count">${count} votes (${percentage}%)</span>
        </div>
        <div class="vote-bar-container">
          <div class="vote-bar" style="width: ${percentage}%">${percentage}%</div>
        </div>
      `;
      voteDistribution.appendChild(optionDiv);
    }
  } else {
    voteDistribution.innerHTML += '<p>No valid votes found.</p>';
  }
  
  // Display invalid votes if any
  if (results.invalidVotes > 0) {
    invalidVotesSection.style.display = 'block';
    invalidVotesList.innerHTML = '';
    
    results.invalidVoteDetails.forEach((vote) => {
      const voteDiv = document.createElement('div');
      voteDiv.className = 'invalid-vote-item';
      voteDiv.innerHTML = `
        <strong>Vote #${vote.voteNumber}</strong><br>
        Voter: ${vote.voterAddress}<br>
        TX: ${vote.transactionHash}<br>
        Error: ${vote.error}
      `;
      invalidVotesList.appendChild(voteDiv);
    });
  }
  
  resultsSection.style.display = 'block';
}

// Download results as JSON
downloadBtn.addEventListener('click', () => {
  if (!currentResults) return;
  
  const dataStr = JSON.stringify(currentResults, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vote_results_${currentResults.electionId}_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  
  log('Results downloaded successfully', 'success');
});

// Handle form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (isProcessing) return;
  
  const contractAddress = document.getElementById('contract-address').value.trim();
  const electionId = document.getElementById('election-id').value.trim();
  const privateKey = document.getElementById('private-key').value.trim();
  const rpcUrl = document.getElementById('rpc-url').value.trim();
  const backendUrl = document.getElementById('backend-url').value.trim();
  const startBlockInput = document.getElementById('start-block').value.trim();
  
  // Parse start block (undefined if not provided, will auto-detect)
  const manualStartBlock = startBlockInput ? parseInt(startBlockInput, 10) : undefined;
  
  // Validate inputs
  if (!contractAddress || !electionId || !privateKey || !rpcUrl || !backendUrl) {
    log('Please fill in all required fields', 'error');
    return;
  }
  
  // Reset UI
  logContainer.innerHTML = '';
  progressSection.style.display = 'block';
  resultsSection.style.display = 'none';
  progressFill.style.width = '0%';
  progressText.textContent = '0%';
  
  // Disable form
  isProcessing = true;
  startBtn.disabled = true;
  stopBtn.style.display = 'inline-block';
  document.querySelectorAll('input').forEach(input => input.disabled = true);
  
  log('Starting vote counting process...', 'info');
  if (manualStartBlock !== undefined) {
    log(`Using manual start block: ${manualStartBlock}`, 'info');
  }
  
  try {
    // Fetch election options first
    electionOptions = await fetchElectionOptions(electionId, backendUrl);
    
    await countVotes(contractAddress, electionId, privateKey, rpcUrl, manualStartBlock, {
      onLog: log,
      onProgress: updateProgress,
      onUpdate: updateResultsIncremental,
      onComplete: displayResults,
    });
  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
  } finally {
    isProcessing = false;
    startBtn.disabled = false;
    stopBtn.style.display = 'none';
    document.querySelectorAll('input').forEach(input => input.disabled = false);
  }
});

// Stop button (just resets the UI)
stopBtn.addEventListener('click', () => {
  location.reload();
});

// Initial log
log('Voting Results Dashboard initialized', 'success');
log('Enter election details to start counting votes', 'info');

