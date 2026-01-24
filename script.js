document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION & GLOBAL STATE ---
    const ALIAS_PRE = ['Jay', 'Cool', 'Wild', 'Soft', 'Dark', 'Light', 'Neo', 'Retro'];
    const ALIAS_SUF = ['Rocker', 'Vibes', 'Soul', 'King', 'Queen', 'X', '99', 'Walker'];
    const IMGS_F = ['https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500'];
    const IMGS_M = ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500', 'https://images.unsplash.com/photo-1480455624313-e29b44bbfde1?w=500'];
    const DATA_REL_TYPE = ['Marriage', 'Long-Term', 'Short-Term', 'Intimacy w/o Connection', 'Friends', 'FWB'];

    let activeDeck = [];
    let card, startX, currentX, btnLike, btnReject;
    let currentChatUnsubscribe = null; // To stop listening when chat closes
    let currentChatId = null; // The ID of the person we are talking to
    let jessRead = false; // Legacy state for the demo message

    // --- 1. CORE BACKEND & INITIALIZATION ---

    window.initBackend = function() {
        if (!localStorage.getItem('pgX_users')) {
            let users = [];
            for (let i = 0; i < 30; i++) {
                let isFem = Math.random() > 0.5;
                let isExplicit = Math.random() < 0.2;
                users.push({
                    id: 'mock_' + i, // consistent string ID
                    alias: ALIAS_PRE[Math.floor(Math.random() * 8)] + "_" + ALIAS_SUF[Math.floor(Math.random() * 8)],
                    age: Math.floor(Math.random() * 15) + 18,
                    gender: isFem ? 'Woman' : 'Man',
                    img: isFem ? IMGS_F[Math.floor(Math.random() * IMGS_F.length)] : IMGS_M[Math.floor(Math.random() * IMGS_M.length)],
                    lat: 40.7128 + (Math.random() - 0.5) * 0.05,
                    lng: -74.0060 + (Math.random() - 0.5) * 0.05,
                    isExplicit: isExplicit,
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
        loadMyProfile(); // Load profile pic on start
        setInterval(simulateRealTime, 5000);
        
        // Attach listener to the Send button dynamically
        const sendBtn = document.querySelector('.chat-input-area button');
        if(sendBtn) {
            sendBtn.onclick = sendMessage;
        }
        // Attach listener to Enter key in chat input
        const chatInput = document.querySelector('.chat-input');
        if(chatInput) {
            chatInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') sendMessage();
            });
        }
    }

    function simulateRealTime() {
        let users = JSON.parse(localStorage.getItem('pgX_users'));
        let chance = Math.random();
        if (chance < 0.3) {
            let target = users[Math.floor(Math.random() * users.length)];
            if (!target.winkedAtMe) {
                target.winkedAtMe = true;
                localStorage.setItem('pgX_users', JSON.stringify(users));
                // Sound logic kept silent for production readiness unless requested
                updateBadge();
                loadWinks();
            }
        }
    }

    // --- 2. DECK & SWIPE LOGIC ---

    window.renderDeck = async function() {
        const zone = document.getElementById('swipe-zone');
        const grid = document.getElementById('grid-content');

        // Try to get REAL users from Cloud
        try {
            if (window.fbase && window.db) {
                const { getDocs, collection } = window.fbase;
                // Note: In production, we would use a geo-query here
                const querySnapshot = await getDocs(collection(window.db, "users"));
                let realUsers = [];
                querySnapshot.forEach((doc) => {
                    realUsers.push(doc.data());
                });

                if (realUsers.length > 0) {
                    let myUid = localStorage.getItem('pgX_myUid');
                    activeDeck = realUsers.filter(u => u.id !== myUid);
                } else {
                     // Fallback to local if cloud is empty
                    activeDeck = JSON.parse(localStorage.getItem('pgX_users')).filter(u => !u.seen);
                }
            } else {
                 activeDeck = JSON.parse(localStorage.getItem('pgX_users')).filter(u => !u.seen);
            }
        } catch (e) {
            console.log("Offline/Mode: Using local deck");
            activeDeck = JSON.parse(localStorage.getItem('pgX_users')).filter(u => !u.seen);
        }

        if (activeDeck.length > 0) {
            const u = activeDeck[0];
            zone.innerHTML = `
            <div class="swipe-card" id="active-card" onclick="openUserProfile('${u.alias}', ${u.age}, '${u.img}', '${u.id}')">
                <img src="${u.img}" alt="User">
                <div class="card-header-overlay">
                    <span class="card-alias">${u.alias}</span>
                    <span class="card-age">${u.age}</span>
                </div>
            </div>`;
            setTimeout(initSwipeHandlers, 50);
        } else {
            zone.innerHTML = `<div style="text-align:center;color:#666;margin-top:100px;"><h3>Searching...</h3><p>No new users nearby.</p><button onclick="window.location.reload()" style="background:var(--accent);border:none;color:white;padding:10px;border-radius:8px;margin-top:10px;">Refresh</button></div>`;
        }

        if (grid) {
            grid.innerHTML = activeDeck.map(u => `
            <div class="grid-item" onclick="openUserProfile('${u.alias}', ${u.age}, '${u.img}', '${u.id}')">
                <img src="${u.img}" style="width:100%; height:100%; object-fit:cover;">
                <div class="grid-overlay"><span>${u.alias}</span><span>${u.age}</span></div>
            </div>
        `).join('');
        }
    }

    function initSwipeHandlers() {
        card = document.getElementById('active-card');
        btnReject = document.getElementById('btn-reject');
        btnLike = document.getElementById('btn-like');

        if (!card || !btnReject || !btnLike) return;

        card.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            card.style.transition = 'none';
        });
        card.addEventListener('touchmove', (e) => {
            currentX = e.touches[0].clientX - startX;
            card.style.transform = `translateX(${currentX}px) rotate(${currentX / 15}deg)`;
            if (currentX > 0) {
                btnLike.style.background = 'var(--accent)';
                btnLike.style.color = 'var(--btnfont)';
            } else {
                btnReject.style.background = 'var(--btn-dim)';
            }
        });
        card.addEventListener('touchend', () => {
            if (currentX > 100) window.userSwipe('right');
            else if (currentX < -100) window.userSwipe('left');
            else {
                card.style.transform = 'translateX(0)';
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

        // Mark as seen
        if (activeDeck.length > 0) {
            let users = JSON.parse(localStorage.getItem('pgX_users'));
            // Find user in local storage to mark seen (mock logic)
            // In real prod, we would add to a 'swipes' collection in Firestore
            let target = users.find(u => u.id === activeDeck[0].id);
            if (target) {
                target.seen = true;
                localStorage.setItem('pgX_users', JSON.stringify(users));
            }
        }
        setTimeout(() => {
            resetButtons();
            renderDeck();
        }, 300);
    }

    function resetButtons() {
        if (btnLike) btnLike.style.background = 'rgba(0,0,0,0.6)';
        if (btnReject) btnReject.style.background = 'rgba(0,0,0,0.6)';
    }

    // --- 3. MAP LOGIC ---
    // Initialize map immediately but handle size invalidation on view switch
    const map = L.map('map').setView([40.7128, -74.0060], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    const myIcon = L.divIcon({ className: 'my-location-pin', iconSize: [20, 20] });
    let myMarker = L.marker([40.7128, -74.0060], { icon: myIcon, draggable: true }).addTo(map);

    function refreshMapPins() {
        let users = JSON.parse(localStorage.getItem('pgX_users')) || [];
        users.forEach(u => {
            let uIcon = L.divIcon({ className: 'user-dot-pin', iconSize: [12, 12] });
            if (u.lat) L.marker([u.lat, u.lng], { icon: uIcon }).addTo(map).on('click', () => window.openUserProfile(u.alias, u.age, u.img, u.id));
        });
    }
    refreshMapPins();

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            myMarker.setLatLng([latitude, longitude]);
            map.setView([latitude, longitude], 14);
        }, err => console.log('GPS Error (likely HTTP):', err));
    }


    // --- 4. REAL-TIME CHAT SYSTEM (UPDATED) ---

    // Open Chat from List
    window.openChatWrapper = function(name, elementId, targetUid) {
        const el = document.getElementById(elementId);
        if (el) el.classList.remove('unread');
        
        // Logic for the static 'Jess' demo
        if (name === 'Jess_Vibes') jessRead = true;

        updateBadge();
        window.openChat(name, targetUid);
    }

    window.openChat = function(name, targetUid) {
        // Switch Views
        document.getElementById('msg-list-view').style.display = 'none';
        document.getElementById('chat-view').style.display = 'flex';
        document.getElementById('chat-target-name').innerText = name;
        
        const chatBody = document.getElementById('chat-body');
        chatBody.innerHTML = ''; // Clear previous chat
        
        currentChatId = targetUid; // Set current target

        // 1. Check if we have Firebase tools
        if (window.fbase && window.db && targetUid) {
            const { collection, query, orderBy, onSnapshot, limit } = window.fbase;
            let myUid = localStorage.getItem('pgX_myUid') || 'anon';
            
            // Construct a unique Chat ID (alphabetical to ensure both users get same ID)
            const chatId = [myUid, targetUid].sort().join('_');
            
            // Create query
            const q = query(collection(window.db, "chats", chatId, "messages"), orderBy("createdAt"), limit(50));
            
            // Listen
            currentChatUnsubscribe = onSnapshot(q, (snapshot) => {
                chatBody.innerHTML = ''; // Re-render (simple approach for safety)
                snapshot.forEach((doc) => {
                    const msg = doc.data();
                    const isMe = msg.senderId === myUid;
                    const bubble = document.createElement('div');
                    bubble.className = `chat-bubble ${isMe ? 'me' : 'them'}`;
                    bubble.innerText = msg.text;
                    chatBody.appendChild(bubble);
                });
                chatBody.scrollTop = chatBody.scrollHeight; // Auto scroll to bottom
            });
        } else {
            // FALLBACK: If no backend or it's the 'Jess' mock
            chatBody.innerHTML = `
                <div class="chat-bubble them">Hey! How are you?</div>
                <div class="chat-bubble me">I'm good! Just swiping around.</div>
                <div style="text-align:center; color:#555; font-size:12px; margin-top:20px;">Real-time connection not active for this demo user.</div>
            `;
        }
    }

    // Send Message Function
    async function sendMessage() {
        const input = document.querySelector('.chat-input');
        const text = input.value.trim();
        if (!text) return;

        // 1. Check Firebase connection
        if (window.fbase && window.db && currentChatId) {
            const { collection, addDoc, serverTimestamp } = window.fbase;
            let myUid = localStorage.getItem('pgX_myUid') || 'anon';
            const chatId = [myUid, currentChatId].sort().join('_');

            try {
                await addDoc(collection(window.db, "chats", chatId, "messages"), {
                    text: text,
                    senderId: myUid,
                    createdAt: serverTimestamp() // Uses server time
                });
                input.value = ''; // Clear input
            } catch (e) {
                console.error("Error sending message:", e);
                alert("Could not send. Check internet.");
            }
        } else {
            // Mock Behavior
            const chatBody = document.getElementById('chat-body');
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble me';
            bubble.innerText = text;
            chatBody.appendChild(bubble);
            input.value = '';
            chatBody.scrollTop = chatBody.scrollHeight;
        }
    }

    window.closeChat = function() {
        if (document.getElementById('chat-view').style.display === 'flex') {
            // Stop listening to Firestore to save data
            if(currentChatUnsubscribe) {
                currentChatUnsubscribe();
                currentChatUnsubscribe = null;
            }
            document.getElementById('chat-view').style.display = 'none';
            document.getElementById('msg-list-view').style.display = 'block';
        } else {
            document.getElementById('msg-modal').style.display = 'none';
        }
    }


    // --- 5. UI & UTILITIES ---

    window.openMsgModal = function() {
        document.getElementById('msg-modal').style.display = 'block';
        document.getElementById('msg-list-view').style.display = 'block';
        document.getElementById('chat-view').style.display = 'none';
        loadWinks();
    };

    function updateBadge() {
        let users = JSON.parse(localStorage.getItem('pgX_users')) || [];
        let unreadWinks = users.filter(u => u.winkedAtMe && !u.winkRead).length;
        let totalUnread = unreadWinks + (jessRead ? 0 : 1);

        const badge = document.getElementById('msg-badge');
        const jessExists = document.getElementById('msg-jess');
        if (!jessExists && jessRead === false) totalUnread--; 

        badge.innerText = totalUnread;
        badge.style.display = totalUnread > 0 ? 'flex' : 'none';
    }

    function loadWinks() {
        let users = JSON.parse(localStorage.getItem('pgX_users')) || [];
        let winks = users.filter(u => u.winkedAtMe);

        document.getElementById('tab-winks').innerHTML = winks.map(u => `
        <div class="msg-item ${u.winkRead ? '' : 'unread'}" 
             onclick="window.markWinkRead('${u.id}'); window.openUserProfile('${u.alias}', ${u.age}, '${u.img}', '${u.id}'); document.getElementById('msg-modal').style.display='none'">
            <img src="${u.img}" class="msg-avatar">
            <div>
                <h3 style="margin:0;color:white;font-size:14px;">${u.alias}</h3>
                <p style="margin:0;color:#888;font-size:12px;">Winked at you!</p>
            </div>
            <button class="delete-btn" onclick="window.askToDelete(event, 'wink', '${u.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </div>
    `).join('');
    }

    window.openUserProfile = function(alias, age, imgUrl, id) {
        let users = JSON.parse(localStorage.getItem('pgX_users'));
        let u = users.find(usr => usr.id == id) || { relationship: 'Fun', bio: 'Just exploring.' };
        
        document.getElementById('view-user-name').innerText = alias;
        document.getElementById('view-user-img').src = imgUrl;
        document.getElementById('view-user-img-small').src = imgUrl;
        
        // Sticky action button needs to trigger chat with this ID
        // We find the Message button in the User Profile Modal (it's the second button)
        const actionBtns = document.querySelectorAll('.sticky-actions .action-btn-main');
        if(actionBtns.length > 1) {
             actionBtns[1].onclick = function() { 
                 document.getElementById('view-user-modal').style.display = 'none';
                 window.openMsgModal();
                 window.openChat(alias, id); 
             };
        }

        if (u) {
            document.getElementById('view-user-chips').innerHTML = `<div class="stat-chip">${u.relationship || 'Fun'}</div><div class="stat-chip love">❤️ Physical Touch</div>`;
            document.getElementById('view-user-bio').innerText = u.bio;
        }
        document.getElementById('view-user-modal').style.display = 'block';
    }

    window.toggleReportMenu = function() { let m = document.getElementById('report-menu'); m.style.display = m.style.display === 'block' ? 'none' : 'block'; }
    window.toggleUserMenu = function() { let m = document.getElementById('user-dropdown'); m.style.display = m.style.display === 'block' ? 'none' : 'block'; };

    window.toggleAccordion = function(id, isChecked) { document.getElementById(id).style.display = isChecked ? 'block' : 'none'; }
    
    window.applyFilters = function() {
        const filters = { men: document.getElementById('f-men').checked, women: document.getElementById('f-women').checked };
        localStorage.setItem('pgX_filters', JSON.stringify(filters));
        document.getElementById('filter-modal').style.display = 'none';
        renderDeck();
    }

    window.saveProfile = async function() {
        let myUid = localStorage.getItem('pgX_myUid');
        if (!myUid) {
            myUid = 'user_' + Date.now();
            localStorage.setItem('pgX_myUid', myUid);
        }

        const profileData = {
            id: myUid,
            alias: document.getElementById('p-alias').value || "Anonymous",
            bio: document.getElementById('p-bio').value || "",
            age: document.getElementById('p-age').value,
            gender: document.getElementById('disp-gender').innerText,
            img: document.getElementById('my-main-preview').src,
            lat: 40.7128 + (Math.random() - 0.5) * 0.1,
            lng: -74.0060 + (Math.random() - 0.5) * 0.1,
            isExplicit: document.getElementById('p-explicit').checked
        };

        if (profileData.img && !profileData.img.includes('via.placeholder')) {
            localStorage.setItem('my_profile_pic', profileData.img);
        }
        localStorage.setItem('my_full_profile', JSON.stringify(profileData));

        const headerIcon = document.getElementById('user-icon-trigger');
        if (profileData.img && !profileData.img.includes('via.placeholder')) {
            headerIcon.innerHTML = `<img src="${profileData.img}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            headerIcon.style.border = '2px solid var(--accent)';
        }
        document.getElementById('profile-modal').style.display = 'none';
        alert("Profile Saved!");

        // Cloud Sync
        try {
            if (window.fbase && window.db) {
                const { setDoc, doc } = window.fbase;
                await setDoc(doc(window.db, "users", myUid), profileData, { merge: true });
            }
        } catch (e) {
            console.warn("Cloud sync failed (offline?):", e);
        }
    }

    window.switchView = function(viewId, btn) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');
        btn.classList.add('active');
        if (viewId === 'map') setTimeout(() => map.invalidateSize(), 100);
    }

    window.openTab = function(tabId, btn) {
        document.getElementById('msg-list-view').style.display = 'block';
        document.getElementById('chat-view').style.display = 'none';
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        btn.classList.add('active');
    }

    window.previewMainAndGallery = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function() {
            const result = reader.result;
            document.getElementById('my-main-preview').src = result;
            const g1 = document.getElementById('g1-preview');
            g1.src = result;
            g1.style.display = 'block';
            document.getElementById('g1-lbl').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
    
    window.previewVideo = function(e) { 
        const v = document.getElementById('vid-preview'); 
        v.src = URL.createObjectURL(e.target.files[0]); 
        v.style.display = 'block'; 
        v.previousElementSibling.style.display='none'; 
    }

    // --- 6. UTILS: DELETE, CONFIRM, DROPDOWNS ---

    let pendingDelete = null;
    window.askToDelete = function(event, type, id) {
        event.stopPropagation();
        pendingDelete = { type: type, id: id };
        document.getElementById('confirm-modal').style.display = 'flex';
    }

    window.closeConfirm = function() {
        document.getElementById('confirm-modal').style.display = 'none';
        pendingDelete = null;
    }

    window.confirmYes = function() {
        if (!pendingDelete) return;
        if (pendingDelete.type === 'wink') {
            let users = JSON.parse(localStorage.getItem('pgX_users'));
            let target = users.find(u => u.id == pendingDelete.id);
            if (target) {
                target.winkedAtMe = false;
                localStorage.setItem('pgX_users', JSON.stringify(users));
                loadWinks();
                updateBadge();
            }
        } else if (pendingDelete.type === 'msg') {
            const el = document.getElementById(pendingDelete.id);
            if (el) el.remove();
        }
        closeConfirm();
    }

    window.markWinkRead = function(id) {
        let users = JSON.parse(localStorage.getItem('pgX_users'));
        let target = users.find(u => u.id == id);
        if (target) {
            target.winkRead = true;
            localStorage.setItem('pgX_users', JSON.stringify(users));
            updateBadge();
        }
    }

    window.toggleProfileAcc = function(id) {
        const el = document.getElementById(id);
        document.querySelectorAll('.accordion-content').forEach(d => {
            if (d.id !== id) d.style.display = 'none';
        });
        el.style.display = el.style.display === 'block' ? 'none' : 'block';
    }

    window.selectProfileOption = function(displayId, value, accordionId) {
        document.getElementById(displayId).innerText = value;
        document.getElementById(displayId).style.color = 'var(--accent)';
        document.getElementById(accordionId).style.display = 'none';
    }

    function loadMyProfile() {
        const savedImg = localStorage.getItem('my_profile_pic');
        if (savedImg) {
            const headerIcon = document.getElementById('user-icon-trigger');
            if(headerIcon) {
                headerIcon.innerHTML = `<img src="${savedImg}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                headerIcon.style.border = '2px solid var(--accent)';
            }
            const myPreview = document.getElementById('my-main-preview');
            if(myPreview) myPreview.src = savedImg;
            
            const g1 = document.getElementById('g1-preview');
            if(g1) {
                g1.src = savedImg;
                g1.style.display = 'block';
                document.getElementById('g1-lbl').style.display = 'none';
            }
        }
    }

    // --- EVENT LISTENERS FOR CLICKS OUTSIDE ---
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#user-dropdown') && !e.target.closest('#user-icon-trigger')) {
            const el = document.getElementById('user-dropdown');
            if(el) el.style.display = 'none';
        }
        if (!e.target.closest('#report-menu') && !e.target.closest('button[onclick="toggleReportMenu()"]')) {
             const el = document.getElementById('report-menu');
             if(el) el.style.display = 'none';
        }
    });

    const openProfileBtn = document.getElementById('open-my-profile');
    if(openProfileBtn) {
        openProfileBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('user-dropdown').style.display = 'none';
            document.getElementById('profile-modal').style.display = 'block';
        });
    }

    // Initialize
    initBackend();
});