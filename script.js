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

    // --- NEW: HELPER FOR EMPTY STATES ---
    function getEmptyStateHTML() {
        return `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#666;">
                <div style="font-size:40px;">🔭</div>
                <div style="margin-top:10px;">No users nearby</div>
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
        renderDeck();
        initArcade(); // Initialize Arcade
        
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

        // Try to get data (Local storage fallbacks for demo)
        try {
            if (window.fbase && window.db) {
                // In a real app, you'd fetch from Firebase here
                // For this demo, we use local mock data mostly
                activeDeck = JSON.parse(localStorage.getItem('pgX_users')).filter(u => !u.seen);
            } else {
                 activeDeck = JSON.parse(localStorage.getItem('pgX_users')).filter(u => !u.seen);
            }
        } catch (e) {
            activeDeck = [];
        }

        // --- SWIPE VIEW RENDER ---
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
            zone.innerHTML = getEmptyStateHTML();
        }

        // --- GRID VIEW RENDER ---
        if (grid) {
            if (activeDeck.length === 0) {
                grid.style.display = 'flex';
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
        
        // --- UPDATE MAP ---
        if(window.updateMapPins) window.updateMapPins(activeDeck);
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
        
        // Mark as seen in mock data
        let allUsers = JSON.parse(localStorage.getItem('pgX_users'));
        let currentUser = activeDeck[0];
        let idx = allUsers.findIndex(u => u.id === currentUser.id);
        if(idx > -1) allUsers[idx].seen = true;
        localStorage.setItem('pgX_users', JSON.stringify(allUsers));

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

    // --- 3. MAP LOGIC ---
    const map = L.map('map', {zoomControl: false}).setView([40.7128, -74.0060], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
    
    // Helper to update map pins based on deck
    window.updateMapPins = function(users) {
        // Clear existing markers (basic implementation)
        map.eachLayer((layer) => {
            if(layer instanceof L.Marker) map.removeLayer(layer);
        });

        // Add User pins
        users.forEach(u => {
            const icon = L.divIcon({
                className: 'custom-pin',
                html: `<div class="user-dot-pin" style="width:12px; height:12px;"></div>`
            });
            L.marker([u.lat, u.lng], {icon: icon})
             .addTo(map)
             .bindPopup(`<b>${u.alias}</b><br>${u.age}`);
        });

        // Add My Pin
        const myIcon = L.divIcon({
            className: 'my-pin',
            html: `<div class="my-location-pin" style="width:20px; height:20px;"></div>`
        });
        L.marker([40.7128, -74.0060], {icon: myIcon}).addTo(map);
    }


    // --- 4. UI & NAVIGATION HELPER FUNCTIONS (MISSING FROM PREVIOUS CODE) ---

    // View Switching
    window.switchView = function(viewId, btn) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');
        btn.classList.add('active');
        if (viewId === 'map') setTimeout(() => map.invalidateSize(), 100);
    }

    // Toggle Menus
    window.toggleUserMenu = function() {
        const menu = document.getElementById('user-dropdown');
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }

    // Modal Handlers
    window.openMsgModal = function() {
        document.getElementById('msg-modal').style.display = 'block';
    }
    window.closeChat = function() {
        document.getElementById('msg-modal').style.display = 'none';
        // Return to message list view when closing
        document.getElementById('msg-list-view').style.display = 'block';
        document.getElementById('chat-view').style.display = 'none';
    }
    
    // Tab Switching (Winks vs Messages)
    window.openTab = function(tabId, btn) {
        document.querySelectorAll('.tab-pane').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(tabId).style.display = 'block';
        btn.classList.add('active');
    }

    // Accordion Logic (Filters & Profile Edit)
    window.toggleAccordion = function(id, isChecked) {
        const el = document.getElementById(id);
        if(el) el.style.display = isChecked ? 'block' : 'none';
    }

    // Profile Edit Specifics
    window.toggleProfileAcc = function(id) {
        const el = document.getElementById(id);
        if(el.style.display === 'block') el.style.display = 'none';
        else el.style.display = 'block';
    }
    
    window.selectProfileOption = function(displayId, value, accId) {
        document.getElementById(displayId).innerText = value;
        document.getElementById(accId).style.display = 'none';
    }

    window.previewMainAndGallery = function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('my-main-preview').src = e.target.result;
            }
            reader.readAsDataURL(file);
        }
    }
    
    window.previewVideo = function(event) {
        // Basic stub for video preview
        const file = event.target.files[0];
        if(file) {
            alert("Video selected! (Preview logic here)");
        }
    }

    window.saveProfile = function() {
        alert("Profile Saved (Locally)!");
        document.getElementById('profile-modal').style.display = 'none';
    }

    // Filters
    window.applyFilters = function() {
        alert("Filters Applied! Reloading deck...");
        document.getElementById('filter-modal').style.display = 'none';
        // In real app, re-fetch data here
        renderDeck();
    }

    // --- 5. USER PROFILE MODAL ---
    
    window.openUserProfile = function(alias, age, img, id) {
        const modal = document.getElementById('view-user-modal');
        document.getElementById('view-user-img').src = img;
        document.getElementById('view-user-img-small').src = img;
        document.getElementById('view-user-name').innerText = alias + ", " + age;
        
        // Random bio generation for demo
        document.getElementById('view-user-bio').innerText = "This is a generated bio for " + alias + ". I like hiking, coffee, and coding late at night.";
        
        // Random chips
        const chipsContainer = document.getElementById('view-user-chips');
        chipsContainer.innerHTML = `
            <span class="stat-chip love">Words of Affirmation</span>
            <span class="stat-chip">Non-Smoker</span>
            <span class="stat-chip">Average Body</span>
        `;
        
        modal.style.display = 'block';
    }

    window.toggleReportMenu = function() {
        const menu = document.getElementById('report-menu');
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }

    // --- 6. REAL-TIME MESSAGING (FIREBASE) ---

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
        if (!text) return;

        // If firebase is active
        if (window.fbase && window.db && currentChatId) {
            const { collection, addDoc, serverTimestamp } = window.fbase;
            let myUid = localStorage.getItem('pgX_myUid') || 'anon';
            const chatId = [myUid, currentChatId].sort().join('_');

            await addDoc(collection(window.db, "chats", chatId, "messages"), {
                text: text,
                senderId: myUid,
                createdAt: serverTimestamp()
            });
        } else {
            // Local simulation
            const chatBody = document.getElementById('chat-body');
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble me';
            bubble.innerText = text;
            chatBody.appendChild(bubble);
            chatBody.scrollTop = chatBody.scrollHeight;
        }
        input.value = '';
    }

    // --- 7. ARCADE LOGIC ---
    const games = [
        { name: "Simple Pong", file: "Simplepong.html", thumb: "https://via.placeholder.com/150/000000/FFFFFF/?text=Pong" },
        { name: "Speed Jump", file: "Speedjump.html", thumb: "https://via.placeholder.com/150/000000/FFFFFF/?text=Jump" },
        { name: "Ghost Poke", file: "Ghostpoke.html", thumb: "https://via.placeholder.com/150/000000/FFFFFF/?text=Ghost" },
        { name: "Caos Racer", file: "caosracer.html", thumb: "https://via.placeholder.com/150/000000/FFFFFF/?text=Racer" }
    ];

    function initArcade() {
        const grid = document.getElementById('arcade-grid');
        if (!grid) return;
        grid.innerHTML = ''; 

        games.forEach(game => {
            const card = document.createElement('div');
            card.className = 'game-card'; 
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

    window.revealPlay = function(overlay) {
        document.querySelectorAll('.game-overlay').forEach(el => {
            el.style.background = "rgba(0,0,0,0)";
            const btn = el.querySelector('.play-btn');
            btn.style.opacity = "0";
            btn.style.transform = "scale(0.8)";
            btn.style.pointerEvents = "none";
        });
        overlay.style.background = "rgba(0,0,0,0.7)";
        const activeBtn = overlay.querySelector('.play-btn');
        activeBtn.style.opacity = "1";
        activeBtn.style.transform = "scale(1)";
        activeBtn.style.pointerEvents = "auto";
    };

    window.launchGame = function(file, event) {
        if (event) event.stopPropagation();
        const player = document.getElementById('game-player');
        const frame = document.getElementById('game-frame');
        // frame.src = file; // Uncomment when you have real game files
        frame.src = "about:blank"; // Placeholder
        player.style.display = 'block';
    };

    window.closeGame = function() {
        const player = document.getElementById('game-player');
        const frame = document.getElementById('game-frame');
        frame.src = ''; 
        player.style.display = 'none';
    };

    window.closeArcade = function() {
        window.closeGame();
        document.getElementById('game-modal').style.display = 'none';
    };
    
    // --- CONFIRMATION MODALS (DELETE) ---
    window.closeConfirm = function() {
        document.getElementById('confirm-modal').style.display = 'none';
    }
    // Stub for window.confirmYes if you add delete logic later
    window.confirmYes = function() {
        alert("Item deleted");
        window.closeConfirm();
    }


    // START THE APP
    initBackend();
});
