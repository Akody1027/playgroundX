document.addEventListener('DOMContentLoaded', () => {

    // --- STATE VARIABLES ---
    let allUsers = [];     
    let activeDeck = [];   
    let currentSwipeIndex = 0;
    let swipeCount = parseInt(localStorage.getItem('pgX_swipeCount')) || 0;
    
    // --- INIT ---
    function init() {
        // SAFETY: Force Modals Closed
        if(document.getElementById('confirm-modal')) document.getElementById('confirm-modal').style.display = 'none';
        if(document.getElementById('save-modal')) document.getElementById('save-modal').style.display = 'none';
        
        // Update Counter
        const counterEl = document.getElementById('swipe-counter');
        if(counterEl) counterEl.innerText = `📊 ${swipeCount} Swipes`;

        // Load Mock Data if empty
        if (!localStorage.getItem('pgX_users_v3')) {
            generateMockUsers();
        }
        allUsers = JSON.parse(localStorage.getItem('pgX_users_v3'));
        
        // Initial Render
        renderDeck();
        initMap();
    }

    // --- MOCK DATA (Includes Vices & Kids) ---
    function generateMockUsers() {
        const mocks = [];
        const names = ['Jay', 'Sarah', 'Mike', 'Jess', 'Alex', 'Sam', 'Jordan', 'Taylor'];
        for(let i=0; i<30; i++){
            mocks.push({
                id: `u_${i}`,
                name: names[i % 8] + '_' + Math.floor(Math.random()*100),
                age: 18 + Math.floor(Math.random()*25),
                gender: Math.random() > 0.5 ? 'Man' : 'Woman',
                img: `https://images.unsplash.com/photo-${1500000000000 + i}?w=500&auto=format&fit=crop`,
                lat: 40.7128 + (Math.random() - 0.5) * 0.1,
                lng: -74.0060 + (Math.random() - 0.5) * 0.1,
                smoker: Math.random() > 0.8, // 20% are smokers
                drinker: Math.random() > 0.5,
                hasKids: Math.random() > 0.7
            });
        }
        localStorage.setItem('pgX_users_v3', JSON.stringify(mocks));
    }

    // --- FILTER & RENDER LOGIC (Strict Matching) ---
    window.renderDeck = function(ignoreFilters = false) {
        const zone = document.getElementById('swipe-zone');
        if(!zone) return;
        
        // 1. Get Filter Values
        const fMen = document.getElementById('f-men').checked;
        const fWomen = document.getElementById('f-women').checked;
        const minAge = parseInt(document.getElementById('f-min-age').value) || 18;
        const maxAge = parseInt(document.getElementById('f-max-age').value) || 99;
        
        // 2. Deal Breakers
        const noSmokers = document.getElementById('f-no-smoke').checked;
        const noDrinkers = document.getElementById('f-no-drink').checked;
        const noKids = document.getElementById('f-no-kids').checked;

        // 3. Filter List
        if (ignoreFilters) {
            activeDeck = allUsers;
        } else {
            activeDeck = allUsers.filter(u => {
                // Gender
                if (u.gender === 'Man' && !fMen) return false;
                if (u.gender === 'Woman' && !fWomen) return false;
                // Age
                if (u.age < minAge || u.age > maxAge) return false;
                // Vices (Strict Exclusion)
                if (noSmokers && u.smoker) return false;
                if (noDrinkers && u.drinker) return false;
                if (noKids && u.hasKids) return false;
                
                return true;
            });
        }

        // 4. Render Card (Stack Style)
        if (activeDeck.length > 0 && currentSwipeIndex < activeDeck.length) {
            const u = activeDeck[currentSwipeIndex];
            zone.innerHTML = `
                <div class="stack-back"></div>
                <div class="swipe-card" id="active-card">
                    <img src="${u.img}" onerror="this.src='https://via.placeholder.com/400'">
                    <div class="card-header-overlay">
                        <span class="card-alias">${u.name}</span>
                        <span class="card-age">${u.age}</span>
                    </div>
                </div>
            `;
            initSwipeGestures();
        } else {
            // EMPTY STATE
            zone.innerHTML = `
                <div class="skeleton-card">
                    <div class="skeleton-pulse"></div>
                    <h3 style="margin:0; color:#eee;">No Matches Found</h3>
                    <p style="font-size:12px; margin-bottom:20px;">Try adjusting your filters.</p>
                    <button onclick="document.getElementById('filter-modal').style.display='block'" style="background:#333; color:white; border:none; padding:10px 20px; border-radius:8px; margin-bottom:10px; cursor:pointer;">Adjust Filters</button>
                    <button onclick="window.renderDeck(true)" style="background:var(--accent); color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer;">Show Suggestions</button>
                </div>
            `;
        }

        // 5. Update Grid
        const grid = document.getElementById('grid-content');
        if(grid) {
            grid.innerHTML = activeDeck.map(u => `
                <div class="grid-item" onclick="window.openUserModal('${u.name}', '${u.img}', ${u.smoker}, ${u.hasKids})">
                    <img src="${u.img}" style="width:100%;height:100%;object-fit:cover;">
                    <div class="grid-overlay"><span>${u.name}</span></div>
                </div>
            `).join('');
        }
    }

    window.applyFilters = function() {
        currentSwipeIndex = 0; // Reset stack
        document.getElementById('filter-modal').style.display = 'none';
        renderDeck();
    }

    // --- SWIPE GESTURES ---
    function initSwipeGestures() {
        const card = document.getElementById('active-card');
        if(!card) return;

        let startX = 0, currentX = 0;

        const start = (x) => { startX = x; card.style.transition = 'none'; };
        const move = (x) => {
            currentX = x - startX;
            card.style.transform = `translateX(${currentX}px) rotate(${currentX/15}deg)`;
            
            const btnLike = document.getElementById('btn-like');
            const btnReject = document.getElementById('btn-reject');
            if(btnLike && btnReject) {
                if(currentX > 50) btnLike.style.background = 'var(--accent)';
                else if(currentX < -50) btnReject.style.background = '#666';
            }
        };
        const end = () => {
            if(currentX > 100) window.userSwipe('right');
            else if(currentX < -100) window.userSwipe('left');
            else {
                card.style.transition = 'transform 0.3s';
                card.style.transform = 'translate(0)';
                resetBtns();
            }
        };

        card.addEventListener('mousedown', e => { start(e.clientX); card.addEventListener('mousemove', onMove); });
        window.addEventListener('mouseup', () => { card.removeEventListener('mousemove', onMove); end(); });
        const onMove = e => move(e.clientX);

        card.addEventListener('touchstart', e => start(e.touches[0].clientX));
        card.addEventListener('touchmove', e => move(e.touches[0].clientX));
        card.addEventListener('touchend', end);
    }

    function resetBtns() {
        const btnLike = document.getElementById('btn-like');
        const btnReject = document.getElementById('btn-reject');
        if(btnLike) btnLike.style.background = 'rgba(30,30,30,0.8)';
        if(btnReject) btnReject.style.background = 'rgba(30,30,30,0.8)';
    }

    window.userSwipe = function(dir) {
        const card = document.getElementById('active-card');
        if(!card) return;
        card.style.transition = 'transform 0.4s ease-out';
        card.style.transform = `translateX(${dir === 'right' ? 1000 : -1000}px) rotate(${dir === 'right' ? 30 : -30}deg)`;
        
        if (dir === 'right') {
            const winkTxt = document.getElementById('wink-txt');
            if(winkTxt) {
                winkTxt.classList.add('show');
                setTimeout(() => winkTxt.classList.remove('show'), 1500);
            }
        }

        // Increment Counter
        swipeCount++;
        localStorage.setItem('pgX_swipeCount', swipeCount);
        const counterEl = document.getElementById('swipe-counter');
        if(counterEl) counterEl.innerText = `📊 ${swipeCount} Swipes`;

        setTimeout(() => {
            currentSwipeIndex++;
            resetBtns();
            renderDeck();
        }, 300);
    }

    // --- VIEW DETAILS ---
    window.openUserModal = function(name, img, isSmoker, hasKids) {
        document.getElementById('vu-name').innerText = name;
        document.getElementById('vu-img').src = img;
        const tags = document.getElementById('vu-tags');
        tags.innerHTML = '';
        if(isSmoker) tags.innerHTML += '<span style="padding:5px 10px; background:#333; border-radius:10px; font-size:12px;">🚬 Smoker</span>';
        if(hasKids) tags.innerHTML += '<span style="padding:5px 10px; background:#333; border-radius:10px; font-size:12px;">👶 Has Kids</span>';
        
        document.getElementById('view-user-modal').style.display = 'block';
    }

    // --- GAME LOGIC ---
    let gameReq;
    window.initGame = function() {
        const cvs = document.getElementById('game-canvas');
        if(!cvs) return;
        const ctx = cvs.getContext('2d');
        let ball = { x: 150, y: 200, dx: 2, dy: 2, r: 5 };
        let paddle = { x: 120, w: 60, h: 10 };
        let running = true;

        cvs.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = cvs.getBoundingClientRect();
            let newX = e.touches[0].clientX - rect.left - paddle.w/2;
            if (newX < 0) newX = 0;
            if (newX > 300 - paddle.w) newX = 300 - paddle.w;
            paddle.x = newX;
        }, {passive: false});

        function loop() {
            if(!running) return;
            ctx.fillStyle = 'black'; ctx.fillRect(0,0,300,400);
            
            // Ball
            ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2); ctx.fill();
            ball.x += ball.dx; ball.y += ball.dy;

            // Walls
            if(ball.x < 0 || ball.x > 300) ball.dx *= -1;
            if(ball.y < 0) ball.dy *= -1;
            
            // Paddle Hit
            if(ball.y > 380 && ball.x > paddle.x && ball.x < paddle.x + paddle.w) ball.dy *= -1;
            if(ball.y > 400) { ball.x = 150; ball.y = 200; } // Reset

            // Paddle
            ctx.fillStyle = '#8B5CF6'; ctx.fillRect(paddle.x, 390, paddle.w, paddle.h);

            gameReq = requestAnimationFrame(loop);
        }
        loop();
    }

    // --- UTILS ---
    window.switchView = function(view, btn) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById('view-'+view);
        if(target) target.classList.add('active');
        
        if(btn) {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
    }
    window.openMyProfile = function() { document.getElementById('profile-modal').style.display='block'; }
    window.openMsgModal = function() { document.getElementById('msg-modal').style.display='block'; }
    window.toggleProfileAcc = function(id) {
        const el = document.getElementById(id);
        if(el) el.style.display = (el.style.display === 'block') ? 'none' : 'block';
    }
    window.toggleUserMenu = function() {
        const menu = document.getElementById('user-dropdown');
        if(menu) menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }
    window.saveProfile = function() {
        document.getElementById('profile-modal').style.display='none';
        
        // Show Success Modal
        const saveModal = document.getElementById('save-modal');
        if(saveModal) {
            saveModal.style.display = 'flex'; // Use flex to center
            saveModal.style.setProperty('display', 'flex', 'important'); // Enforce
        }
    }
    window.closeConfirm = function() { document.getElementById('confirm-modal').style.display='none'; }
    
    // Google Places Init (Callback)
    window.initGoogle = function() {
        try {
            const input = document.getElementById('google-loc-input');
            if(input) new google.maps.places.Autocomplete(input);
        } catch(e) { console.log("Google API not loaded (invalid key)"); }
    }
    
    // Map Init
    function initMap() {
        if(document.getElementById('map')) {
            const map = L.map('map').setView([40.7128, -74.0060], 12);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
        }
    }

    // File Preview
    window.previewMainAndGallery = function(event) {
        const file = event.target.files[0];
        if(file) {
            const src = URL.createObjectURL(file);
            document.getElementById('my-main-preview').src = src;
        }
    }

    init(); // START
});
