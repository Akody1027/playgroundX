document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL VARIABLES ---
    let activeDeck = [];
    let card, startX, currentX, btnLike, btnReject;
    let currentChatUnsubscribe = null; 
    let currentChatId = null;
    let myUid = localStorage.getItem('pgX_myUid') || 'anon_' + Date.now();
    let myCoins = 0;

    // --- 1. INITIALIZATION ---

    window.initBackend = async function() {
        // 1. Initialize Leaflet Map
        window.map = L.map('map').setView([40.7128, -74.0060], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(window.map);

        // 2. Load Profile & Wallet
        await loadMyProfile();

        // 3. Load Deck (Real Users Only)
        renderDeck();

        // 4. Check for Live Users
        checkLiveUsers();

        // 5. Google Autocomplete (If Key exists)
        if(window.google && window.google.maps && window.google.maps.places) {
            initAutocomplete();
        }
    }

    // --- 2. PROFILE & WALLET LOGIC ---

    async function loadMyProfile() {
        if (!window.fbase || !window.db) return;
        const { doc, getDocs, collection } = window.fbase;
        
        // Load User Data
        // In a real app, you would fetch doc(window.db, "users", myUid)
        // For now, we load basic prefs from localStorage or DB if implemented
        
        // Load Wallet
        let savedCoins = localStorage.getItem('pgX_coins');
        myCoins = savedCoins ? parseInt(savedCoins) : 0;
        updateWalletUI();
    }

    window.updateWalletUI = function() {
        const bal = document.getElementById('disp-wallet');
        const h1 = document.querySelector('#acc-wallet h1');
        if(bal) bal.innerText = `Balance: ${myCoins} Coins`;
        if(h1) h1.innerText = myCoins;
    }

    window.buyCoins = function(amount) {
        // Simulating Payment Gateway
        const confirmPurchase = confirm(`Charge card for $${amount/100}?`);
        if(confirmPurchase) {
            myCoins += amount;
            localStorage.setItem('pgX_coins', myCoins);
            updateWalletUI();
            window.showToast(`+${amount} Coins Added!`);
        }
    }

    window.saveProfile = async function() {
        const alias = document.getElementById('p-alias').value || "Anonymous";
        const age = document.getElementById('p-age').value;
        const img = document.getElementById('my-main-preview').src;
        
        // Collect Love Languages (Multi-Select)
        let loveLangs = [];
        document.querySelectorAll('.p-love-chk:checked').forEach(cb => loveLangs.push(cb.value));

        const profileData = {
            id: myUid,
            alias: alias,
            age: age,
            img: img,
            gender: document.getElementById('disp-gender').innerText,
            loveLanguages: loveLangs,
            bio: document.getElementById('p-bio').value,
            location: document.getElementById('loc-input').value,
            isLive: false // Default
        };

        // Save to Local/DB
        localStorage.setItem('pgX_myUid', myUid);
        localStorage.setItem('my_profile_pic', img);

        if (window.fbase && window.db) {
            const { setDoc, doc } = window.fbase;
            await setDoc(doc(window.db, "users", myUid), profileData, { merge: true });
        }
        
        document.getElementById('profile-modal').style.display = 'none';
        window.showToast("Profile Saved");
    }

    // --- 3. DECK & SWIPE LOGIC (PRODUCTION READY) ---

    window.renderDeck = async function(isSuggestionMode = false) {
        const zone = document.getElementById('swipe-zone');
        const grid = document.getElementById('grid-content');

        // Show Skeleton Loading State
        zone.innerHTML = `
            <div class="ghost-card skeleton-pulse">
                <div style="width:80px; height:80px; border-radius:50%; background:#222; margin-bottom:20px;"></div>
                <div style="width:60%; height:20px; background:#222; border-radius:10px;"></div>
            </div>`;

        try {
            if (window.fbase && window.db) {
                const { getDocs, collection, query, where, limit } = window.fbase;
                
                // Construct Query based on filters
                let q;
                if(isSuggestionMode) {
                    // Suggestions: Get ANY users
                    q = query(collection(window.db, "users"), limit(20));
                } else {
                    // Strict: Apply filters (Example: Gender)
                    // Note: Real Firestore filtering requires composite indexes. 
                    // For now, we fetch all and filter in JS for simplicity in this demo.
                    q = collection(window.db, "users");
                }

                const querySnapshot = await getDocs(q);
                let realUsers = [];
                querySnapshot.forEach((doc) => {
                    let d = doc.data();
                    if(d.id !== myUid) realUsers.push(d);
                });

                // Apply Client-Side Filters (Strict Mode)
                if(!isSuggestionMode) {
                    const wantMen = document.getElementById('f-men').checked;
                    const wantWomen = document.getElementById('f-women').checked;
                    
                    realUsers = realUsers.filter(u => {
                        if(wantMen && u.gender === 'Man') return true;
                        if(wantWomen && u.gender === 'Woman') return true;
                        if(!wantMen && !wantWomen) return true; // No filter selected
                        return false;
                    });
                }

                activeDeck = realUsers;

            } else {
                activeDeck = []; // No DB connection
            }
        } catch (e) {
            console.error("Deck Error:", e);
            activeDeck = [];
        }

        // Render Cards
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

            // Populate Grid
            if (grid) {
                grid.innerHTML = activeDeck.map(u => `
                <div class="grid-item" onclick="window.openUserProfile('${u.alias}', ${u.age}, '${u.img}', '${u.id}')">
                    <img src="${u.img}" style="width:100%; height:100%; object-fit:cover;">
                    <div class="grid-overlay"><span>${u.alias}</span><span>${u.age}</span></div>
                </div>`).join('');
            }
        } else {
            // EMPTY STATE (Grey Outlines + Suggestions)
            zone.innerHTML = `
            <div class="ghost-card">
                <h3 style="margin-bottom:5px;">No Matches</h3>
                <p style="font-size:12px; margin-bottom:20px;">Try adjusting your filters.</p>
                <button onclick="document.getElementById('filter-modal').style.display='block'" style="background:var(--accent); border:none; color:white; padding:10px 20px; border-radius:20px; margin-bottom:10px; cursor:pointer;">Adjust Filters</button>
                <button onclick="window.renderDeck(true)" style="background:none; border:1px solid #555; color:#888; padding:10px 20px; border-radius:20px; cursor:pointer;">See Suggestions</button>
            </div>`;
            if(grid) grid.innerHTML = `<p style="text-align:center; color:#555; grid-column:span 3; margin-top:50px;">No users found.</p>`;
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
        // Remove from deck and re-render
        setTimeout(() => { 
            resetButtons(); 
            activeDeck.shift(); 
            // Re-render with remaining logic handled inside renderDeck if we were passing array, 
            // but here we just call renderDeck to fetch/refresh.
            // For smoother UX in production, we would manipulate DOM directly, but this is safe:
            renderDeck(); 
        }, 300);
    }

    function resetButtons() {
        if (btnLike) btnLike.style.background = 'rgba(0,0,0,0.6)';
        if (btnReject) btnReject.style.background = 'rgba(0,0,0,0.6)';
    }

    // --- 4. LIVE & VIDEO LOGIC ---

    window.openGoLive = function() {
        document.getElementById('go-live-modal').style.display = 'block';
    }

    window.startBroadcasting = async function() {
        const title = document.getElementById('stream-title').value;
        if(!title) return alert("Please enter a title");

        // Set status in DB
        if (window.fbase && window.db) {
            const { setDoc, doc } = window.fbase;
            await setDoc(doc(window.db, "users", myUid), { isLive: true, streamTitle: title }, { merge: true });
        }

        document.getElementById('go-live-modal').style.display = 'none';
        // Open the viewer as "Broadcaster Mode" (Simulated)
        openLiveViewer(true, title);
    }

    window.checkLiveUsers = async function() {
        // In production: Query users where isLive == true
        // For demo, we leave the bar hidden until someone goes live
        // Logic: if users found, document.getElementById('live-now-bar').style.display = 'flex';
    }

    window.openLiveViewer = function(isBroadcaster, title) {
        const modal = document.getElementById('live-viewer-modal');
        const video = document.getElementById('live-video-player');
        
        modal.style.display = 'block';
        
        // Mock Video Source (Replace with WebRTC stream URL)
        // Using a stock video for demo
        video.src = "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-1232-large.mp4"; 
        video.play();

        document.getElementById('live-viewer-count').innerText = isBroadcaster ? "👁 1.2k" : "👁 15";
        
        const chatBox = document.getElementById('live-chat-box');
        chatBox.innerHTML = `<div class="live-msg" style="color:#aaa;"><i>Welcome to the stream!</i></div>`;
    }

    window.closeLive = function() {
        document.getElementById('live-viewer-modal').style.display = 'none';
        document.getElementById('live-video-player').pause();
    }

    window.toggleGiftMenu = function() {
        const menu = document.getElementById('gift-menu');
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }

    window.sendGift = function(cost) {
        if(myCoins >= cost) {
            myCoins -= cost;
            localStorage.setItem('pgX_coins', myCoins);
            updateWalletUI();
            
            // Show Animation
            const chatBox = document.getElementById('live-chat-box');
            const msg = document.createElement('div');
            msg.className = 'live-msg';
            msg.innerHTML = `<b style="color:#FFD700">YOU</b> sent ${cost} Coins! 🎁`;
            chatBox.appendChild(msg);
            chatBox.scrollTop = chatBox.scrollHeight;
            
            window.toggleGiftMenu();
        } else {
            window.showToast("Not enough coins! Top up in Wallet.");
        }
    }

    // --- 5. UTILITIES & UI HELPERS ---

    window.showToast = function(text) {
        const t = document.getElementById('toast-notification');
        t.innerText = text;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2000);
    }

    window.switchView = function(viewId, btn) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');
        btn.classList.add('active');
        if (viewId === 'map') setTimeout(() => window.map.invalidateSize(), 100);
    }

    window.toggleAccordion = function(id, forceState) {
        const el = document.getElementById(id);
        if (forceState !== undefined) {
            el.style.display = forceState ? 'block' : 'none';
        } else {
            el.style.display = (el.style.display === 'block') ? 'none' : 'block';
        }
    }

    window.selectProfileOption = function(dispId, val, accId) {
        document.getElementById(dispId).innerText = val;
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

    // --- 6. USER PROFILE & REPORT ---
    window.openUserProfile = function(alias, age, img, uid) {
        document.getElementById('view-user-modal').style.display = 'block';
        document.getElementById('view-user-img').src = img;
        document.getElementById('view-user-name').innerText = `${alias}, ${age}`;
        // Populate dummy chips/bio for now or fetch from DB
        document.getElementById('view-user-bio').innerText = "Loading bio...";
        if(window.fbase && window.db) {
            const { getDoc, doc } = window.fbase;
            // Fetch detailed bio logic would go here
        }
    }

    window.toggleReportMenu = function() {
        const menu = document.getElementById('report-menu');
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }

    // --- 7. GOOGLE PLACES PLACEHOLDER ---
    function initAutocomplete() {
        const input = document.getElementById('loc-input');
        if(!input) return;
        // const autocomplete = new google.maps.places.Autocomplete(input, { types: ['(cities)'] });
        // autocomplete.addListener('place_changed', () => { ... });
        console.log("Google Places Ready (Requires API Key)");
    }

    // START APP
    initBackend();

});
