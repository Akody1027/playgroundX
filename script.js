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

    // --- HELPER FOR EMPTY STATES ---
    function getEmptyStateHTML() {
        return `
            <div class="empty-placeholder-container" style="text-align:center; padding-top:50px; color:#666;">
                <div style="font-size:40px; margin-bottom:10px;">🔭</div>
                <div class="empty-text">No users nearby</div>
            </div>
        `;
    }

    // --- 1. CORE BACKEND & INITIALIZATION ---

    window.initBackend = function() {
        // 1. Establish Identity (Hybrid: Local + potentially Firebase)
        let myUid = localStorage.getItem('pgX_myUid');
        if (!myUid) {
            myUid = 'user_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            localStorage.setItem('pgX_myUid', myUid);
        }

        // 2. Create mock users if we have absolutely no data locally
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

        // 3. Start the app processes
        renderDeck();
        initArcade();
        
        // 4. Load Saved Profile Picture into Header & Gallery
        const savedImg = localStorage.getItem('my_profile_pic');
        if (savedImg) {
            const headerIcon = document.getElementById('user-icon-trigger');
            if (headerIcon) {
                headerIcon.innerHTML = `<img src="${savedImg}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            }
            const galleryImg = document.getElementById('g1-preview');
            const galleryLabel = document.getElementById('g1-lbl');
            if (galleryImg) {
                galleryImg.src = savedImg;
                galleryImg.style.display = 'block';
                if(galleryLabel) galleryLabel.style.display = 'none';
            }
        }
        
        // 5. Setup Listeners
        const sendBtn = document.querySelector('.chat-input-area button');
        if(sendBtn) sendBtn.onclick = sendMessage;

        const chatInput = document.querySelector('.chat-input');
        if(chatInput) {
            chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
        }

        const profileBtn = document.getElementById('open-my-profile');
        if(profileBtn) {
            profileBtn.onclick = (e) => {
                e.preventDefault(); 
                window.loadMyProfile();
            };
        }
    }

    // --- 2. DECK & SWIPE LOGIC ---

    window.renderDeck = async function() {
        const zone = document.getElementById('swipe-zone');
        const grid = document.getElementById('grid-content');

        let realUsers = [];
        
        // 1. DATA: Try to get Real People from Firebase
        if (window.fbase && window.db) {
            try {
                const snapshot = await window.fbase.getDocs(window.fbase.collection(window.db, "users"));
                snapshot.forEach(doc => {
                    // Don't show myself
                    if (doc.id !== localStorage.getItem('pgX_myUid')) {
                        realUsers.push({ id: doc.id, ...doc.data() });
                    }
                });
            } catch (e) {
                console.log("Offline or DB error, using mocks");
            }
        }

        // 2. LOGIC: Decide Real or Mock?
        if (realUsers.length > 0) {
            activeDeck = realUsers;
        } else {
            // Fallback to local mocks
            activeDeck = JSON.parse(localStorage.getItem('pgX_users')) || [];
            activeDeck = activeDeck.filter(u => !u.seen);
        }
        
        // 3. DRAWING: Render Swipe View
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

        // 4. DRAWING: Render Grid View
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
        
        // 5. DRAWING: Update Map
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
        
        // 1. Animate
        card.style.transition = 'transform 0.5s ease-in';
        card.style.transform = `translateX(${dir === 'right' ? 1000 : -1000}px)`;

        // 2. Mark as Seen (Mock Logic)
        let allUsers = JSON.parse(localStorage.getItem('pgX_users')) || [];
        if (activeDeck.length > 0) {
            let currentUserId = activeDeck[0].id;
            let userIndex = allUsers.findIndex(u => u.id === currentUserId);
            if (userIndex > -1) {
                allUsers[userIndex].seen = true;
                localStorage.setItem('pgX_users', JSON.stringify(allUsers));
            }
        }

        // 3. Feedback
        if (dir === 'right') {
            document.getElementById('wink-txt').classList.add('show');
            setTimeout(() => document.getElementById('wink-txt').classList.remove('show'), 1000);
        }

        // 4. Reload Deck
        setTimeout(() => { 
            resetButtons(); 
            renderDeck(); 
        }, 300);
    }

    function resetButtons() {
        if (btnLike) btnLike.style.background = 'rgba(0,0,0,0.6)';
        if (btnReject) btnReject.style.background = 'rgba(0,0,0,0.6)';
    }

    // --- 3. MAP ---
    const map = L.map('map', {zoomControl: false}).setView([40.7128, -74.0060], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    window.updateMapPins = function(users) {
        map.eachLayer((layer) => { if(layer instanceof L.Marker) map.removeLayer(layer); });

        users.forEach(u => {
            if(u.lat && u.lng) {
                const icon = L.divIcon({
                    className: 'custom-pin',
                    html: `<div class="user-dot-pin" style="width:12px; height:12px;"></div>`
                });
                L.marker([u.lat, u.lng], {icon: icon})
                 .addTo(map)
                 .bindPopup(`<b>${u.alias}</b><br>${u.age}`);
            }
        });
        const myIcon = L.divIcon({ className: 'my-pin', html: `<div class="my-location-pin" style="width:20px; height:20px;"></div>` });
        L.marker([40.7128, -74.0060], {icon: myIcon}).addTo(map);
    }

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
    }

    async function sendMessage() {
        const input = document.querySelector('.chat-input');
        const text = input.value.trim();
        if (!text) return;

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
            // Local fallback
            const chatBody = document.getElementById('chat-body');
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble me';
            bubble.innerText = text;
            chatBody.appendChild(bubble);
        }
        input.value = '';
    }

    // --- 5. UI CONTROLS ---

    window.toggleUserMenu = function() {
        const menu = document.getElementById('user-dropdown');
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }

    const userTrigger = document.getElementById('user-icon-trigger');
    if(userTrigger) userTrigger.onclick = (e) => { e.stopPropagation(); window.toggleUserMenu(); };

    window.switchView = function(viewId, btn) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');
        btn.classList.add('active');
        if (viewId === 'map') setTimeout(() => map.invalidateSize(), 100);
    }

    window.openMsgModal = function() {
        document.getElementById('msg-modal').style.display = 'block';
    }

    window.closeChat = function() {
        document.getElementById('msg-modal').style.display = 'none';
        document.getElementById('msg-list-view').style.display = 'block';
        document.getElementById('chat-view').style.display = 'none';
    }

    window.openTab = function(tabId, btn) {
        document.querySelectorAll('.tab-pane').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(tabId).style.display = 'block';
        btn.classList.add('active');
    }

    window.toggleAccordion = function(id, isChecked) {
        const el = document.getElementById(id);
        if(el) el.style.display = isChecked ? 'block' : 'none';
    }

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
                const imgUrl = e.target.result;
                // Update Main
                document.getElementById('my-main-preview').src = imgUrl;
                // Update Gallery #1
                const galleryImg = document.getElementById('g1-preview');
                galleryImg.src = imgUrl;
                galleryImg.style.display = 'block';
                const galleryLabel = document.getElementById('g1-lbl');
                if(galleryLabel) galleryLabel.style.display = 'none';
                // Update Header
                const headerIcon = document.getElementById('user-icon-trigger');
                headerIcon.innerHTML = `<img src="${imgUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            }
            reader.readAsDataURL(file);
        }
    }
    
    window.previewVideo = function(event) {
        alert("Video selected!");
    }

    window.saveProfile = async function() {
        const alias = document.getElementById('p-alias').value;
        const bio = document.getElementById('p-bio').value;
        const imgVal = document.getElementById('my-main-preview').src;

        // 1. Save Local
        localStorage.setItem('pgX_alias', alias);
        localStorage.setItem('pgX_bio', bio);
        localStorage.setItem('my_profile_pic', imgVal);

        // 2. Save to Firebase (Hybrid)
        if (window.fbase && window.db) {
            const myUid = localStorage.getItem('pgX_myUid');
            try {
                await window.fbase.setDoc(window.fbase.doc(window.db, "users", myUid), {
                    alias: alias,
                    bio: bio,
                    lastSeen: window.fbase.serverTimestamp()
                }, { merge: true });
            } catch (e) { console.error("Sync failed", e); }
        }

        document.getElementById('profile-modal').style.display = 'none';
    }

    window.loadMyProfile = function() {
        const storedAlias = localStorage.getItem('pgX_alias') || ""; 
        const storedBio = localStorage.getItem('pgX_bio') || "";
        const storedImg = localStorage.getItem('my_profile_pic') || "https://via.placeholder.com/120";

        document.getElementById('p-alias').value = storedAlias;
        document.getElementById('p-bio').value = storedBio;
        document.getElementById('my-main-preview').src = storedImg;
        
        const galleryImg = document.getElementById('g1-preview');
        const galleryLabel = document.getElementById('g1-lbl');
        
        if (storedImg.includes('data:image') || storedImg.includes('http')) {
             galleryImg.src = storedImg;
             galleryImg.style.display = 'block';
             if(galleryLabel) galleryLabel.style.display = 'none';
        }

        document.getElementById('profile-modal').style.display = 'block';
        document.getElementById('user-dropdown').style.display = 'none';
    }

    window.applyFilters = function() {
        document.getElementById('filter-modal').style.display = 'none';
        renderDeck();
    }

    window.openUserProfile = function(alias, age, img, id) {
        const modal = document.getElementById('view-user-modal');
        document.getElementById('view-user-img').src = img;
        document.getElementById('view-user-img-small').src = img;
        document.getElementById('view-user-name').innerText = alias + ", " + age;
        document.getElementById('view-user-bio').innerText = `${alias} is a ${age} year old member.`;
        
        const chipsContainer = document.getElementById('view-user-chips');
        chipsContainer.innerHTML = `<span class="stat-chip love">Words of Affirmation</span><span class="stat-chip">Non-Smoker</span>`;
        
        modal.style.display = 'block';
    }

    window.toggleReportMenu = function() {
        const menu = document.getElementById('report-menu');
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }

    // --- 6. ARCADE ---
    const games = [
        { name: "Simple Pong", file: "Simplepong.html", thumb: "https://via.placeholder.com/150/000000/FFFFFF/?text=Pong" },
        { name: "Speed Jump", file: "Speedjump.html", thumb: "https://via.placeholder.com/150/000000/FFFFFF/?text=Jump" },
        { name: "Ghost Poke", file: "Ghostpoke.html", thumb: "https://via.placeholder.com/150/000000/FFFFFF/?text=Ghost" },
        { name: "Caos Racer", file: "caosracer.html", thumb: "https://via.placeholder.com/150/000000/FFFFFF/?text=Racer" },
        { name: "Big Shot", file: "bigshot.html", thumb: "https://via.placeholder.com/150/000000/FFFFFF/?text=Shot" },
        { name: "Flap Dodge", file: "flapdodge.html", thumb: "https://via.placeholder.com/150/000000/FFFFFF/?text=Flap" }
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
        // frame.src = file; // Enable this when you have real game files
        frame.src = "about:blank"; 
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
    
    window.closeConfirm = function() {
        document.getElementById('confirm-modal').style.display = 'none';
    }
    window.confirmYes = function() {
        alert("Item deleted");
        window.closeConfirm();
    }

    // START
    initBackend();
});
