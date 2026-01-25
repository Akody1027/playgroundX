document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION & GLOBAL STATE ---
    let activeDeck = [];
    let card, startX, currentX, btnLike, btnReject;
    let currentChatUnsubscribe = null; 
    let currentChatId = null; 

    // --- HELPER FOR EMPTY STATES ---
    function getEmptyStateHTML() {
        return `
            <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; border:2px dashed #444; border-radius:20px; background:#1a1a1a; padding: 40px; text-align: center;">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
                </svg>
                <div style="color:#666; font-size:12px; margin-top:10px; font-weight:bold; letter-spacing:1px;">WAITING FOR USERS...</div>
            </div>
        `;
    }

    // --- 1. CORE BACKEND & INITIALIZATION ---
    window.initBackend = function() {
        // Check if we have local users, if not, initialize empty list
        if (!localStorage.getItem('pgX_users')) {
            localStorage.setItem('pgX_users', JSON.stringify([]));
        }
        
        updateBadge();
        renderDeck();
        loadWinks();
        loadMyProfile(); 
        
        // Setup Send Button Listeners
        const sendBtn = document.querySelector('.chat-input-area button');
        if(sendBtn) sendBtn.onclick = sendMessage;

        const chatInput = document.querySelector('.chat-input');
        if(chatInput) {
            chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
        }
    };

    // --- 2. DECK & SWIPE LOGIC ---
    window.renderDeck = async function() {
        const zone = document.getElementById('swipe-zone');
        const grid = document.getElementById('grid-content');
        let usersToShow = [];

        try {
            // Try to get real users from Firebase first
            if (window.fbase && window.db) {
                const { getDocs, collection } = window.fbase;
                const querySnapshot = await getDocs(collection(window.db, "users"));
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    let myUid = localStorage.getItem('pgX_myUid');
                    if (data.id !== myUid) usersToShow.push(data);
                });
            }
        } catch (e) {
            console.log("Firebase not ready, checking local storage...");
        }

        // If Firebase is empty or failed, check local storage
        if (usersToShow.length === 0) {
            const localUsers = JSON.parse(localStorage.getItem('pgX_users')) || [];
            usersToShow = localUsers.filter(u => !u.seen);
        }

        activeDeck = usersToShow;

        // Render Swipe View
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
            initSwipeHandlers();
        } else {
            zone.innerHTML = getEmptyStateHTML();
        }

        // Render Grid View
        if (grid) {
            if (activeDeck.length === 0) {
                grid.style.display = 'block'; // Block for the empty state centered
                grid.innerHTML = getEmptyStateHTML();
            } else {
                grid.style.display = 'grid';
                grid.innerHTML = activeDeck.map(u => `
                <div class="grid-item" onclick="window.openUserProfile('${u.alias}', ${u.age}, '${u.img}', '${u.id}')">
                    <img src="${u.img}" style="width:100%; height:100%; object-fit:cover;">
                    <div class="grid-overlay"><span>${u.alias}</span><span>${u.age}</span></div>
                </div>
                `).join('');
            }
        }
    };

    function initSwipeHandlers() {
        card = document.getElementById('active-card');
        btnReject = document.getElementById('btn-reject');
        btnLike = document.getElementById('btn-like');
        if (!card) return;

        card.addEventListener('touchstart', (e) => { 
            startX = e.touches[0].clientX; 
            card.style.transition = 'none'; 
        });
        
        card.addEventListener('touchmove', (e) => {
            currentX = e.touches[0].clientX - startX;
            card.style.transform = `translateX(${currentX}px) rotate(${currentX / 15}deg)`;
            if (currentX > 50) { btnLike.style.background = 'var(--accent)'; } 
            else if (currentX < -50) { btnReject.style.background = 'grey'; }
            else { resetButtons(); }
        });
        
        card.addEventListener('touchend', () => {
            if (currentX > 100) window.userSwipe('right');
            else if (currentX < -100) window.userSwipe('left');
            else { 
                card.style.transition = 'transform 0.3s ease';
                card.style.transform = 'translateX(0) rotate(0)'; 
                resetButtons(); 
            }
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
        setTimeout(() => { 
            resetButtons(); 
            activeDeck.shift(); // Remove the swiped user
            renderDeck(); 
        }, 300);
    };

    function resetButtons() {
        if (btnLike) btnLike.style.background = 'rgba(0,0,0,0.6)';
        if (btnReject) btnReject.style.background = 'rgba(0,0,0,0.6)';
    }

    // --- 3. MAP ---
    const map = L.map('map').setView([40.7128, -74.0060], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    // --- 4. MESSAGING ---
    window.openMsgModal = function() {
        document.getElementById('msg-modal').style.display = 'block';
    };

    window.closeChat = function() {
        document.getElementById('msg-modal').style.display = 'none';
        if(currentChatUnsubscribe) {
            currentChatUnsubscribe();
            currentChatUnsubscribe = null;
        }
    };

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
            
            if(currentChatUnsubscribe) currentChatUnsubscribe();

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
    };

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
    };

    window.switchView = function(viewId, btn) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');
        btn.classList.add('active');
        if (viewId === 'map') setTimeout(() => map.invalidateSize(), 100);
    };

    // Placeholder functions to prevent errors
    function updateBadge() {}
    function loadWinks() {}
    function loadMyProfile() {}

    // --- 6. ARCADE ---
    const games = [
        { name: "Simple Pong", file: "Simplepong.html", thumb: "simplepong.jpg" },
        { name: "Speed Jump", file: "Speedjump.html", thumb: "speedjump.jpg" },
        { name: "Ghost Poke", file: "ghostpoke.html", thumb: "ghostpoke.jpg" },
        { name: "Caos Racer", file: "caosracer.html", thumb: "caosracer.jpg" },
        { name: "Big Shot", file: "bigshot.html", thumb: "bigshot.jpg" },
        { name: "Flap Dodge", file: "flapdodge.html", thumb: "flapdodge.jpg" },
        { name: "Memory", file: "memory.html", thumb: "memory.jpg" },
        { name: "Block Crush", file: "blockcrush.html", thumb: "blockcrush.jpg" }
    ];

    function initArcade() {
        const grid = document.getElementById('arcade-grid');
        if (!grid) return;
        grid.innerHTML = games.map(game => `
            <div class="game-card" style="position:relative; background:#222; border-radius:12px; overflow:hidden; aspect-ratio:1/1; border:1px solid #333;">
                <img src="${game.thumb}" style="width:100%; height:100%; object-fit:cover;">
                <div class="game-overlay" onclick="window.revealPlay(this)" style="position:absolute; inset:0; background:rgba(0,0,0,0); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:0.3s;">
                    <button onclick="window.launchGame('${game.file}', event)" class="play-btn" style="background:var(--accent); color:white; border:none; padding:10px 20px; border-radius:20px; font-weight:bold; transform: scale(0.8); opacity:0; transition:0.2s; pointer-events:none;">PLAY</button>
                </div>
                <div style="position:absolute; bottom:0; left:0; right:0; padding:8px; background:linear-gradient(transparent, rgba(0,0,0,0.8)); color:white; font-size:12px; font-weight:600; pointer-events:none;">${game.name}</div>
            </div>
        `).join('');
    }

    window.revealPlay = function(overlay) {
        document.querySelectorAll('.play-btn').forEach(btn => {
            btn.style.opacity = "0";
            btn.style.pointerEvents = "none";
        });
        const btn = overlay.querySelector('.play-btn');
        overlay.style.background = "rgba(0,0,0,0.7)";
        btn.style.opacity = "1";
        btn.style.transform = "scale(1)";
        btn.style.pointerEvents = "auto";
    };

    window.launchGame = function(file, event) {
        if (event) event.stopPropagation();
        const player = document.getElementById('game-player');
        document.getElementById('game-frame').src = file;
        player.style.display = 'block';
    };

    window.closeGame = function() {
        document.getElementById('game-frame').src = '';
        document.getElementById('game-player').style.display = 'none';
    };

    window.closeArcade = function() {
        window.closeGame();
        document.getElementById('game-modal').style.display = 'none';
    };

    // START EVERYTHING
    window.initBackend();
    initArcade();
});
