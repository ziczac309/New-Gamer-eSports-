// js/app.js
let currentUser = null;
let currentTournaments = {};
let selectedTournamentId = null;

// Tab Navigation
function switchTab(tabId) {
  ['home', 'play', 'wallet', 'profile'].forEach(tab => {
    document.getElementById(`view-${tab}`).classList.add('hidden');
    document.getElementById(`nav-${tab}`).classList.remove('text-primary');
    document.getElementById(`nav-${tab}`).classList.add('text-gray-400');
  });
  document.getElementById(`view-${tabId}`).classList.remove('hidden');
  document.getElementById(`nav-${tabId}`).classList.add('text-primary');
  document.getElementById(`nav-${tabId}`).classList.remove('text-gray-400');
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// Auth Listener
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    initUserData(user.uid);
    checkUserRoles(user.uid);
  } else {
    // Prompt login or anonymous testing login
    auth.signInAnonymously().catch(err => console.error("Auth error:", err));
  }
});

function initUserData(uid) {
  // Sync Wallet Balance Realtime
  db.ref(`wallets/${uid}`).on('value', snap => {
    const data = snap.val() || { balance: 0 };
    const formatted = `₹${parseFloat(data.balance).toFixed(2)}`;
    document.getElementById('header-wallet-balance').innerText = formatted;
    document.getElementById('wallet-balance-main').innerText = formatted;
  });

  // Sync Profile
  db.ref(`users/${uid}`).on('value', snap => {
    const data = snap.val() || {};
    document.getElementById('profile-username').innerText = data.username || 'Gamer FF';
    document.getElementById('profile-email').innerText = data.email || currentUser.email || 'Free Fire Player';
  });

  // Sync User Transactions
  db.ref(`transactions/${uid}`).limitToLast(10).on('value', snap => {
    const container = document.getElementById('transactions-list');
    if (!snap.exists()) {
      container.innerHTML = `<p class="text-center text-xs text-gray-500 py-4">No transactions found.</p>`;
      return;
    }
    let html = '';
    snap.forEach(child => {
      const tx = child.val();
      const isCredit = tx.type === 'deposit' || tx.type === 'winning' || tx.type === 'reward';
      html = `
        <div class="bg-cardBg p-3 rounded-xl border border-cardBorder flex justify-between items-center text-xs">
          <div>
            <p class="font-bold text-white capitalize">${tx.type.replace('_', ' ')}</p>
            <p class="text-[10px] text-gray-400">${new Date(tx.timestamp).toLocaleString()}</p>
          </div>
          <span class="font-bold ${isCredit ? 'text-accent' : 'text-primary'}">
            ${isCredit ? '+' : '-'}₹${tx.amount}
          </span>
        </div>
      ` + html;
    });
    container.innerHTML = html;
  });

  loadTournaments();
}

// Role Check for Admin/Staff portal links
function checkUserRoles(uid) {
  db.ref(`staff/${uid}`).once('value', snap => {
    if (snap.exists()) {
      const role = snap.val().role;
      if (role === 'admin') {
        document.getElementById('admin-panel-link')?.classList.remove('hidden');
        document.getElementById('staff-panel-link')?.classList.remove('hidden');
      } else if (role === 'staff') {
        document.getElementById('staff-panel-link')?.classList.remove('hidden');
      }
    }
  });
}

// Realtime Tournaments Listener
function loadTournaments() {
  db.ref('tournaments').on('value', snap => {
    currentTournaments = snap.val() || {};
    renderTournaments(currentTournaments);
  });
}

function renderTournaments(tournaments) {
  const homeList = document.getElementById('home-tournaments-list');
  const playList = document.getElementById('play-tournaments-list');
  const featuredContainer = document.getElementById('featured-tournament-container');
  
  homeList.innerHTML = '';
  playList.innerHTML = '';

  const entries = Object.entries(tournaments);
  if (entries.length === 0) {
    homeList.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">No active tournaments available.</p>`;
    return;
  }

  entries.forEach(([id, t], index) => {
    const joined = t.joinedCount || 0;
    const max = t.maxPlayers || 48;
    const cardHtml = `
      <div onclick="openTournamentDetail('${id}')" class="bg-cardBg border border-cardBorder p-3.5 rounded-2xl cursor-pointer hover:border-primary/40 transition">
        <div class="flex gap-3">
          <img src="${t.banner || 'https://via.placeholder.com/100'}" class="w-20 h-20 rounded-xl object-cover" />
          <div class="flex-1 flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-start">
                <h4 class="font-rajdhani font-bold text-sm text-white">${t.name}</h4>
                <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${t.status === 'live' ? 'bg-red-500/20 text-red-500' : 'bg-accent/20 text-accent'}">${t.status}</span>
              </div>
              <p class="text-[11px] text-gray-400 mt-0.5">${t.gameMode} • ${t.scheduleTime || 'Soon'}</p>
            </div>
            <div class="flex justify-between items-center text-xs mt-2">
              <span class="text-accent font-bold">₹${t.prizePool} Pool</span>
              <span class="text-gray-300 font-semibold">Fee: ₹${t.entryFee}</span>
            </div>
          </div>
        </div>
        <div class="mt-2.5">
          <div class="w-full bg-cardBorder h-1.5 rounded-full overflow-hidden">
            <div class="bg-primary h-full" style="width: ${(joined / max) * 100}%"></div>
          </div>
          <p class="text-[10px] text-gray-400 mt-1 text-right">${joined}/${max} Joined</p>
        </div>
      </div>
    `;

    if (index === 0) {
      featuredContainer.innerHTML = cardHtml;
    }
    homeList.insertAdjacentHTML('beforeend', cardHtml);
    playList.insertAdjacentHTML('beforeend', cardHtml);
  });
}

// Tournament Details & Atomic Join Flow
function openTournamentDetail(tId) {
  selectedTournamentId = tId;
  const t = currentTournaments[tId];
  if (!t) return;

  document.getElementById('modal-banner').src = t.banner || '';
  document.getElementById('modal-title').innerText = t.name;
  document.getElementById('modal-mode').innerText = `${t.gameMode} • Starts ${t.scheduleTime}`;
  document.getElementById('modal-fee').innerText = `₹${t.entryFee}`;
  document.getElementById('modal-prize').innerText = `₹${t.prizePool}`;

  const joinBtn = document.getElementById('btn-join-match');
  const uid = currentUser?.uid;

  // Check if already registered
  db.ref(`registrations/${tId}/${uid}`).once('value', regSnap => {
    const isRegistered = regSnap.exists();
    const roomBox = document.getElementById('modal-room-box');

    if (isRegistered) {
      joinBtn.innerText = "REGISTERED";
      joinBtn.disabled = true;
      joinBtn.classList.replace('bg-primary', 'bg-gray-700');

      // Show Room Details if published
      if (t.roomId && t.roomPassword) {
        roomBox.classList.remove('hidden');
        document.getElementById('modal-room-id').innerText = t.roomId;
        document.getElementById('modal-room-pass').innerText = t.roomPassword;
      } else {
        roomBox.classList.add('hidden');
      }
    } else {
      joinBtn.innerText = "JOIN NOW";
      joinBtn.disabled = false;
      joinBtn.classList.replace('bg-gray-700', 'bg-primary');
      roomBox.classList.add('hidden');
      joinBtn.onclick = () => processJoinTournament(tId, t);
    }
    openModal('tournamentDetailModal');
  });
}

function processJoinTournament(tId, t) {
  if (!currentUser) return alert('Please login first.');
  const uid = currentUser.uid;
  const fee = parseFloat(t.entryFee) || 0;

  const walletRef = db.ref(`wallets/${uid}/balance`);
  walletRef.transaction(currentBalance => {
    if (currentBalance === null) return 0;
    if (currentBalance < fee) return; // Abort transaction if insufficient funds
    return currentBalance - fee;
  }, (error, committed) => {
    if (error || !committed) {
      alert('Insufficient wallet balance or registration error.');
      return;
    }

    // Register User
    const regData = {
      userId: uid,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    db.ref(`registrations/${tId}/${uid}`).set(regData);
    db.ref(`tournaments/${tId}/joinedCount`).set(firebase.database.ServerValue.increment(1));

    // Record Transaction
    db.ref(`transactions/${uid}`).push({
      amount: fee,
      type: 'tournament_entry',
      tournamentId: tId,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    alert('Successfully registered!');
    closeModal('tournamentDetailModal');
  });
}

// Deposit Submission (Manual UPI Verification flow)
function submitDepositRequest() {
  const amount = parseFloat(document.getElementById('deposit-amount').value);
  const utr = document.getElementById('deposit-utr').value.trim();

  if (!amount || amount <= 0 || utr.length < 6) {
    return alert('Please enter valid amount and Reference/UTR number.');
  }

  const depositData = {
    userId: currentUser.uid,
    amount: amount,
    utr: utr,
    status: 'pending',
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  db.ref('deposits').push(depositData).then(() => {
    alert('Deposit request submitted! Admin will verify and credit balance shortly.');
    closeModal('addCashModal');
  });
}
