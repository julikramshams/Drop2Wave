/**
 * Admin Orders Management
 * - All Orders page controls status transitions
 * - Other order views are filtered lists
 */

let allOrders = [];
let filteredOrders = [];
let currentView = 'all';
let renderLimit = 25;
const renderStep = 25;
let ordersById = new Map();
const ordersCompactionKey = 'drop2wave_orders_compacted_v2';

function debounce(fn, wait) {
    let t = null;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

function getViewFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const raw = String(params.get('view') || 'all').toLowerCase();
        const allowed = new Set(['create', 'all', 'new', 'complete', 'no_response', 'cancelled', 'in_courier', 'hold']);
        return allowed.has(raw) ? raw : 'all';
    } catch (err) {
        return 'all';
    }
}

function normalizeLegacyStatus(status) {
    const map = {
        confirmed: 'new',
        processing: 'complete',
        shipped: 'in_courier',
        cancelled: 'cancelled',
        delivered: 'delivered'
    };
    return map[String(status || '').toLowerCase()] || String(status || '').toLowerCase() || 'new';
}

function migrateLegacyStatuses() {
    if (typeof readOrdersRaw !== 'function' || typeof saveOrdersRaw !== 'function') return;

    const data = readOrdersRaw();
    const list = Array.isArray(data.orders) ? data.orders : [];
    let changed = false;

    list.forEach(order => {
        const next = normalizeLegacyStatus(order.status);
        if (next !== order.status) {
            order.status = next;
            changed = true;
        }
    });

    if (changed) {
        saveOrdersRaw(data);
    }
}

function compactOrdersPayloadIfNeeded() {
    if (typeof readOrdersRaw !== 'function' || typeof saveOrdersRaw !== 'function') return;

    try {
        if (localStorage.getItem(ordersCompactionKey) === '1') return;
    } catch (err) {
        // Continue without flag cache if storage flag is unavailable.
    }

    const data = readOrdersRaw();
    const list = Array.isArray(data.orders) ? data.orders : [];
    let changed = false;

    list.forEach(order => {
        if (Array.isArray(order.items)) {
            order.items.forEach(item => {
                const image = String(item.image || '');
                if (image.startsWith('data:image/') || image.length > 1000) {
                    item.image = '';
                    changed = true;
                }
            });
        }

        if (Array.isArray(order.statusHistory) && order.statusHistory.length > 25) {
            order.statusHistory = order.statusHistory.slice(-25);
            changed = true;
        }
    });

    if (changed) {
        saveOrdersRaw(data);
    }

    try {
        localStorage.setItem(ordersCompactionKey, '1');
    } catch (err) {
        // Ignore flag write failures.
    }
}

function isOrderFromToday(order) {
    const ts = Number(order.orderTimestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) return false;

    const orderDate = new Date(ts);
    const now = new Date();
    return orderDate.getFullYear() === now.getFullYear() &&
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getDate() === now.getDate();
}

function isAllView() {
    return currentView === 'all';
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
        create: 'Use your store checkout to create a customer order, then manage it here.',
        all: 'Master control page: move orders into New, Complete, No Response, Hold, Cancel, In Courier, and Delivered.',
        new: 'New daily orders received from customers.',
        complete: 'Verified orders where customers confirmed they will buy.',
        no_response: 'Customers who did not answer verification calls.',
        cancelled: 'Orders cancelled after customer declined purchase.',
        in_courier: 'Orders already handed to courier for delivery.',
        hold: 'Orders temporarily held for negotiation or other reasons.'
    };
    return subtitles[currentView] || '';
}

function getStatusText(status) {
    const statusMap = {
        new: 'New',
        complete: 'Complete',
        no_response: 'No Response',
        cancelled: 'Cancelled',
        in_courier: 'In Courier',
        hold: 'Hold',
        delivered: 'Delivered'
    };
    return statusMap[status] || status;
}

function getDeliveryAreaText(area) {
    const areaMap = {
        'dhaka-60': 'Inside Dhaka (60)',
        'outside-130': 'Outside Dhaka (130)'
    };
    return areaMap[area] || area;
}

function loadOrders() {
    allOrders = OrderManager.getAllOrders().map(order => ({
        ...order,
        status: normalizeLegacyStatus(order.status),
        _searchText: [
            String(order.orderId || ''),
            String(order.customer?.phone || ''),
            String(order.customer?.name || '')
        ].join(' ').toLowerCase()
    }));

    allOrders.sort((a, b) => Number(b.orderTimestamp || 0) - Number(a.orderTimestamp || 0));
    ordersById = new Map(allOrders.map(o => [String(o.orderId), o]));
}

function setupHeadersAndVisibility() {
    const title = document.getElementById('ordersPageTitle');
    const subtitle = document.getElementById('ordersPageSubtitle');
    const filterSection = document.getElementById('filterSection');
    const statsRow = document.getElementById('statsRow');

    if (title) title.textContent = getOrderViewTitle();
    if (subtitle) subtitle.textContent = getOrderViewSubtitle();

    if (filterSection) {
        filterSection.style.display = currentView === 'create' ? 'none' : '';
    }

    if (statsRow) {
        statsRow.style.display = currentView === 'create' ? 'none' : '';
    }
}

function setupEventListeners() {
    $('#filterStatus').on('change', filterOrders);
    $('#searchOrders').on('keyup', debounce(filterOrders, 180));

    $(document).on('click', '#logoutBtn', function() {
        if (confirm('Logout from admin panel?')) {
            AdminStore.clearSession();
            window.location.href = 'login.html';
        }
    });
}

function statusMatchesView(order) {
    if (currentView === 'all') return true;
    if (currentView === 'create') return false;

    if (currentView === 'new') {
        return order.status === 'new' && isOrderFromToday(order);
    }

    return order.status === currentView;
}

function filterOrders() {
    const statusFilter = String($('#filterStatus').val() || '').toLowerCase();
    const searchTerm = String($('#searchOrders').val() || '').toLowerCase().trim();

    filteredOrders = allOrders.filter(order => {
        if (!statusMatchesView(order)) return false;

        if (isAllView() && statusFilter && order.status !== statusFilter) {
            return false;
        }

        if (searchTerm) {
            if (!String(order._searchText || '').includes(searchTerm)) return false;
        }

        return true;
    });

    renderLimit = renderStep;
    renderOrders();
}

function renderCreateView() {
    const container = $('#ordersContainer');
    container.html(`
        <div class="empty-state">
            <i class="fas fa-plus-circle"></i>
            <h3>Create Order</h3>
            <p>Create a customer order from checkout flow, then manage it from All Orders.</p>
            <a href="../checkout.html" class="btn btn-primary btn-sm mt-2">
                <i class="fas fa-external-link-alt"></i> Open Checkout
            </a>
        </div>
    `);
}

function renderOrders() {
    const container = $('#ordersContainer');

    if (currentView === 'create') {
        renderCreateView();
        return;
    }

    if (filteredOrders.length === 0) {
        container.html(`
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No orders found</h3>
                <p>No orders matched this page criteria.</p>
            </div>
        `);
        return;
    }

    const visibleOrders = filteredOrders.slice(0, renderLimit);
    const hasMore = filteredOrders.length > visibleOrders.length;

    let html = '';
    visibleOrders.forEach(order => {
        html += renderOrderCard(order);
    });

    if (hasMore) {
        html += `
            <div class="text-center mt-3" id="loadMoreWrap">
                <button type="button" class="btn btn-outline-secondary btn-sm" id="loadMoreOrdersBtn">
                    Load More (${filteredOrders.length - visibleOrders.length} remaining)
                </button>
            </div>
        `;
    }

    container.html(html);

    $('.order-header').on('click', function() {
        const $card = $(this).closest('.order-card');
        const orderId = String($card.data('order-id') || '');
        const order = ordersById.get(orderId);
        const $body = $card.find('.order-body');

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

function formatOrderTime(order) {
    try {
        if (order.orderDate) {
            const parsed = new Date(order.orderDate);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed.toLocaleString('en-BD', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        }
    } catch (err) {
        // Use fallback from stored value.
    }
    return String(order.orderTime || '-');
}

function renderOrderBody(order) {
    const statusText = getStatusText(order.status);
    const statusButtons = isAllView() ? `
        <div class="order-section">
            <div class="section-title"><i class="fas fa-random"></i> Move Order (All Orders Control)</div>
            <div class="status-update-section">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 10px;">Current: <strong>${statusText}</strong></div>
                <div class="status-controls">
                    <button class="btn-status ${order.status === 'new' ? 'active' : ''}" onclick="updateOrderStatus('${order.orderId}', 'new')"><i class="fas fa-bell"></i> New</button>
                    <button class="btn-status ${order.status === 'complete' ? 'active' : ''}" onclick="updateOrderStatus('${order.orderId}', 'complete')"><i class="fas fa-check-circle"></i> Complete</button>
                    <button class="btn-status ${order.status === 'no_response' ? 'active' : ''}" onclick="updateOrderStatus('${order.orderId}', 'no_response')"><i class="fas fa-phone-slash"></i> No Response</button>
                    <button class="btn-status ${order.status === 'hold' ? 'active' : ''}" onclick="updateOrderStatus('${order.orderId}', 'hold')"><i class="fas fa-pause-circle"></i> Hold</button>
                    <button class="btn-status ${order.status === 'cancelled' ? 'active' : ''}" onclick="updateOrderStatus('${order.orderId}', 'cancelled')"><i class="fas fa-times-circle"></i> Cancel</button>
                    <button class="btn-status ${order.status === 'in_courier' ? 'active' : ''}" onclick="updateOrderStatus('${order.orderId}', 'in_courier')"><i class="fas fa-shipping-fast"></i> In Courier</button>
                    <button class="btn-status ${order.status === 'delivered' ? 'active' : ''}" onclick="updateOrderStatus('${order.orderId}', 'delivered')"><i class="fas fa-box-check"></i> Delivered</button>
                </div>
            </div>
        </div>
    ` : '';

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
                        <div class="product-meta">Qty: <strong>${item.quantity}</strong> | Price: <strong>৳ ${item.price}</strong> | Total: <span class="product-price">৳ ${(Number(item.price || 0) * Number(item.quantity || 0)).toLocaleString()}</span></div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="order-section">
            <div class="section-title"><i class="fas fa-receipt"></i> Pricing</div>
            <div class="info-row"><span class="info-label">Subtotal:</span><span class="info-value">৳ ${Number(order.pricing?.subtotal || 0).toLocaleString()}</span></div>
            <div class="info-row"><span class="info-label">Delivery:</span><span class="info-value">৳ ${Number(order.pricing?.deliveryCharge || 0).toLocaleString()}</span></div>
            <div class="info-row" style="font-size: 14px; font-weight: 700; padding: 12px 8px; border: 1px solid #f0f0f0; border-radius: 4px;"><span class="info-label">Total:</span><span class="info-value" style="color: #f85606; font-size: 16px;">৳ ${Number(order.pricing?.total || 0).toLocaleString()}</span></div>
        </div>

        ${statusButtons}

        <div class="order-section">
            <div class="section-title"><i class="fas fa-history"></i> History</div>
            <div style="font-size: 12px;">
                ${(order.statusHistory || []).map(history => `
                    <div style="padding: 8px; border-left: 3px solid #f85606; margin-bottom: 8px; background: #f9fafb; padding-left: 10px;">
                        <strong>${getStatusText(normalizeLegacyStatus(history.status))}</strong> - ${history.timestamp}
                        <div style="color: #6b7280; font-size: 11px; margin-top: 2px;">${history.note}</div>
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

function renderOrderCard(order) {
    const statusClass = `status-${order.status}`;
    const statusText = getStatusText(order.status);

    return `
        <div class="order-card" data-order-id="${order.orderId}">
            <div class="order-header">
                <div class="order-header-left">
                    <div class="order-id"><i class="fas fa-tag"></i> ${order.orderId}</div>
                    <div class="order-date"><i class="fas fa-calendar-alt"></i> ${formatOrderTime(order)}</div>
                </div>
                <div style="text-align: right; margin-left: auto; margin-right: 20px;">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="order-total">৳ ${Number(order.pricing?.total || 0).toLocaleString()}</div>
                <div style="margin-left: 15px; color: white; font-size: 18px;"><i class="fas fa-chevron-down"></i></div>
            </div>

            <div class="order-body" data-rendered=""></div>
        </div>
    `;
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

    if (OrderManager.updateOrderStatus(orderId, newStatus, notes[newStatus] || 'Status updated')) {
        loadOrders();
        filterOrders();
        updateStats();
    } else {
        alert('Could not update order status.');
    }
}

function deleteOrder(orderId) {
    if (!confirm('Delete this order permanently?')) return;

    if (OrderManager.deleteOrder(orderId)) {
        loadOrders();
        filterOrders();
        updateStats();
    } else {
        alert('Could not delete order.');
    }
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

function initAdminOrders() {
    if (!AdminStore.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    currentView = getViewFromUrl();
    setupEventListeners();
    setupHeadersAndVisibility();

    $('#ordersContainer').html(`
        <div class="empty-state">
            <i class="fas fa-spinner fa-spin"></i>
            <h3>Loading orders...</h3>
            <p>Please wait a moment.</p>
        </div>
    `);

    window.requestAnimationFrame(function() {
        migrateLegacyStatuses();
        compactOrdersPayloadIfNeeded();
        loadOrders();
        $('#filterStatus').val('');
        filterOrders();
        updateStats();
    });
}

window.addEventListener('storage', function(e) {
    if (e.key === 'drop2wave_orders_v1') {
        loadOrders();
        filterOrders();
        updateStats();
    }
});

setInterval(function() {
    if (document.hidden) return;
    loadOrders();
    filterOrders();
    updateStats();
}, 120000);

$(document).ready(function() {
    initAdminOrders();
});
