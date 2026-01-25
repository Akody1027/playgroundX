document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION & GLOBAL STATE ---
    let activeDeck = [];
    let card, startX, currentX, btnLike, btnReject;
    let currentChatUnsubscribe = null; 
    let currentChatId = null; 

    // --- HELPER FOR EMPTY SLOTS (CONSISTENT STYLE) ---
    function getEmptySlotHTML(isGrid = true) {
        const size = isGrid ? "14px" : "50px";
        const fontSize = isGrid ? "8px" : "10px";
        return `
            <div class="${isGrid ? 'grid-item' : ''}" style="display:flex; flex-direction:column; align-items:center; justify-content:center; color:#444; height:100%; border:1px dashed #444; border-radius:12px; background:#1a1a1a; aspect-ratio: 1/1;">
                <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
                </svg>
                <p style="font-size:${fontSize}; font-weight:bold; margin-top:5px; letter-spacing:1px; text-align:center;">WAITING FOR USERS...</p>
            </div>`;
    }

    // --- 1. CORE BACKEND & INITIALIZATION ---
    window.initBackend = function() {
        if (!localStorage.getItem('pgX_users')) {
            localStorage.setItem('pgX_users', JSON.stringify([]));
        }
        
        const profileBtn = document.getElementById('open-my-profile');
        if(profileBtn) {
            profileBtn.onclick = (e) => {
                e.preventDefault();
                document.getElementById('profile-modal').style.display = 'block';
                document.getElementById('user-dropdown').style.display = 'none';
            };
        }

        renderDeck();
        initArcade(); // Load all games
    };

    // --- 2. DECK & GRID VIEW LOGIC ---
    window.renderDeck = async function() {
        const zone = document.getElementById('swipe-zone');
        const grid = document.getElementById('grid-content');
        let usersToShow = [];

        try {
            if (window.fbase && window.db) {
                const { getDocs, collection } = window.fbase;
                const querySnapshot = await getDocs(collection(window.db, "users"));
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.id !== localStorage.getItem('pgX_myUid')) usersToShow.push(data);
                });
            }
        } catch (e) { console.log("Database fetch failed/skipped."); }

        activeDeck = usersToShow;

        // Swipe View Placeholder (Realistic Size)
        if (activeDeck.length === 0) {
            zone.innerHTML = `
                <div style="width: 95%; max-width: 400px; height: 90%; margin: 0 auto;">
                    ${getEmptySlotHTML(false)}
                </div>`;
        } else {
            const u = activeDeck[0];
            zone.innerHTML = `
                <div class="swipe-card" id="active-card">
                    <img src="${u.img}">
                    <div class="card-header-overlay"><span class="card-alias">${u.alias}</span></div>
                </div>`;
            initSwipeHandlers();
        }

        // Grid View Logic
        if (grid) {
            grid.style.display = 'grid';
            let gridHTML = activeDeck.map(u => `
                <div class="grid-item">
                    <img src="${u.img}" style="width:100%; height:100%; object-fit:cover;">
                    <div class="grid-overlay"><span>${u.alias}</span></div>
                </div>
            `).join('');
            
            // Show up to 9 slots, all showing "Waiting" if empty
            let maxSlots = 9;
            for (let i = activeDeck.length; i < maxSlots; i++) {
                gridHTML += getEmptySlotHTML(true);
            }
            grid.innerHTML = gridHTML;
        }
    };

    // --- 3. CONNECT DASHBOARD (FIXED TOGGLE) ---
    window.openTab = function(tabId, btn) {
        // Toggle Panes
        document.getElementById('tab-winks').style.display = (tabId === 'tab-winks') ? 'block' : 'none';
        document.getElementById('tab-chats').style.display = (tabId === 'tab-chats') ? 'block' : 'none';
        
        // Toggle Button Highlight
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    };

    // --- 4. ARCADE (DISPLAY ALL GAMES) ---
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
        const arcadeGrid = document.getElementById('arcade-grid');
        if (!arcadeGrid) return;
        arcadeGrid.innerHTML = games.map(game => `
            <div class="game-card" style="position:relative; background:#222; border-radius:12px; overflow:hidden; aspect-ratio:1/1; border:1px solid #333;">
                <img src="${game.thumb}" style="width:100%; height:100%; object-fit:cover;">
                <div class="game-overlay" onclick="window.revealPlay(this)" style="position:absolute; inset:0; background:rgba(0,0,0,0); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:0.3s;">
                    <button onclick="window.launchGame('${game.file}', event)" class="play-btn" style="background:var(--accent); color:white; border:none; padding:10px 20px; border-radius:20px; font-weight:bold; opacity:0; pointer-events:none;">PLAY</button>
                </div>
                <div style="position:absolute; bottom:0; left:0; right:0; padding:8px; background:linear-gradient(transparent, rgba(0,0,0,0.8)); color:white; font-size:12px;">${game.name}</div>
            </div>
        `).join('');
    }

    // --- 5. MAP & NAVIGATION ---
    const map = L.map('map').setView([40.7128, -74.0060], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    window.switchView = function(viewId, btn) {
        document.querySelectorAll('.app-view').forEach(v => v.style.display = 'none');
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        
        const activeView = document.getElementById('view-' + viewId);
        activeView.style.display = 'block';
        btn.classList.add('active');
        
        if (viewId === 'map') {
            setTimeout(() => { map.invalidateSize(); }, 200);
        }
    };

    window.initBackend();
});
