(function() {
    'use strict';

    const ORDERS_KEY = 'drop2wave_orders_v1';
    const INCOMPLETE_KEY = 'drop2wave_incomplete_orders_v1';
    const FIREBASE_CONFIG = {
        apiKey: 'AIzaSyBkOvOhYO1o1fUW0DtRns5VLirbRO5EsWA',
        authDomain: 'drop2wavefirebase.firebaseapp.com',
        projectId: 'drop2wavefirebase',
        storageBucket: 'drop2wavefirebase.firebasestorage.app',
        messagingSenderId: '296193741264'
    };

    let cloudInitPromise = null;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-d2w-src="' + src + '"]');
            if (existing) {
                if (existing.dataset.loaded === '1') {
                    resolve();
                    return;
                }
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error('Script load failed: ' + src)), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.d2wSrc = src;
            script.onload = () => {
                script.dataset.loaded = '1';
                resolve();
            };
            script.onerror = () => reject(new Error('Script load failed: ' + src));
            document.head.appendChild(script);
        });
    }

    async function ensureCloudReady() {
        if (cloudInitPromise) return cloudInitPromise;

        cloudInitPromise = (async () => {
            try {
                await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
                await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');

                if (!window.firebase) throw new Error('Firebase not available');
                if (!window.firebase.apps || window.firebase.apps.length === 0) {
                    window.firebase.initializeApp(FIREBASE_CONFIG);
                }
                window.firebase.firestore();
                return true;
            } catch (err) {
                console.warn('Universal cloud sync unavailable, local mode only.', err);
                return false;
            }
        })();

        return cloudInitPromise;
    }

    function getDocRef() {
        if (!window.firebase || !window.firebase.firestore) return null;
        return window.firebase.firestore().collection('drop2wave').doc('store');
    }

    function readLocalJson(key, fallback) {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || '');
            if (parsed && typeof parsed === 'object') return parsed;
            return fallback;
        } catch (err) {
            return fallback;
        }
    }

    function writeLocalJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    async function pullOrdersToLocal() {
        const ready = await ensureCloudReady();
        if (!ready) return false;

        const ref = getDocRef();
        if (!ref) return false;

        try {
            const snap = await ref.get();
            if (!snap.exists) return false;
            const data = snap.data() || {};
            const payload = data.ordersData && Array.isArray(data.ordersData.orders)
                ? data.ordersData
                : { orders: [] };
            writeLocalJson(ORDERS_KEY, payload);
            return true;
        } catch (err) {
            console.warn('Could not pull orders from cloud.', err);
            return false;
        }
    }

    async function pushOrdersFromLocal() {
        const ready = await ensureCloudReady();
        if (!ready) return false;

        const ref = getDocRef();
        if (!ref) return false;

        const localData = readLocalJson(ORDERS_KEY, { orders: [] });
        const payload = {
            orders: Array.isArray(localData.orders) ? localData.orders : []
        };

        try {
            await ref.set({
                ordersData: payload,
                ordersUpdatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (err) {
            console.warn('Could not push orders to cloud.', err);
            return false;
        }
    }

    async function pullIncompleteToLocal() {
        const ready = await ensureCloudReady();
        if (!ready) return false;

        const ref = getDocRef();
        if (!ref) return false;

        try {
            const snap = await ref.get();
            if (!snap.exists) return false;
            const data = snap.data() || {};
            const list = Array.isArray(data.incompleteOrdersData) ? data.incompleteOrdersData : [];
            writeLocalJson(INCOMPLETE_KEY, list);
            return true;
        } catch (err) {
            console.warn('Could not pull incomplete orders from cloud.', err);
            return false;
        }
    }

    async function pushIncompleteFromLocal() {
        const ready = await ensureCloudReady();
        if (!ready) return false;

        const ref = getDocRef();
        if (!ref) return false;

        const list = readLocalJson(INCOMPLETE_KEY, []);
        const payload = Array.isArray(list) ? list : [];

        try {
            await ref.set({
                incompleteOrdersData: payload,
                incompleteUpdatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (err) {
            console.warn('Could not push incomplete orders to cloud.', err);
            return false;
        }
    }

    async function subscribeToOrders(onUpdate) {
        const ready = await ensureCloudReady();
        if (!ready) return null;

        const ref = getDocRef();
        if (!ref) return null;

        return ref.onSnapshot((snap) => {
            if (!snap || !snap.exists) return;
            const data = snap.data() || {};
            if (!data.ordersData || !Array.isArray(data.ordersData.orders)) return;
            writeLocalJson(ORDERS_KEY, data.ordersData);
            if (typeof onUpdate === 'function') onUpdate();
        }, (err) => {
            console.warn('Orders subscription failed.', err);
        });
    }

    async function subscribeToIncomplete(onUpdate) {
        const ready = await ensureCloudReady();
        if (!ready) return null;

        const ref = getDocRef();
        if (!ref) return null;

        return ref.onSnapshot((snap) => {
            if (!snap || !snap.exists) return;
            const data = snap.data() || {};
            if (!Array.isArray(data.incompleteOrdersData)) return;
            writeLocalJson(INCOMPLETE_KEY, data.incompleteOrdersData);
            if (typeof onUpdate === 'function') onUpdate();
        }, (err) => {
            console.warn('Incomplete orders subscription failed.', err);
        });
    }

    window.UniversalData = {
        ORDERS_KEY,
        INCOMPLETE_KEY,
        ensureCloudReady,
        pullOrdersToLocal,
        pushOrdersFromLocal,
        pullIncompleteToLocal,
        pushIncompleteFromLocal,
        subscribeToOrders,
        subscribeToIncomplete
    };
})();
