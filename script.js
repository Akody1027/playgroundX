import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDocs, addDoc, query, orderBy, onSnapshot, limit, serverTimestamp, updateDoc, increment, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"; 
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyDFmhk3ybnsVsFenCE3xvdmy5y_4u9ss7o", 
    authDomain: "playgroundx-ca021.firebaseapp.com",
    projectId: "playgroundx-ca021",
    storageBucket: "playgroundx-ca021.firebasestorage.app",
    messagingSenderId: "427340828971",
    appId: "1:427340828971:web:1d9e2dc22ecd69593eb56e"
}; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 
const APP_ID = "playgroundX_MVP_v2";

// Global Exports for HTML access
window.db = db;
window.auth = auth;
window.storage = storage;
window.APP_ID = APP_ID;
window.fbase = {
    collection, doc, setDoc, getDocs, addDoc, query, orderBy, onSnapshot, limit, serverTimestamp, updateDoc, increment, deleteDoc,
    ref, uploadBytes, getDownloadURL, signInAnonymously
}; 

console.log("Firebase Tools Loaded ✅");

// --- 2. MAIN APPLICATION LOGIC ---
document.addEventListener('DOMContentLoaded', () => {

    /* --- STATE VARIABLES --- */
    let currentUserUid = null;
    let isAdmin = false;
    let walletBalance = 0;
    let activeDeck = [];
    let nsfwModel = null;
    let map = null;

    /* --- AI MODEL INITIALIZATION --- */
    async function loadAI() {
        try {
            if(typeof nsfwjs !== 'undefined') {
                nsfwModel = await nsfwjs.load();
                console.log("NSFW Model Loaded Successfully");
            } else {
                console.warn("NSFWJS library not found. AI scanning disabled.");
            }
        } catch(e) { console.warn("AI Load Failed", e); }
    }
    loadAI();

    /* --- AUTH & GATES --- */
    window.handleAge = async function(isAdult) {
        const pass = document.getElementById('age-pass').value;
        
        // Admin God Mode Check
        if (pass === 'admin123') {
            isAdmin = true;
            document.body.classList.add('is-admin');
            document.getElementById('admin-floater').style.display = 'block';
            document.getElementById('age-gate').style.display = 'none';
            // Skip location gate for Admin
            initBackend(); 
            return;
        }

        if (isAdult) {
            document.getElementById('age-gate').style.display = 'none';
            document.getElementById('location-gate').style.display = 'flex';
        } else {
            window.location.href = "https://google.com";
        }
    }

    /* --- BACKEND INIT & LISTENERS --- */
    window.initBackend = async function() {
        document.getElementById('loading-overlay').style.display = 'flex';
        
        // Connectivity Status Listener
        window.addEventListener('online', updateConn);
        window.addEventListener('offline', updateConn);
        updateConn();

        try {
            // Anonymous Auth
            const userCred = await signInAnonymously(auth);
            currentUserUid = userCred.user.uid;
            console.log("Logged in as:", currentUserUid);

            // Ensure Profile Exists
            await checkUserProfile();
            
            // Start Real-time Listeners
            setupListeners();
            
            // Render Initial Views
            renderDeck();
        } catch(e) { 
            console.error("Auth Error", e); 
            alert("Connection Failed. Refreshing...");
        }
        
        // Hide Loader
        setTimeout(() => document.getElementById('loading-overlay').style.display='none', 2000);
    }

    function updateConn() {
        const dot = document.getElementById('conn-dot');
        const txt = document.getElementById('conn-txt');
        if(navigator.onLine) { 
            dot.classList.remove('offline'); 
            txt.innerText="Active"; 
        } else { 
            dot.classList.add('offline'); 
            txt.innerText="Offline"; 
        }
    }

    async function checkUserProfile() {
        // Just a read to warm up the connection, logic handled in saveProfile if needed
        const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', currentUserUid);
    }

    function setupListeners() {
        // 1. Wallet Balance Listener
        const userRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', currentUserUid);
        onSnapshot(userRef, (docSnap) => {
            if(docSnap.exists()) {
                walletBalance = docSnap.data().walletBalance || 0;
                const balDisplay = document.getElementById('wallet-bal');
                if(balDisplay) balDisplay.innerText = walletBalance;
            }
        });

        // 2. Chat/Wink Badge Listener
        const chatQ = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'chats'),
            window.fbase.where('receiverId', '==', currentUserUid),
            window.fbase.where('read', '==', false)
        );
        onSnapshot(chatQ, (snap) => {
            const count = snap.size;
            const badge = document.getElementById('msg-badge');
            if(count > 0) { 
                badge.style.display='flex'; 
                badge.innerText=count; 
            } else { 
                badge.style.display='none'; 
            }
        });
    }

    /* --- UPLOAD HANDLING & AI SCANNING --- */
    
    // Helper: Scan Single Image
    async function scanImageFile(file) {
        if(!nsfwModel) return false;
        return new Promise((resolve) => {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.onload = async () => {
                const predictions = await nsfwModel.classify(img);
                // Flag if 'Porn' or 'Sexy' > 60%
                const isExplicit = predictions.some(p => (p.className === 'Porn' || p.className === 'Sexy') && p.probability > 0.6);
                resolve(isExplicit);
            };
        });
    }

    // Helper: Scan Video (3-Point Spot Check)
    async function scanVideoFile(file) {
        if(!nsfwModel) return false;
        const video = document.getElementById('ai-scan-video');
        video.src = URL.createObjectURL(file);
        
        return new Promise((resolve) => {
            video.onloadeddata = async () => {
                const duration = video.duration;
                // Check Start (20%), Middle (50%), End (80%)
                const points = [0.2, 0.5, 0.8]; 
                let detected = false;

                for (let p of points) {
                    video.currentTime = duration * p;
                    await new Promise(r => video.onseeked = r);
                    const predictions = await nsfwModel.classify(video);
                    if (predictions.some(pred => (pred.className === 'Porn' || pred.className === 'Sexy') && pred.probability > 0.6)) {
                        detected = true;
                        break;
                    }
                }
                resolve(detected);
            };
        });
    }

    // Main Video Upload Handler (Non-Blocking)
    window.handleVideoUpload = async function(event) {
        const file = event.target.files[0];
        if(!file) return;

        // 1. Close Modal Immediately (UX)
        document.getElementById('video-modal').style.display='none';
        
        // 2. Show Background Spinner
        const status = document.getElementById('upload-status');
        status.style.display = 'flex';
        status.innerHTML = '<div class="mini-spinner"></div> Processing...';

        try {
            // 3. Run AI Scan in Background
            const isExplicit = await scanVideoFile(file);
            
            // 4. Upload to Storage
            const storageRef = ref(storage, `videos/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            // 5. Save Metadata to DB
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos'), {
                url: url,
                userId: currentUserUid,
                isExplicit: isExplicit,
                reportCount: 0,
                timestamp: serverTimestamp()
            });

            // 6. Success Notification
            status.innerHTML = '✅ Upload Complete';
            if(isExplicit) alert("Note: Your video was marked 18+ by the automated content scanner.");

        } catch(e) {
            console.error(e);
            status.innerHTML = '❌ Error';
        }
        
        // Clear status after 5 seconds
        setTimeout(() => status.style.display='none', 5000);
    }

    /* --- PROFILE SAVING & GALLERY --- */
    window.saveProfile = async function() {
        const alias = document.getElementById('p-alias').value;
        const bio = document.getElementById('p-bio').value;
        const showExplicit = document.getElementById('p-show-explicit').checked;
        
        // Collect Multi-Select Attributes
        const attrs = [];
        document.querySelectorAll('.attr-chk:checked').forEach(cb => attrs.push(cb.value));

        // 1. Upload Main Profile Image
        const mainInput = document.getElementById('main-up');
        let mainUrl = document.getElementById('my-main-preview').src;
        if(mainInput.files[0]) {
             const imgRef = ref(storage, `users/${currentUserUid}/main.jpg`);
             await uploadBytes(imgRef, mainInput.files[0]);
             mainUrl = await getDownloadURL(imgRef);
        }

        // 2. Upload Gallery Images (Loop 1-4)
        const galleryUrls = [];
        for(let i=1; i<=4; i++) {
            const input = document.getElementById('g'+i);
            if(input.files[0]) {
                const galRef = ref(storage, `users/${currentUserUid}/g${i}.jpg`);
                await uploadBytes(galRef, input.files[0]);
                const url = await getDownloadURL(galRef);
                galleryUrls.push(url);
            }
        }

        // 3. Save Data
        await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', currentUserUid), {
            alias, bio, img: mainUrl, gallery: galleryUrls, attributes: attrs, 
            showExplicit, lastSeen: serverTimestamp()
        }, { merge: true });

        document.getElementById('profile-modal').style.display='none';
        alert("Profile Saved!");
    }

    // Helper: Immediate Preview for Main Image
    window.previewMain = (e) => {
        if(e.target.files[0]) document.getElementById('my-main-preview').src = URL.createObjectURL(e.target.files[0]);
    }

    /* --- WALLET & ECONOMY --- */
    window.buyCoins = async function(amount) {
        if(confirm(`Confirm purchase of ${amount} coins? (Simulated)`)) {
            const userRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', currentUserUid);
            // Atomically increment balance
            await updateDoc(userRef, { walletBalance: increment(amount) });
            alert("Coins Added!");
        }
    }

    window.sendTip = async function(amount) {
        if(walletBalance < amount) return alert("Not enough coins! Go to Wallet to top up.");
        
        // 1. Deduct from Sender
        const myRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', currentUserUid);
        await updateDoc(myRef, { walletBalance: increment(-amount) });
        
        // 2. Add to Receiver (For MVP, we just alert. Real app needs transaction)
        alert(`Sent ${amount} coins!`);
    }

    /* --- LIVE STUDIO --- */
    window.toggleLive = async function(isLive) {
        const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', currentUserUid);
        await updateDoc(ref, { isLive: isLive });
        
        const vid = document.getElementById('my-local-video');
        const container = document.getElementById('my-cam-container');
        
        if(isLive) {
            container.style.display = 'block';
            // Access Camera
            navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                .then(stream => vid.srcObject = stream)
                .catch(e => alert("Camera access denied"));
        } else {
            container.style.display = 'none';
            // Stop Camera
            if(vid.srcObject) vid.srcObject.getTracks().forEach(t => t.stop());
        }
    }

    /* --- ADMIN ACTIONS --- */
    window.createFakeUser = async function() {
        const alias = document.getElementById('fake-alias').value;
        const age = document.getElementById('fake-age').value;
        const img = document.getElementById('fake-img').value;
        
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'users'), {
            alias, age, img, 
            lat: 40.7 + (Math.random()/100), // Random jitter near NYC
            lng: -74.0 + (Math.random()/100),
            reportCount: 0
        });
        alert("Fake User Injected");
        document.getElementById('admin-modal').style.display='none';
    }

    window.forceDelete = async function() {
        alert("Content Deleted via God Mode (Simulation)");
        // In real app: deleteDoc(docRef);
    }

    /* --- VIEW RENDERING & DECK --- */
    window.renderDeck = async function() {
        const zone = document.getElementById('swipe-zone');
        
        // Query users, filter out high report counts
        const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'users'), limit(10));
        const snap = await getDocs(q);
        
        activeDeck = [];
        snap.forEach(d => {
            const u = d.data();
            // Filter: Not me AND Report Count < 3
            if(d.id !== currentUserUid && (!u.reportCount || u.reportCount < 3)) {
                activeDeck.push({...u, id: d.id});
            }
        });

        if(activeDeck.length === 0) {
            // Empty State (using App Icon SVG)
            zone.innerHTML = `
                <div class="swipe-card" style="display:flex; justify-content:center; align-items:center; background:#111;">
                    <div style="text-align:center;">
                        <div style="width:100px; height:100px; border-radius:50%; background:#222; margin:0 auto; display:flex; align-items:center; justify-content:center;">
                           <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><circle cx="12" cy="8" r="4"></circle><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path></svg>
                        </div>
                        <div class="empty-throb-text" style="margin-top:20px; color:#666;">waiting for users...</div>
                    </div>
                </div>`;
        } else {
            // Render Top Card
            const u = activeDeck[0];
            zone.innerHTML = `
                <div class="swipe-card" id="active-card" onclick="window.viewUser('${u.id}')">
                    <img src="${u.img}">
                    <div class="card-header-overlay"><span class="card-alias">${u.alias}</span><span class="card-age">${u.age || 21}</span></div>
                </div>`;
            // Note: Swipe gesture listeners would be re-attached here
        }
    }

    window.viewUser = async function(id) {
        const modal = document.getElementById('view-user-modal');
        const u = activeDeck.find(x => x.id === id);
        if(!u) return;
        
        document.getElementById('vu-img').src = u.img;
        document.getElementById('vu-name').innerText = u.alias;
        document.getElementById('vu-bio').innerText = u.bio || "No bio available.";
        
        // Render Gallery Grid
        const gGrid = document.getElementById('vu-gallery');
        gGrid.innerHTML = '';
        if(u.gallery) {
            u.gallery.forEach(img => {
                gGrid.innerHTML += `<div class="gallery-slot"><img src="${img}"></div>`;
            });
        }
        
        modal.style.display = 'block';
    }

    window.reportUser = async function() {
        // Increment Report Count logic
        alert("User Reported. Content will be hidden after review.");
    }

    // --- UI HELPERS ---
    window.openTab = function(id, btn) {
        document.querySelectorAll('.tab-pane').forEach(t => t.style.display='none');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(id).style.display='block';
        btn.classList.add('active');
    }

    window.loadMyProfile = function() {
        document.getElementById('profile-modal').style.display = 'block';
        document.getElementById('user-dropdown').style.display = 'none';
    }

    window.openVideoFeed = async function() {
        document.getElementById('video-modal').style.display='block';
        const con = document.getElementById('video-feed-content');
        con.innerHTML = '';
        
        const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos'), orderBy('timestamp', 'desc'), limit(20));
        const snap = await getDocs(q);
        
        snap.forEach(d => {
            const v = d.data();
            // Explicit Content Filter Logic
            // In real app: check if currentUser.showExplicit is true
            if(v.isExplicit) return; // Hide explicit by default for now

            const div = document.createElement('div');
            div.className = 'video-item';
            div.innerHTML = `<video src="${v.url}" controls playsinline></video>`;
            con.appendChild(div);
        });
    }

    window.toggleUserMenu = () => {
        const m = document.getElementById('user-dropdown');
        m.style.display = m.style.display==='block' ? 'none' : 'block';
    }

    window.requestLocation = () => {
        // Transition from Location Gate to App
        document.getElementById('location-gate').style.display='none';
        initBackend();
    }
    
    // View Switcher (Swipe/Grid/Map)
    window.switchView = function(viewId, btn) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');
        btn.classList.add('active');
        if (viewId === 'map' && map) setTimeout(() => map.invalidateSize(), 100);
    }

    // --- MAP INITIALIZATION ---
    if(document.getElementById('map')) {
        map = L.map('map', {zoomControl: false}).setView([40.7128, -74.0060], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
    }
});
