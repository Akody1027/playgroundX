document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION & GLOBAL STATE ---
    const ALIAS_PRE = ['Jay', 'Cool', 'Wild', 'Soft', 'Dark', 'Light', 'Neo', 'Retro'];
    const ALIAS_SUF = ['Rocker', 'Vibes', 'Soul', 'King', 'Queen', 'X', '99', 'Walker'];
    const IMGS_F = ['https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500'];
    const IMGS_M = ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500', 'https://images.unsplash.com/photo-1480455624313-e29b44bbfde1?w=500'];
    const DATA_REL_TYPE = ['Marriage', 'Long-Term', 'Short-Term', 'Intimacy w/o Connection', 'Friends', 'FWB'];

    let activeDeck = [];
    let card, startX, currentX, btnLike, btnReject;
    let currentChatUnsubscribe = null; 
    let currentChatId = null; 
    let jessRead = false; 

    // --- NEW: HELPER FOR EMPTY STATES ---
    function getEmptyStateHTML() {
        return `
            <div class="empty-placeholder-container">
                <img src="user_placeholder.jpg" class="empty-placeholder-img">
                <div class="empty-text">No users nearby</div>
            </div>
        `;
    }

    // --- 1. CORE BACKEND & INITIALIZATION ---

    window.initBackend = function() {
        if (!localStorage.getItem('pgX_users')) {
            let users = [];
            for (let i = 0; i < 30; i++) {
                let isFem = Math.random() > 0.5;
                users.push({
                    id: 'mock_' + i, 
                    alias: ALIAS_PRE[Math.floor(Math.random() * 8)] + "_" + ALIAS_SUF[Math.floor(Math.random() * 8)],
                    age: Math.floor(Math.random() * 15) + 18,
                    gender: isFem ? 'Woman' : 'Man',
                    img: isFem ? IMGS_F[Math.floor(Math.random() * IMGS_F.length)] : IMGS_M[Math.floor(Math.random() * IMGS_M.length)],
                    lat: 40.7128 + (Math.random() - 0.5) * 0.05,
                    lng: -74.0060 + (Math.random() - 0.5) * 0.05,
                    relationship: DATA_REL_TYPE[Math.floor(Math.random() * DATA_REL_TYPE.length)],
                    bio: "Just here for a good time. Love travel and photography.",
                    seen: false,
                    winkedAtMe: Math.random() < 0.2
                });
            }
            localStorage.setItem('pgX_users', JSON.stringify(users));
        }
        updateBadge();
        renderDeck();
        loadWinks();
        loadMyProfile(); 
        setInterval(simulateRealTime, 5000);
        
        // Send Button Listener
        const sendBtn = document.querySelector('.chat-input-area button');
        if(sendBtn) sendBtn.onclick = sendMessage;

        const chatInput = document.querySelector('.chat-input');
        if(chatInput) {
            chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
        }
    }

    // --- 2. DECK & SWIPE LOGIC ---

    window.renderDeck = async function() {
        const zone = document.getElementById('swipe-zone');
        const grid = document.getElementById('grid-content');

        try {
            if (window.fbase && window.db) {
                const { getDocs, collection } = window.fbase;
                const querySnapshot = await getDocs(collection(window.db, "users"));
                let realUsers = [];
                querySnapshot.forEach((doc) => realUsers.push(doc.data()));

                if (realUsers.length > 0) {
                    let myUid = localStorage.getItem('pgX_myUid');
                    activeDeck = realUsers.filter(u => u.id !== myUid);
                } else {
                    activeDeck = JSON.parse(localStorage.getItem('pgX_users')).filter(u => !u.seen);
                }
            } else {
                 activeDeck = JSON.parse(localStorage.getItem('pgX_users')).filter(u => !u.seen);
            }
        } catch (e) {
            activeDeck = JSON.parse(localStorage.getItem('pgX_users')).filter(u => !u.seen);
        }

        // --- UPDATED SWIPE VIEW LOGIC ---
        if (activeDeck.length > 0) {
            const u = activeDeck[0];
            zone.innerHTML = `
            <div class="swipe-card" id="active-card" onclick="window.openUserProfile('${u.alias}', ${u.age}, '${u.img}', '${u.id}')">
                <img src="${u.img}">
                <div class="card-header-overlay">
                    <span class="card-alias">${u.alias}</span>
                    <span class="card-age">${u.age}</span>
                </div>
            </div>`;
            setTimeout(initSwipeHandlers, 50);
        } else {
            // SHOW PLACEHOLDER IMAGE IF EMPTY
            zone.innerHTML = getEmptyStateHTML();
        }

        // --- UPDATED GRID VIEW LOGIC ---
        if (grid) {
            if (activeDeck.length === 0) {
                // If empty, switch to flex to center the placeholder image
                grid.style.display = 'flex';
                grid.innerHTML = getEmptyStateHTML();
            } else {
                // If users exist, ensure grid layout is active
                grid.style.display = 'grid';
                grid.innerHTML = activeDeck.map(u => `
                <div class="grid-item" onclick="window.openUserProfile('${u.alias}', ${u.age}, '${u.img}', '${u.id}')">
                    <img src="${u.img}" style="width:100%; height:100%; object-fit:cover;">
                    <div class="grid-overlay"><span>${u.alias}</span><span>${u.age}</span></div>
                </div>
                `).join('');
            }
        }
    }

    function initSwipeHandlers() {
        card = document.getElementById('active-card');
        btnReject = document.getElementById('btn-reject');
        btnLike = document.getElementById('btn-like');
        if (!card) return;

        card.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; card.style.transition = 'none'; });
        card.addEventListener('touchmove', (e) => {
            currentX = e.touches[0].clientX - startX;
            card.style.transform = `translateX(${currentX}px) rotate(${currentX / 15}deg)`;
            if (currentX > 0) { btnLike.style.background = 'var(--accent)'; } 
            else { btnReject.style.background = 'grey'; }
        });
        card.addEventListener('touchend', () => {
            if (currentX > 100) window.userSwipe('right');
            else if (currentX < -100) window.userSwipe('left');
            else { card.style.transform = 'translateX(0)'; resetButtons(); }
        });
    }

    window.userSwipe = function(dir) {
        if (!card) return;
        card.style.transition = 'transform 0.5s ease-in';
        card.style.transform = `translateX(${dir === 'right' ? 1000 : -1000}px)`;
        if (dir === 'right') {
            document.getElementById('wink-txt').classList.add('show');
            setTimeout(() => document.getElementById('wink-txt').classList.remove('show'), 1000);
        }
        setTimeout(() => { resetButtons(); renderDeck(); }, 300);
    }

    function resetButtons() {
        if (btnLike) btnLike.style.background = 'rgba(0,0,0,0.6)';
        if (btnReject) btnReject.style.background = 'rgba(0,0,0,0.6)';
    }

    // --- 3. MAP ---
    const map = L.map('map').setView([40.7128, -74.0060], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    // --- 4. REAL-TIME MESSAGING ---

    window.openChat = function(name, targetUid) {
        document.getElementById('msg-list-view').style.display = 'none';
        document.getElementById('chat-view').style.display = 'flex';
        document.getElementById('chat-target-name').innerText = name;
        
        const chatBody = document.getElementById('chat-body');
        chatBody.innerHTML = ''; 
        currentChatId = targetUid; 

        if (window.fbase && window.db && targetUid) {
            const { collection, query, orderBy, onSnapshot, limit } = window.fbase;
            let myUid = localStorage.getItem('pgX_myUid') || 'anon';
            const chatId = [myUid, targetUid].sort().join('_');
            
            const q = query(collection(window.db, "chats", chatId, "messages"), orderBy("createdAt"), limit(50));
            
            if(currentChatUnsubscribe) currentChatUnsubscribe(); // Stop old listener

            currentChatUnsubscribe = onSnapshot(q, (snapshot) => {
                chatBody.innerHTML = ''; 
                snapshot.forEach((doc) => {
                    const msg = doc.data();
                    const isMe = msg.senderId === myUid;
                    const bubble = document.createElement('div');
                    bubble.className = `chat-bubble ${isMe ? 'me' : 'them'}`;
                    bubble.innerText = msg.text;
                    chatBody.appendChild(bubble);
                });
                chatBody.scrollTop = chatBody.scrollHeight;
            });
        }
    }

    async function sendMessage() {
        const input = document.querySelector('.chat-input');
        const text = input.value.trim();
        if (!text || !currentChatId) return;

        if (window.fbase && window.db) {
            const { collection, addDoc, serverTimestamp } = window.fbase;
            let myUid = localStorage.getItem('pgX_myUid') || 'anon';
            const chatId = [myUid, currentChatId].sort().join('_');

            await addDoc(collection(window.db, "chats", chatId, "messages"), {
                text: text,
                senderId: myUid,
                createdAt: serverTimestamp()
            });
            input.value = '';
        }
    }

    // --- 5. UI CONTROLS ---

    window.toggleUserMenu = function() {
        const menu = document.getElementById('user-dropdown');
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }

    // Fix: Attach listener to icon specifically
    const userTrigger = document.getElementById('user-icon-trigger');
    if(userTrigger) userTrigger.onclick = (e) => { e.stopPropagation(); window.toggleUserMenu(); };

    window.switchView = function(viewId, btn) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');
        btn.classList.add('active');
        if (viewId === 'map') setTimeout(() => map.invalidateSize(), 100);
    }

    window.saveProfile = async function() {
        let myUid = localStorage.getItem('pgX_myUid') || 'user_' + Date.now();
        localStorage.setItem('pgX_myUid', myUid);

        const profileData = {
            id: myUid,
            alias: document.getElementById('p-alias').value || "Anonymous",
            img: document.getElementById('my-main-preview').src,
            age: document.getElementById('p-age').value
        };

        localStorage.setItem('my_profile_pic', profileData.img);
        
        if (window.fbase && window.db) {
            const { setDoc, doc } = window.fbase;
            await setDoc(doc(window.db, "users", myUid), profileData, { merge: true });
        }
        document.getElementById('profile-modal').style.display = 'none';
        alert("Profile Saved!");
    }

    // Logic for loading winks and badges...
    function updateBadge() { /* ... Badge logic ... */ }
    function loadWinks() { /* ... Wink logic ... */ }
    function loadMyProfile() { /* ... Profile loader ... */ }
    function simulateRealTime() { /* ... Mock winks ... */ }



    // --- ARCADE CONFIGURATION ---
    const games = [
        { name: "Simple Pong", file: "Simplepong.html", thumb: "simplepong.jpg" },
        { name: "Speed Jump", file: "Speedjump.html", thumb: "speedjump.jpg" },
        { name: "Ghost Poke", file: "Ghostpoke.html", thumb: "ghostpoke.html" }, // Note: check if this should be .jpg or .html for thumb
        { name: "Caos Racer", file: "caosracer.html", thumb: "caosracer.jpg" },
        { name: "Big Shot", file: "bigshot.html", thumb: "bigshot.jpg" },
        { name: "Flap Dodge", file: "flapdodge.html", thumb: "flapdodge.jpg" },
        { name: "Memory", file: "memory.html", thumb: "memory.jpg" },
        { name: "Block Crush", file: "blockcrush.html", thumb: "blockcrush.jpg" }
    ];

    // --- ARCADE CORE FUNCTIONS ---

    function initArcade() {
        const grid = document.getElementById('arcade-grid');
        if (!grid) return;
        grid.innerHTML = ''; 

        games.forEach(game => {
            const card = document.createElement('div');
            card.className = 'game-card'; 
            // Inline style for immediate structure, behavior handled by window functions
            card.style = "position:relative; background:#222; border-radius:12px; overflow:hidden; aspect-ratio:1/1; border:1px solid #333;";
            
            card.innerHTML = `
                <img src="${game.thumb}" style="width:100%; height:100%; object-fit:cover;">
                <div class="game-overlay" onclick="window.revealPlay(this)" style="position:absolute; inset:0; background:rgba(0,0,0,0); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:0.3s;">
                    <button onclick="window.launchGame('${game.file}', event)" class="play-btn" style="background:var(--accent); color:white; border:none; padding:10px 20px; border-radius:20px; font-weight:bold; transform: scale(0.8); opacity:0; transition:0.2s; pointer-events:none;">PLAY</button>
                </div>
                <div style="position:absolute; bottom:0; left:0; right:0; padding:8px; background:linear-gradient(transparent, rgba(0,0,0,0.8)); color:white; font-size:12px; font-weight:600; pointer-events:none;">${game.name}</div>
            `;
            grid.appendChild(card);
        });
    }

    // This handles the "Click thumbnail to see Play button" logic
    window.revealPlay = function(overlay) {
        // Reset any other open play buttons first
        document.querySelectorAll('.game-overlay').forEach(el => {
            el.style.background = "rgba(0,0,0,0)";
            const btn = el.querySelector('.play-btn');
            btn.style.opacity = "0";
            btn.style.transform = "scale(0.8)";
            btn.style.pointerEvents = "none";
        });

        // Activate the clicked one
        overlay.style.background = "rgba(0,0,0,0.7)";
        const activeBtn = overlay.querySelector('.play-btn');
        activeBtn.style.opacity = "1";
        activeBtn.style.transform = "scale(1)";
        activeBtn.style.pointerEvents = "auto";
    };

    window.launchGame = function(file, event) {
        if (event) event.stopPropagation(); // Prevents the overlay click from re-firing
        const player = document.getElementById('game-player');
        const frame = document.getElementById('game-frame');
        frame.src = file;
        player.style.display = 'block';
    };

    window.closeGame = function() {
        const player = document.getElementById('game-player');
        const frame = document.getElementById('game-frame');
        frame.src = ''; // Crucial: This kills the game process/audio
        player.style.display = 'none';
    };

    window.closeArcade = function() {
        window.closeGame();
        document.getElementById('game-modal').style.display = 'none';
    };

    // --- FINALIZE INITIALIZATION ---
    
    // Call initArcade inside your existing backend init
    const originalInit = window.initBackend;
    window.initBackend = function() {
        if(originalInit) originalInit();
        initArcade();
    };

    initBackend();
});



