// Wait for the HTML to load
document.addEventListener('DOMContentLoaded', () => {
    let activeDeck = [];

    // --- FUNCTION 1: FETCH REAL USERS ---
    window.renderDeck = async function() {
        const zone = document.getElementById('swipe-zone');
        const grid = document.getElementById('grid-content');
        
        if (!window.db) return; // Wait if Firebase isn't ready

        try {
            const { getDocs, collection } = window.fbase;
            const querySnapshot = await getDocs(collection(window.db, "users"));
            
            activeDeck = [];
            const myUid = localStorage.getItem('pgX_myUid');

            querySnapshot.forEach((doc) => {
                // Don't show yourself in the swipe deck
                if (doc.id !== myUid) {
                    activeDeck.push({ id: doc.id, ...doc.data() });
                }
            });

            // 1. Render the Swipe Card
            if (activeDeck.length > 0) {
                const u = activeDeck[0];
                zone.innerHTML = `
                    <div class="swipe-card" id="active-card">
                        <img src="${u.img || 'https://via.placeholder.com/500'}">
                        <div class="card-header-overlay">
                            <span class="card-alias">${u.alias || 'Anonymous'}</span>
                            <span class="card-age">${u.age || '??'}</span>
                        </div>
                    </div>`;
                initSwipeHandlers(); // Start the touch listener
            } else {
                zone.innerHTML = `<div style="text-align:center; padding:50px; color:#666;">No one new nearby! Check back later.</div>`;
            }

            // 2. Render the Grid View
            if (grid) {
                grid.innerHTML = activeDeck.map(u => `
                    <div class="grid-item">
                        <img src="${u.img || 'https://via.placeholder.com/500'}" style="width:100%; height:100%; object-fit:cover;">
                        <div class="grid-overlay"><span>${u.alias}</span></div>
                    </div>
                `).join('');
            }
        } catch (e) {
            console.error("Error loading users:", e);
        }
    };

    // --- FUNCTION 2: SAVE YOUR PROFILE ---
    window.saveProfile = async function() {
        const { setDoc, doc } = window.fbase;
        let myUid = localStorage.getItem('pgX_myUid');
        
        // If you don't have an ID yet, create one
        if (!myUid) {
            myUid = "user_" + Date.now();
            localStorage.setItem('pgX_myUid', myUid);
        }

        const data = {
            alias: document.getElementById('p-alias').value,
            bio: document.getElementById('p-bio').value,
            age: document.getElementById('p-age').value,
            img: document.getElementById('my-main-preview').src,
            gender: document.getElementById('disp-gender').innerText,
            updatedAt: new Date()
        };

        try {
            await setDoc(doc(window.db, "users", myUid), data, { merge: true });
            document.getElementById('profile-modal').style.display = 'none';
            alert("Profile Saved!");
            window.renderDeck(); // Refresh the deck
        } catch (e) {
            alert("Error saving profile: " + e.message);
        }
    };

    // --- FUNCTION 3: TOUCH/SWIPE LOGIC ---
    function initSwipeHandlers() {
        const card = document.getElementById('active-card');
        if (!card) return;
        let startX = 0;
        let currentX = 0;

        card.ontouchstart = (e) => { startX = e.touches[0].clientX; card.style.transition = 'none'; };
        card.ontouchmove = (e) => {
            currentX = e.touches[0].clientX - startX;
            card.style.transform = `translateX(${currentX}px) rotate(${currentX / 15}deg)`;
        };
        card.ontouchend = () => {
            if (currentX > 120) window.userSwipe('right');
            else if (currentX < -120) window.userSwipe('left');
            else {
                card.style.transition = '0.3s';
                card.style.transform = 'translateX(0) rotate(0)';
            }
        };
    }

    window.userSwipe = function(dir) {
        const card = document.getElementById('active-card');
        if (!card) return;
        card.style.transition = '0.5s';
        card.style.transform = `translateX(${dir === 'right' ? 1000 : -1000}px)`;

        // Visual feedback for Wink
        if (dir === 'right') {
            const wink = document.getElementById('wink-txt');
            wink.classList.add('show');
            setTimeout(() => wink.classList.remove('show'), 1000);
        }

        setTimeout(() => {
            activeDeck.shift(); // Remove the person we just swiped
            window.renderDeck(); // Show the next person
        }, 300);
    };

    // --- UI TOGGLES ---
    window.switchView = function(viewId, btn) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');
        btn.classList.add('active');
    };

    window.toggleUserMenu = function() {
        const menu = document.getElementById('user-dropdown');
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    };

    // Run once on load
    window.renderDeck();
});
