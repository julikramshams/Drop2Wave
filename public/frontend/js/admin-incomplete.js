$(document).ready(function() {
    const INCOMPLETE_KEY = 'drop2wave_incomplete_orders_v1';
    const $status = $('#statusMessage');

    if (!AdminStore.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    loadIncomplete();
    setupEvents();

    if (window.UniversalData && typeof window.UniversalData.pullIncompleteToLocal === 'function') {
        window.UniversalData.pullIncompleteToLocal().then(() => {
            loadIncomplete();
        }).catch(() => {});
    }

    if (window.UniversalData && typeof window.UniversalData.subscribeToIncomplete === 'function') {
        window.UniversalData.subscribeToIncomplete(function() {
            loadIncomplete();
        }).catch(() => {});
    }

    function readList() {
        try {
            const parsed = JSON.parse(localStorage.getItem(INCOMPLETE_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            return [];
        }
    }

    function writeList(list) {
        localStorage.setItem(INCOMPLETE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    }

    function esc(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function fmt(ts) {
        const d = new Date(Number(ts || Date.now()));
        return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('en-BD');
    }

    function loadIncomplete() {
        const list = readList().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
        $('#incompleteCount').text(list.length);

        if (!list.length) {
            $('#incompleteList').html('<div class="text-muted">No incomplete checkout attempts found.</div>');
            return;
        }

        const html = list.map((entry, idx) => {
            const c = entry.customer || {};
            const items = Array.isArray(entry.items) ? entry.items : [];
            const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity || 0) || 0), 0);
            const hasMissing = [];
            if (!String(c.name || '').trim()) hasMissing.push('name');
            if (!String(c.phone || '').trim()) hasMissing.push('phone');
            if (!String(c.address || '').trim()) hasMissing.push('address');
            if (!items.length) hasMissing.push('items');

            return `
                <div class="review-card">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <strong>Attempt ${idx + 1}</strong>
                        <span class="badge badge-warning">Incomplete</span>
                    </div>
                    <div class="review-meta">
                        Last Updated: <strong>${esc(fmt(entry.updatedAt))}</strong> | Started: ${esc(fmt(entry.createdAt))}
                    </div>
                    <div class="mt-2"><strong>Customer:</strong> ${esc(c.name || '-')} | ${esc(c.phone || '-')}</div>
                    <div><strong>Address:</strong> ${esc(c.address || '-')}</div>
                    <div><strong>Items:</strong> ${items.length} products (${totalQty} qty)</div>
                    <div><strong>Missing:</strong> ${hasMissing.length ? esc(hasMissing.join(', ')) : 'none'}</div>
                    <div class="mt-2 text-muted" style="font-size:12px;">Source: checkout form closed/left before confirm.</div>
                    <div class="mt-3">
                        <button class="btn btn-outline-danger btn-sm delete-incomplete" data-id="${esc(entry.id)}"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        $('#incompleteList').html(html);
    }

    function setupEvents() {
        $(document).on('click', '.delete-incomplete', function() {
            const id = String($(this).data('id') || '');
            const list = readList().filter(item => String(item.id) !== id);
            writeList(list);
            if (window.UniversalData && typeof window.UniversalData.pushIncompleteFromLocal === 'function') {
                window.UniversalData.pushIncompleteFromLocal().catch(() => {});
            }
            loadIncomplete();
            showStatus('Incomplete attempt deleted.', 'info');
        });

        $(document).on('click', '#clearIncompleteBtn', function() {
            if (!confirm('Clear all incomplete attempts?')) return;
            writeList([]);
            if (window.UniversalData && typeof window.UniversalData.pushIncompleteFromLocal === 'function') {
                window.UniversalData.pushIncompleteFromLocal().catch(() => {});
            }
            loadIncomplete();
            showStatus('All incomplete attempts cleared.', 'success');
        });

        $(document).on('click', '#logoutBtn', function() {
            if (confirm('Logout from admin panel?')) {
                AdminStore.clearSession();
                window.location.href = 'login.html';
            }
        });

        window.addEventListener('storage', function(e) {
            if (e.key === INCOMPLETE_KEY) {
                loadIncomplete();
            }
        });
    }

    function showStatus(message, type) {
        $status
            .removeClass('d-none')
            .removeClass('alert-success alert-danger alert-info alert-warning')
            .addClass('alert-' + type)
            .text(message)
            .fadeIn();

        if (type === 'success' || type === 'info') {
            setTimeout(() => $status.fadeOut().addClass('d-none'), 2400);
        }
    }
});
