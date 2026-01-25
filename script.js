document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION & GLOBAL STATE ---
    let activeDeck = [];
    let card, startX, currentX, btnLike, btnReject;
    let currentChatUnsubscribe = null; 
    let currentChatId = null; 

    // --- HELPER FOR EMPTY SLOTS (GRID) ---
    function getEmptySlotHTML() {
        return `
            <div class="grid-item" style="border: 1px dashed #444; background: #1a1a1a; display: flex; align-items: center; justify-content: center; aspect-ratio: 1/1;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
                </svg>
            </div>
        `;
    }

    // --- 1. CORE BACKEND & INITIALIZATION ---
    window.initBackend = function() {
        if (!localStorage.getItem('pgX_users')) {
            localStorage.setItem('pgX_users', JSON.stringify([]));
        }
        
        // FIX: Make "My Profile" link clickable in the dropdown
        const profileBtn = document.getElementById('open-my-profile');
        if(profileBtn) {
            profileBtn.onclick = (e) => {
                e.preventDefault();
                document.getElementById('profile-modal').style.display = 'block';
                document.getElementById('user-dropdown').style.display = 'none';
            };
        }

        renderDeck();
        
        // Setup Chat Listeners
        const sendBtn = document.querySelector('.chat-input-area button');
        if(sendBtn) sendBtn.onclick = sendMessage;
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
        } catch (e) { console.log("Database not connected yet."); }

        activeDeck = usersToShow;

        // Render Swipe Zone Placeholder
        if (activeDeck.length === 0) {
            zone.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; color:#444; height:100%;">
                    <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <p style="font-size:10px; font-weight:bold; margin-top:10px; letter-spacing:1px;">WAITING FOR USERS...</p>
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

        // Render Grid View with Top-Row Dummy Logic
        if (grid) {
            grid.style.display = 'grid';
            let gridHTML = activeDeck.map(u => `
                <div class="grid-item">
                    <img src="${u.img}" style="width:100%; height:100%; object-fit:cover;">
                    <div class="grid-overlay"><span>${u.alias}</span></div>
                </div>
            `).join('');
            
            // Fill up to at least 6 slots with empty placeholders
            let minSlots = 6;
            let currentCount = activeDeck.length;
            if (currentCount < minSlots) {
                for (let i = 0; i < (minSlots - currentCount); i++) {
                    gridHTML += getEmptySlotHTML();
                }
            }
            grid.innerHTML = gridHTML;
        }
    };

    // --- 3. CONNECT DASHBOARD (TAB SWITCHING) ---
    window.openTab = function(tabId, btn) {
        // Hide all panes and remove active from all buttons
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        
        // Show selected pane and highlight button
        document.getElementById(tabId).classList.add('active');
        btn.classList.add('active');
    };

    // --- 4. NAVIGATION & HEADER CONTROLS ---
    window.switchView = function(viewId, btn) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');
        btn.classList.add('active');
        if (viewId === 'map') setTimeout(() => map.invalidateSize(), 100);
    };

    window.toggleUserMenu = function() {
        const menu = document.getElementById('user-dropdown');
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    };

    window.openMsgModal = function() {
        document.getElementById('msg-modal').style.display = 'block';
    };

    window.closeChat = function() {
        document.getElementById('msg-modal').style.display = 'none';
        // Reset to list view for next time
        document.getElementById('msg-list-view').style.display = 'block';
        document.getElementById('chat-view').style.display = 'none';
    };

    // --- 5. INITIALIZE ---
    window.initBackend();
});
