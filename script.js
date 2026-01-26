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
        // 1. Create mock users if they don't exist
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

        // 2. Start the app processes
        updateBadge();
        renderDeck();
        loadWinks();
        
        // (We removed loadMyProfile() from here so it doesn't pop up instantly)

        setInterval(simulateRealTime, 5000);
        
        // 3. Setup Chat
        const sendBtn = document.querySelector('.chat-input-area button');
        if(sendBtn) sendBtn.onclick = sendMessage;

        const chatInput = document.querySelector('.chat-input');
        if(chatInput) {
            chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
        }

        // 4. Setup "My Profile" Button (This makes the dropdown click work)
        const profileBtn = document.getElementById('open-my-profile');
        if(profileBtn) {
            profileBtn.onclick = (e) => {
                e.preventDefault(); 
                window.loadMyProfile();
            };
        }




        // --- PASTE THIS AT THE END OF initBackend ---

        // 5. Load Saved Profile Picture into Header & Gallery
        const savedImg = localStorage.getItem('my_profile_pic');
        if (savedImg) {
            // Update Header Icon
            const headerIcon = document.getElementById('user-icon-trigger');
            if (headerIcon) {
                headerIcon.innerHTML = `<img src="${savedImg}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            }
            
            // Update Gallery Slot #1
            const galleryImg = document.getElementById('g1-preview');
            const galleryLabel = document.getElementById('g1-lbl');
            if (galleryImg) {
                galleryImg.src = savedImg;
                galleryImg.style.display = 'block';
                if(galleryLabel) galleryLabel.style.display = 'none';
            }
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
        
        // 1. Animate the card flying away
        card.style.transition = 'transform 0.5s ease-in';
        card.style.transform = `translateX(${dir === 'right' ? 1000 : -1000}px)`;

        // 2. MARK AS SEEN (This is the missing piece!)
        // Get the full list of users
        let allUsers = JSON.parse(localStorage.getItem('pgX_users'));
        
        // Find the current user we just swiped on (they are always at index 0 of activeDeck)
        if (activeDeck.length > 0) {
            let currentUserId = activeDeck[0].id;
            
            // Find them in the main storage list and mark seen = true
            let userIndex = allUsers.findIndex(u => u.id === currentUserId);
            if (userIndex > -1) {
                allUsers[userIndex].seen = true;
                localStorage.setItem('pgX_users', JSON.stringify(allUsers));
            }
        }

        // 3. Handle Visual Feedback (Wink)
        if (dir === 'right') {
            document.getElementById('wink-txt').classList.add('show');
            setTimeout(() => document.getElementById('wink-txt').classList.remove('show'), 1000);
        }

        // 4. Wait for animation to finish, then load the NEW deck
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
    // --- PASTE THIS RIGHT AFTER window.switchView ---

    // 1. Opens the main Connect Modal (Chat/Winks)
    window.openMsgModal = function() {
        document.getElementById('msg-modal').style.display = 'block';
    }

    // 2. Closes the modal and resets the view
    window.closeChat = function() {
        document.getElementById('msg-modal').style.display = 'none';
        // Reset to the main list (so it doesn't get stuck inside a conversation)
        document.getElementById('msg-list-view').style.display = 'block';
        document.getElementById('chat-view').style.display = 'none';
    }

    // 3. Handles switching between "Winks" and "Messages" tabs
    window.openTab = function(tabId, btn) {
        // Hide all tab content
        document.querySelectorAll('.tab-pane').forEach(t => t.style.display = 'none');
        // Remove 'active' color from all buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        
        // Show the specific tab you clicked
        document.getElementById(tabId).style.display = 'block';
        // Light up the button you clicked
        btn.classList.add('active');
    }
    





    // --- PASTE THIS IN SECTION 5 ---

    window.previewMainAndGallery = function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const imgUrl = e.target.result;

                // 1. Update Main Profile Circle
                document.getElementById('my-main-preview').src = imgUrl;

                // 2. Update Gallery Slot #1
                const galleryImg = document.getElementById('g1-preview');
                galleryImg.src = imgUrl;
                galleryImg.style.display = 'block'; // Make sure it is visible
                
                // Hide the "Star" label so we can see the photo
                const galleryLabel = document.getElementById('g1-lbl');
                if(galleryLabel) galleryLabel.style.display = 'none';

                // 3. Update Top Right Header Icon
                const headerIcon = document.getElementById('user-icon-trigger');
                // Replace the SVG icon with your new photo
                headerIcon.innerHTML = `<img src="${imgUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            }
            
            reader.readAsDataURL(file);
        }
    }





    

    // --- INSERT THIS CODE IN SECTION 5 ---

    window.openUserProfile = function(alias, age, img, id) {
        // 1. Target the Modal Elements based on your HTML IDs
        const modal = document.getElementById('view-user-modal');
        const imgMain = document.getElementById('view-user-img');
        const imgSmall = document.getElementById('view-user-img-small');
        const nameLabel = document.getElementById('view-user-name');
        const bioLabel = document.getElementById('view-user-bio');
        const chipsContainer = document.getElementById('view-user-chips');

        // 2. Inject the data passed from the card
        imgMain.src = img;
        imgSmall.src = img; // Set the gallery thumb too
        nameLabel.innerText = `${alias}, ${age}`;
        
        // 3. Generate some mock details (since we only passed basic info)
        // In a real app, you would use 'id' to fetch the full bio from Firebase here.
        bioLabel.innerText = `${alias} is a ${age} year old member looking for connections. (This is placeholder text until you connect the full database fetch).`;

        // 4. Reset and Add Chips (Tags)
        chipsContainer.innerHTML = ''; // Clear old tags
        const tags = ['Verified Member', 'New', 'Active Now'];
        tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'stat-chip'; // Uses your CSS class
            span.innerText = tag;
            chipsContainer.appendChild(span);
        });

        // 5. Show the Modal
        modal.style.display = 'block';
    }






    window.saveProfile = async function() {
        // 1. Grab values from inputs
        const aliasVal = document.getElementById('p-alias').value;
        const ageVal = document.getElementById('p-age').value;
        const bioVal = document.getElementById('p-bio').value;
        const imgVal = document.getElementById('my-main-preview').src;

        // 2. Save to LocalStorage (So it remembers you)
        localStorage.setItem('my_alias', aliasVal);
        localStorage.setItem('my_age', ageVal);
        localStorage.setItem('my_bio', bioVal);
        localStorage.setItem('my_profile_pic', imgVal);

        // 3. (Optional) Save to Firebase if connected
        let myUid = localStorage.getItem('pgX_myUid');
        if (window.fbase && window.db && myUid) {
            const { setDoc, doc } = window.fbase;
            await setDoc(doc(window.db, "users", myUid), {
                alias: aliasVal,
                age: ageVal,
                img: imgVal
            }, { merge: true });
        }

        // 4. Close Modal
        document.getElementById('profile-modal').style.display = 'none';
        alert("Profile Saved!");
    }


    

    window.loadMyProfile = function() {
        // 1. Read values from memory
        const storedAlias = localStorage.getItem('pgX_alias') || ""; 
        const storedBio = localStorage.getItem('pgX_bio') || "";
        const storedImg = localStorage.getItem('my_profile_pic') || "https://via.placeholder.com/120";

        // 2. Fill Inputs
        document.getElementById('p-alias').value = storedAlias;
        document.getElementById('p-bio').value = storedBio;
        
        // 3. Fill Images (Main + Gallery #1)
        document.getElementById('my-main-preview').src = storedImg;
        
        const galleryImg = document.getElementById('g1-preview');
        const galleryLabel = document.getElementById('g1-lbl');
        
        // If it's a real photo (not the placeholder), show it in gallery slot 1 too
        if (storedImg.includes('data:image') || storedImg.includes('http')) {
             galleryImg.src = storedImg;
             galleryImg.style.display = 'block';
             if(galleryLabel) galleryLabel.style.display = 'none';
        }

        // 4. Reveal Modal
        document.getElementById('profile-modal').style.display = 'block';
        document.getElementById('user-dropdown').style.display = 'none';
    }




    
    // Logic for loading winks and badges...
    function updateBadge() { /* ... Badge logic ... */ }
    function loadWinks() { /* ... Wink logic ... */ }


    // --- PASTE THIS AT THE BOTTOM OF YOUR SCRIPT ---

    



    
    function simulateRealTime() { /* ... Mock winks ... */ }



    // --- ARCADE CONFIGURATION ---
    const games = [
        { name: "Simple Pong", file: "Simplepong.html", thumb: "simplepong.jpg" },
        { name: "Speed Jump", file: "Speedjump.html", thumb: "speedjump.jpg" },
        { name: "Ghost Poke", file: "Ghostpoke.html", thumb: "Ghostpoke.jpg" }, // Note: check if this should be .jpg or .html for thumb
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











