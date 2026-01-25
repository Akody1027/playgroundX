document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL STATE ---
    let activeDeck = [];
    let card, startX, currentX;
    let currentChatUnsubscribe = null; 
    let currentChatId = null; 

    // --- 1. HEADER & NAVIGATION CONTROLS ---
    // These ensure your top icons always work
    window.toggleUserMenu = function() {
        const menu = document.getElementById('user-dropdown');
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    };

    window.openMsgModal = function() {
        document.getElementById('msg-modal').style.display = 'block';
    };

    window.closeChat = function() {
        document.getElementById('msg-modal').style.display = 'none';
        document.getElementById('msg-list-view').style.display = 'block';
        document.getElementById('chat-view').style.display = 'none';
        if(currentChatUnsubscribe) currentChatUnsubscribe();
    };

    window.switchView = function(viewId, btn) {
        document.querySelectorAll('.app-view').forEach(v => v.style.display = 'none');
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        
        const activeView = document.getElementById('view-' + viewId);
        if(activeView) activeView.style.display = 'block';
        if(btn) btn.classList.add('active');
        
        if (viewId === 'map') {
            setTimeout(() => { map.invalidateSize(); }, 200);
        }
    };

    // --- 2. CONNECT DASHBOARD (WINKS VS MESSAGES) ---
    window.openTab = function(tabId, btn) {
        document.getElementById('tab-winks').style.display = (tabId === 'tab-winks') ? 'block' : 'none';
        document.getElementById('tab-chats').style.display = (tabId === 'tab-chats') ? 'block' : 'none';
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    };

    // --- 3. ARCADE SYSTEM (GAMES & PLAY LOGIC) ---
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
                <div class="game-overlay" onclick="window.revealPlay(this)" style="position:absolute; inset:0; background:rgba(0,0,0,0); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:0.3s; z-index:5;">
                    <button onclick="window.launchGame('${game.file}', event)" class="play-btn" style="background:var(--accent); color:white; border:none; padding:10px 20px; border-radius:20px; font-weight:bold; opacity:0; pointer-events:none; transition: 0.2s;">PLAY</button>
                </div>
                <div style="position:absolute; bottom:0; left:0; right:0; padding:8px; background:linear-gradient(transparent, rgba(0,0,0,0.8)); color:white; font-size:12px; z-index:2;">${game.name}</div>
            </div>
        `).join('');
    }

    window.revealPlay = function(overlay) {
        document.querySelectorAll('.play-btn').forEach(btn => {
            btn.style.opacity = "0";
            btn.style.pointerEvents = "none";
            btn.parentElement.style.background = "rgba(0,0,0,0)";
        });
        const btn = overlay.querySelector('.play-btn');
        overlay.style.background = "rgba(0,0,0,0.7)";
        btn.style.opacity = "1";
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

    // --- 4. SWIPE & GRID (WAITING FOR USERS) ---
    function getEmptySlotHTML(isGrid = true) {
        const size = isGrid ? "18px" : "60px";
        return `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; color:#444; height:100%; width:100%; border:1px dashed #444; border-radius:20px; background:#1a1a1a;">
                <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
                </svg>
                <p style="font-size:9px; font-weight:bold; margin-top:8px; letter-spacing:1px; text-align:center;">WAITING FOR USERS...</p>
            </div>`;
    }

    window.renderDeck = async function() {
        const zone = document.getElementById('swipe-zone');
        const grid = document.getElementById('grid-content');
        
        // Swipe View Placeholder
        zone.innerHTML = `<div style="width: 95%; max-width: 400px; height: 90%; margin: 0 auto;">${getEmptySlotHTML(false)}</div>`;

        // Grid View with 9 Slots
        if (grid) {
            grid.style.display = 'grid';
            let gridHTML = "";
            for (let i = 0; i < 9; i++) {
                gridHTML += `<div class="grid-item">${getEmptySlotHTML(true)}</div>`;
            }
            grid.innerHTML = gridHTML;
        }
    };

    // --- 5. INITIALIZE MAP & BACKEND ---
    const map = L.map('map').setView([40.7128, -74.0060], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    window.initBackend = function() {
        const profileBtn = document.getElementById('open-my-profile');
        if(profileBtn) {
            profileBtn.onclick = (e) => {
                e.preventDefault();
                document.getElementById('profile-modal').style.display = 'block';
                document.getElementById('user-dropdown').style.display = 'none';
            };
        }
        renderDeck();
        initArcade();
    };






// --- 6. PROFILE IMAGE UPLOADER ---
window.setupImageUpload = function() {
    const fileInput = document.getElementById('profile-upload'); // The hidden <input type="file">
    const uploadBtn = document.getElementById('upload-trigger'); // The plus sign button
    
    // UI Elements to update
    const headerIcon = document.querySelector('.user-icon'); // The small icon in top right
    const mainCircle = document.getElementById('profile-main-img'); // Main circle in modal
    const firstSlot = document.getElementById('gallery-slot-1'); // First slot in gallery

    if (!fileInput || !uploadBtn) return;

    // Trigger file picker when plus sign is clicked
    uploadBtn.onclick = () => fileInput.click();

    // Handle the file selection
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const imageUrl = event.target.result;

                // 1. Update the Main Profile Circle
                if (mainCircle) {
                    mainCircle.src = imageUrl;
                    mainCircle.style.objectFit = "cover";
                }

                // 2. Update the First Gallery Slot
                if (firstSlot) {
                    firstSlot.innerHTML = `<img src="${imageUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">`;
                }

                // 3. Update the Header Icon
                if (headerIcon) {
                    // If header icon is an <img>
                    if (headerIcon.tagName === 'IMG') {
                        headerIcon.src = imageUrl;
                    } else {
                        // If header icon is a div with a background
                        headerIcon.style.backgroundImage = `url(${imageUrl})`;
                        headerIcon.style.backgroundSize = "cover";
                        headerIcon.innerHTML = ''; // Clear any SVGs inside
                    }
                }
                
                // Optional: Save to localStorage so it persists on refresh
                localStorage.setItem('userProfilePic', imageUrl);
            };
            reader.readAsDataURL(file);
        }
    };
};

// Add this call inside your existing window.initBackend
const originalInit = window.initBackend;
window.initBackend = function() {
    originalInit();
    window.setupImageUpload();
};





    

    window.initBackend();
});

