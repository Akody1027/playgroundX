document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL STATE ---
    let activeDeck = [];
    let card, startX, currentX;

    // --- 1. PROFILE & PHOTO LOGIC ---
    // This fixes the "Photo not showing in circle" issue
    window.previewMainAndGallery = function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = e.target.result;
            // Update the Circle
            document.getElementById('my-main-preview').src = imageData;
            // Update Gallery Slot #1
            const g1 = document.getElementById('g1-preview');
            const lbl = document.getElementById('g1-lbl');
            if(g1) {
                g1.src = imageData;
                g1.style.display = 'block';
                if(lbl) lbl.style.display = 'none';
            }
        };
        reader.readAsDataURL(file);
    };

    window.saveProfile = function() {
        const profile = {
            alias: document.getElementById('p-alias').value,
            age: document.getElementById('p-age').value,
            img: document.getElementById('my-main-preview').src,
            bio: document.getElementById('p-bio').value
        };
        localStorage.setItem('pgX_myProfile', JSON.stringify(profile));
        alert("Profile Saved Successfully! ✅");
        document.getElementById('profile-modal').style.display = 'none';
    };

    // --- 2. MAP & LOCATION LOGIC ---
    const map = L.map('map').setView([40.7128, -74.0060], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    // This fixes the "Map not showing my location" issue
    function locateUser() {
        map.locate({setView: true, maxZoom: 16});
        function onLocationFound(e) {
            L.circle(e.latlng, e.accuracy / 2, { color: '#8B5CF6' }).addTo(map);
            L.marker(e.latlng).addTo(map).bindPopup("You are here").openPopup();
        }
        map.on('locationfound', onLocationFound);
    }

    // --- 3. HEADER & ARCADE CONTROLS (Restored) ---
    window.toggleUserMenu = () => {
        const m = document.getElementById('user-dropdown');
        m.style.display = (m.style.display === 'block') ? 'none' : 'block';
    };

    window.openMsgModal = () => document.getElementById('msg-modal').style.display = 'block';
    
    window.closeArcade = () => {
        document.getElementById('game-frame').src = '';
        document.getElementById('game-modal').style.display = 'none';
    };

    window.switchView = function(viewId, btn) {
        document.querySelectorAll('.app-view').forEach(v => v.style.display = 'none');
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + viewId).style.display = 'block';
        btn.classList.add('active');
        if (viewId === 'map') {
            setTimeout(() => { 
                map.invalidateSize(); 
                locateUser(); // Fire location search when map is opened
            }, 200);
        }
    };

    // --- 4. ARCADE & GAMES ---
    window.revealPlay = function(overlay) {
        document.querySelectorAll('.play-btn').forEach(b => { b.style.opacity = "0"; b.parentElement.style.background = "transparent"; });
        overlay.style.background = "rgba(0,0,0,0.7)";
        const btn = overlay.querySelector('.play-btn');
        btn.style.opacity = "1";
        btn.style.pointerEvents = "auto";
    };

    window.launchGame = (file, e) => {
        e.stopPropagation();
        document.getElementById('game-frame').src = file;
        document.getElementById('game-player').style.display = 'block';
    };

    // --- 5. INITIALIZE ---
    window.initBackend = function() {
        const profileBtn = document.getElementById('open-my-profile');
        if(profileBtn) profileBtn.onclick = () => {
            document.getElementById('profile-modal').style.display = 'block';
            document.getElementById('user-dropdown').style.display = 'none';
        };
        // Setup simple grid placeholders
        const grid = document.getElementById('grid-content');
        if(grid) grid.innerHTML = Array(9).fill('<div class="grid-item" style="border:1px dashed #444; background:#1a1a1a; height:100px;"></div>').join('');
    };

    window.initBackend();
});
