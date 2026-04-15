/**
 * Admin Orders - Performance-first rewrite
 * Single parse at startup, lazy detail rendering, no startup migrations.
 */

const ORDERS_KEY = 'drop2wave_orders_v1';

let allOrders = [];
let filteredOrders = [];
let ordersById = new Map();
let currentView = 'all';
let renderLimit = 30;
const renderStep = 30;

function getViewFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const view = String(params.get('view') || 'all').toLowerCase();
        const valid = new Set(['create', 'all', 'new', 'complete', 'no_response', 'cancelled', 'in_courier', 'hold']);
        return valid.has(view) ? view : 'all';
    } catch (e) {
        return 'all';
    }
}

function normalizeStatus(status) {
    const s = String(status || '').toLowerCase();
    const map = {
        confirmed: 'new',
        processing: 'complete',
        shipped: 'in_courier',
        cancelled: 'cancelled',
        delivered: 'delivered'
    };
    return map[s] || s || 'new';
}

function getStatusText(status) {
    const map = {
        new: 'New',
        complete: 'Complete',
        no_response: 'No Response',
        cancelled: 'Cancelled',
        in_courier: 'In Courier',
        hold: 'Hold',
        delivered: 'Delivered'
    };
    return map[status] || status;
}

function getDeliveryAreaText(area) {
    const map = {
        'dhaka-60': 'Inside Dhaka (60)',
        'outside-130': 'Outside Dhaka (130)'
    };
    return map[String(area || '')] || String(area || '-');
}

function readOrdersStoreFast() {
    try {
        const raw = localStorage.getItem(ORDERS_KEY);
        if (!raw) return { orders: [] };
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.orders)) return { orders: [] };
        return parsed;
    } catch (e) {
        console.warn('Could not parse orders store:', e);
        return { orders: [] };
    }
}

function saveOrdersStore(store) {
    try {
        localStorage.setItem(ORDERS_KEY, JSON.stringify(store));
        return true;
    } catch (e) {
        console.warn('Could not save orders store:', e);
        return false;
    }
}

function loadOrders() {
    const store = readOrdersStoreFast();
    const list = Array.isArray(store.orders) ? store.orders : [];

    allOrders = list.map(order => ({
        ...order,
        status: normalizeStatus(order.status),
        _searchText: [
            String(order.orderId || ''),
            String(order.customer?.name || ''),
            String(order.customer?.phone || '')
        ].join(' ').toLowerCase()
    }));

    allOrders.sort((a, b) => Number(b.orderTimestamp || 0) - Number(a.orderTimestamp || 0));
    ordersById = new Map(allOrders.map(o => [String(o.orderId), o]));
}

function isOrderFromToday(order) {
    const ts = Number(order.orderTimestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) return false;

    const d = new Date(ts);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function getOrderViewTitle() {
    const titles = {
        create: 'Create Order',
        all: 'All Orders',
        new: 'New Orders',
        complete: 'Complete Orders',
        no_response: 'No Response Orders',
        cancelled: 'Cancel Orders',
        in_courier: 'In Courier Orders',
        hold: 'Hold Orders'
    };
    return titles[currentView] || 'All Orders';
}

function getOrderViewSubtitle() {
    const subtitles = {
        create: 'Use checkout to place a customer order, then manage it from All Orders.',
        all: 'Master control page: move orders between New, Complete, No Response, Hold, Cancel, In Courier, and Delivered.',
        new: 'New daily incoming customer orders.',
        complete: 'Verified orders confirmed by customer call.',
        no_response: 'Orders where customer did not answer.',
        cancelled: 'Orders cancelled after customer declined purchase.',
        in_courier: 'Orders handed over to courier.',
        hold: 'Orders currently on hold.'
    };
    return subtitles[currentView] || '';
}

function setupHeader() {
    const title = document.getElementById('ordersPageTitle');
    const subtitle = document.getElementById('ordersPageSubtitle');
    const filterSection = document.getElementById('filterSection');
    const statsRow = document.getElementById('statsRow');

    if (title) title.textContent = getOrderViewTitle();
    if (subtitle) subtitle.textContent = getOrderViewSubtitle();

    const hideMeta = currentView === 'create';
    if (filterSection) filterSection.style.display = hideMeta ? 'none' : '';
    if (statsRow) statsRow.style.display = hideMeta ? 'none' : '';
}

function setupEvents() {
    $('#filterStatus').on('change', applyFilters);

    let t = null;
    $('#searchOrders').on('input', function() {
        clearTimeout(t);
        t = setTimeout(applyFilters, 160);
    });

    $(document).on('click', '#logoutBtn', function() {
        if (confirm('Logout from admin panel?')) {
            if (typeof AdminStore !== 'undefined' && AdminStore.clearSession) {
                AdminStore.clearSession();
            }
            window.location.href = 'login.html';
        }
    });

    window.addEventListener('storage', function(e) {
        if (e.key !== ORDERS_KEY) return;
        loadOrders();
        applyFilters();
        updateStats();
    });

    setInterval(function() {
        if (document.hidden) return;
        loadOrders();
        applyFilters();
        updateStats();
    }, 120000);
}

function matchesCurrentView(order) {
    if (currentView === 'all') return true;
    if (currentView === 'create') return false;
    if (currentView === 'new') return order.status === 'new' && isOrderFromToday(order);
    return order.status === currentView;
}

function applyFilters() {
    const statusFilter = String($('#filterStatus').val() || '').toLowerCase();
    const search = String($('#searchOrders').val() || '').toLowerCase().trim();

    filteredOrders = allOrders.filter(order => {
        if (!matchesCurrentView(order)) return false;
        if (currentView === 'all' && statusFilter && order.status !== statusFilter) return false;
        if (search && !String(order._searchText || '').includes(search)) return false;
        return true;
    });

    renderLimit = renderStep;
    renderOrders();
}

function renderCreateView() {
    $('#ordersContainer').html(`
        <div class="empty-state">
            <i class="fas fa-plus-circle"></i>
            <h3>Create Order</h3>
            <p>Create customer orders through checkout and manage all transitions in All Orders.</p>
            <a href="../checkout.html" class="btn btn-primary btn-sm mt-2">
                <i class="fas fa-external-link-alt"></i> Open Checkout
            </a>
        </div>
    `);
}

function formatOrderTime(order) {
    try {
        if (order.orderDate) {
            const dt = new Date(order.orderDate);
            if (!Number.isNaN(dt.getTime())) {
                return dt.toLocaleString('en-BD', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        }
    } catch (e) {
        // Fall through to stored label.
    }
    return String(order.orderTime || '-');
}

function renderOrders() {
    if (currentView === 'create') {
        renderCreateView();
        return;
    }

    const container = $('#ordersContainer');
    if (!filteredOrders.length) {
        container.html(`
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No orders found</h3>
                <p>No orders matched this page criteria.</p>
            </div>
        `);
        return;
    }

    const shown = filteredOrders.slice(0, renderLimit);
    const remaining = filteredOrders.length - shown.length;

    const html = shown.map(renderOrderCard).join('') + (remaining > 0 ? `
        <div class="text-center mt-3">
            <button class="btn btn-outline-secondary btn-sm" id="loadMoreOrdersBtn">Load More (${remaining} remaining)</button>
        </div>
    ` : '');

    container.html(html);

    $('.order-header').on('click', function() {
        const $card = $(this).closest('.order-card');
        const orderId = String($card.data('order-id') || '');
        const $body = $card.find('.order-body');
        const order = ordersById.get(orderId);

        if (order && !$body.data('rendered')) {
            $body.html(renderOrderBody(order));
            $body.data('rendered', '1');
        }

        $body.toggleClass('show');
        $(this).find('.fa-chevron-up, .fa-chevron-down').toggleClass('fa-chevron-up fa-chevron-down');
    });

    $('#loadMoreOrdersBtn').on('click', function() {
        renderLimit += renderStep;
        renderOrders();
    });
}

function renderOrderCard(order) {
    const statusText = getStatusText(order.status);
    return `
        <div class="order-card" data-order-id="${order.orderId}">
            <div class="order-header">
                <div class="order-header-left">
                    <div class="order-id"><i class="fas fa-tag"></i> ${order.orderId}</div>
                    <div class="order-date"><i class="fas fa-calendar-alt"></i> ${formatOrderTime(order)}</div>
                </div>
                <div style="text-align:right;margin-left:auto;margin-right:20px;">
                    <span class="status-badge status-${order.status}">${statusText}</span>
                </div>
                <div class="order-total">Tk ${Number(order.pricing?.total || 0).toLocaleString()}</div>
                <div style="margin-left:15px;color:white;font-size:18px;"><i class="fas fa-chevron-down"></i></div>
            </div>
            <div class="order-body" data-rendered=""></div>
        </div>
    `;
}

function renderOrderBody(order) {
    const canControl = currentView === 'all';
    const statusText = getStatusText(order.status);

    const controlBlock = canControl ? `
        <div class="order-section">
            <div class="section-title"><i class="fas fa-random"></i> Move Order (All Orders Control)</div>
            <div class="status-update-section">
                <div style="font-size:12px;color:#6b7280;margin-bottom:10px;">Current: <strong>${statusText}</strong></div>
                <div class="status-controls">
                    ${renderStatusBtn(order, 'new', 'bell', 'New')}
                    ${renderStatusBtn(order, 'complete', 'check-circle', 'Complete')}
                    ${renderStatusBtn(order, 'no_response', 'phone-slash', 'No Response')}
                    ${renderStatusBtn(order, 'hold', 'pause-circle', 'Hold')}
                    ${renderStatusBtn(order, 'cancelled', 'times-circle', 'Cancel')}
                    ${renderStatusBtn(order, 'in_courier', 'shipping-fast', 'In Courier')}
                    ${renderStatusBtn(order, 'delivered', 'box', 'Delivered')}
                </div>
            </div>
        </div>
    ` : '';

    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];

    return `
        <div class="order-section">
            <div class="section-title"><i class="fas fa-user"></i> Customer</div>
            <div class="info-row"><span class="info-label">Name:</span><span class="info-value">${order.customer?.name || '-'}</span></div>
            <div class="info-row"><span class="info-label">Phone:</span><span class="info-value"><a href="tel:${order.customer?.phone || ''}">${order.customer?.phone || '-'}</a></span></div>
            <div class="info-row"><span class="info-label">Address:</span><span class="info-value">${order.customer?.address || '-'}</span></div>
            <div class="info-row"><span class="info-label">Area:</span><span class="info-value">${getDeliveryAreaText(order.customer?.deliveryArea || '')}</span></div>
            ${order.customer?.specialNotes ? `<div class="info-row"><span class="info-label">Note:</span><span class="info-value">${order.customer.specialNotes}</span></div>` : ''}
        </div>

        <div class="order-section">
            <div class="section-title"><i class="fas fa-box"></i> Items</div>
            ${(order.items || []).map(item => `
                <div class="product-item">
                    ${item.image ? `<div class="product-image"><img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.style.display='none'"></div>` : `<div class="product-image"><i class="fas fa-image" style="color:#999;font-size:20px;"></i></div>`}
                    <div class="product-info">
                        <div class="product-name">${item.name}</div>
                        <div class="product-meta">Qty: <strong>${item.quantity}</strong> | Price: <strong>Tk ${item.price}</strong> | Total: <span class="product-price">Tk ${(Number(item.price || 0) * Number(item.quantity || 0)).toLocaleString()}</span></div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="order-section">
            <div class="section-title"><i class="fas fa-receipt"></i> Pricing</div>
            <div class="info-row"><span class="info-label">Subtotal:</span><span class="info-value">Tk ${Number(order.pricing?.subtotal || 0).toLocaleString()}</span></div>
            <div class="info-row"><span class="info-label">Delivery:</span><span class="info-value">Tk ${Number(order.pricing?.deliveryCharge || 0).toLocaleString()}</span></div>
            <div class="info-row" style="font-size:14px;font-weight:700;padding:12px 8px;border:1px solid #f0f0f0;border-radius:4px;"><span class="info-label">Total:</span><span class="info-value" style="color:#f85606;font-size:16px;">Tk ${Number(order.pricing?.total || 0).toLocaleString()}</span></div>
        </div>

        ${controlBlock}

        <div class="order-section">
            <div class="section-title"><i class="fas fa-history"></i> History</div>
            <div style="font-size:12px;">
                ${history.map(h => `
                    <div style="padding:8px;border-left:3px solid #f85606;margin-bottom:8px;background:#f9fafb;padding-left:10px;">
                        <strong>${getStatusText(normalizeStatus(h.status))}</strong> - ${h.timestamp || '-'}
                        <div style="color:#6b7280;font-size:11px;margin-top:2px;">${h.note || ''}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="order-section">
            <div class="action-buttons">
                <button class="btn-action btn-delete" onclick="deleteOrder('${order.orderId}')"><i class="fas fa-trash"></i> Delete Order</button>
            </div>
        </div>
    `;
}

function renderStatusBtn(order, status, icon, label) {
    const active = order.status === status ? 'active' : '';
    return `<button class="btn-status ${active}" onclick="updateOrderStatus('${order.orderId}', '${status}')"><i class="fas fa-${icon}"></i> ${label}</button>`;
}

function updateOrderStatus(orderId, newStatus) {
    const notes = {
        new: 'New order received',
        complete: 'Customer verified and order confirmed',
        no_response: 'Customer did not answer call',
        cancelled: 'Customer cancelled the order',
        in_courier: 'Order handed over to courier',
        hold: 'Order put on hold',
        delivered: 'Order delivered successfully'
    };

    const store = readOrdersStoreFast();
    const order = (store.orders || []).find(o => String(o.orderId) === String(orderId));
    if (!order) return;

    order.status = newStatus;
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    history.push({
        status: newStatus,
        timestamp: new Date().toLocaleString('en-BD'),
        note: notes[newStatus] || 'Status updated'
    });
    order.statusHistory = history;

    if (!saveOrdersStore(store)) {
        alert('Could not update order status.');
        return;
    }

    if (window.UniversalData && typeof window.UniversalData.pushOrdersFromLocal === 'function') {
        window.UniversalData.pushOrdersFromLocal().catch(() => {});
    }

    loadOrders();
    applyFilters();
    updateStats();
}

function deleteOrder(orderId) {
    if (!confirm('Delete this order permanently?')) return;

    const store = readOrdersStoreFast();
    const before = (store.orders || []).length;
    store.orders = (store.orders || []).filter(o => String(o.orderId) !== String(orderId));

    if (store.orders.length === before) return;
    if (!saveOrdersStore(store)) {
        alert('Could not delete order.');
        return;
    }

    if (window.UniversalData && typeof window.UniversalData.pushOrdersFromLocal === 'function') {
        window.UniversalData.pushOrdersFromLocal().catch(() => {});
    }

    loadOrders();
    applyFilters();
    updateStats();
}

function updateStats() {
    const total = allOrders.length;
    const newCount = allOrders.filter(o => o.status === 'new').length;
    const completeCount = allOrders.filter(o => o.status === 'complete').length;
    const inCourierCount = allOrders.filter(o => o.status === 'in_courier').length;

    $('#totalOrders').text(total);
    $('#confirmedOrders').text(newCount);
    $('#shippedOrders').text(completeCount);
    $('#deliveredOrders').text(inCourierCount);
}

function init() {
    if (typeof AdminStore !== 'undefined' && AdminStore.isAuthenticated && !AdminStore.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    currentView = getViewFromUrl();
    setupHeader();
    setupEvents();

    $('#ordersContainer').html(`
        <div class="empty-state">
            <i class="fas fa-spinner fa-spin"></i>
            <h3>Loading orders...</h3>
            <p>Please wait.</p>
        </div>
    `);

    requestAnimationFrame(async function() {
        if (window.UniversalData && typeof window.UniversalData.pullOrdersToLocal === 'function') {
            await window.UniversalData.pullOrdersToLocal().catch(() => {});
        }

        loadOrders();
        $('#filterStatus').val('');
        applyFilters();
        updateStats();

        if (window.UniversalData && typeof window.UniversalData.subscribeToOrders === 'function') {
            window.UniversalData.subscribeToOrders(function() {
                loadOrders();
                applyFilters();
                updateStats();
            }).catch(() => {});
        }
    });
}

$(document).ready(init);
