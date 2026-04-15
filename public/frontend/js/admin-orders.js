/**
 * Admin Orders Management System
 * Handle viewing, filtering, and updating orders
 */

let allOrders = [];
let filteredOrders = [];

// ============ Initialize Admin Orders ============

function initAdminOrders() {
    loadOrders();
    setupEventListeners();
    renderOrders();
    updateStats();
}

function loadOrders() {
    allOrders = OrderManager.getAllOrders();
    filteredOrders = allOrders.slice();
}

function setupEventListeners() {
    $('#filterStatus').on('change', filterOrders);
    $('#searchOrders').on('keyup', filterOrders);
}

// ============ Filter and Search Functions ============

function filterOrders() {
    const statusFilter = $('#filterStatus').val();
    const searchTerm = $('#searchOrders').val().toLowerCase();

    filteredOrders = allOrders.filter(order => {
        // Filter by status
        if (statusFilter && order.status !== statusFilter) {
            return false;
        }

        // Filter by search term
        if (searchTerm) {
            const matchOrderId = order.orderId.toLowerCase().includes(searchTerm);
            const matchPhone = order.customer.phone.includes(searchTerm);
            const matchName = order.customer.name.toLowerCase().includes(searchTerm);

            return matchOrderId || matchPhone || matchName;
        }

        return true;
    });

    renderOrders();
}

// ============ Render Functions ============

function renderOrders() {
    const container = $('#ordersContainer');

    if (filteredOrders.length === 0) {
        container.html(`
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>কোনো অর্ডার পাওয়া যায়নি</h3>
                <p>আপনার সার্চ মানদণ্ড অনুযায়ী কোনো অর্ডার নেই</p>
            </div>
        `);
        return;
    }

    let html = '';

    filteredOrders.forEach(order => {
        html += renderOrderCard(order);
    });

    container.html(html);

    // Attach event listeners to order cards
    $('.order-header').on('click', function() {
        $(this).siblings('.order-body').toggleClass('show');
        $(this).find('.fa-chevron-up, .fa-chevron-down').toggleClass('fa-chevron-up fa-chevron-down');
    });
}

function renderOrderCard(order) {
    const statusClass = `status-${order.status}`;
    const statusText = getStatusText(order.status);
    const isExpanded = false;

    return `
        <div class="order-card" data-order-id="${order.orderId}">
            <div class="order-header">
                <div class="order-header-left">
                    <div class="order-id">
                        <i class="fas fa-tag"></i> ${order.orderId}
                    </div>
                    <div class="order-date">
                        <i class="fas fa-calendar-alt"></i> ${order.orderTime}
                    </div>
                </div>
                <div style="text-align: right; margin-left: auto; margin-right: 20px;">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="order-total">
                    ৳ ${order.pricing.total.toLocaleString()}
                </div>
                <div style="margin-left: 15px; color: white; font-size: 18px;">
                    <i class="fas fa-chevron-down"></i>
                </div>
            </div>

            <div class="order-body">
                <!-- Customer Information -->
                <div class="order-section">
                    <div class="section-title"><i class="fas fa-user"></i> গ্রাহক তথ্য</div>
                    <div class="info-row">
                        <span class="info-label">নাম:</span>
                        <span class="info-value">${order.customer.name}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">ফোন:</span>
                        <span class="info-value">
                            <a href="tel:${order.customer.phone}">${order.customer.phone}</a>
                        </span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">ঠিকানা:</span>
                        <span class="info-value">${order.customer.address}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">এলাকা:</span>
                        <span class="info-value">${getDeliveryAreaText(order.customer.deliveryArea)}</span>
                    </div>
                    ${order.customer.specialNotes ? `
                        <div class="info-row">
                            <span class="info-label">বিশেষ নোট:</span>
                            <span class="info-value">${order.customer.specialNotes}</span>
                        </div>
                    ` : ''}
                </div>

                <!-- Order Items -->
                <div class="order-section">
                    <div class="section-title"><i class="fas fa-box"></i> পণ্যসম�‚হ</div>
                    ${order.items.map(item => `
                        <div class="product-item">
                            ${item.image ? `
                                <div class="product-image">
                                    <img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'">
                                </div>
                            ` : `<div class="product-image"><i class="fas fa-image" style="color:#999;font-size:20px;"></i></div>`}
                            <div class="product-info">
                                <div class="product-name">${item.name}</div>
                                <div class="product-meta">
                                    পরিমাণ: <strong>${item.quantity}</strong> 📦— 
                                    ৳ <strong>${item.price}</strong> = 
                                    <span class="product-price">৳ ${(item.price * item.quantity).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Pricing Details -->
                <div class="order-section">
                    <div class="section-title"><i class="fas fa-receipt"></i> মূল্য বিবরণ</div>
                    <div class="info-row">
                        <span class="info-label">পণ্যের মূল্য:</span>
                        <span class="info-value">৳ ${order.pricing.subtotal.toLocaleString()}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">ডেলিভারি চার্জ:</span>
                        <span class="info-value">৳ ${order.pricing.deliveryCharge.toLocaleString()}</span>
                    </div>
                    <div class="info-row" style="font-size: 14px; font-weight: 700; padding: 12px 0; border: 1px solid #f0f0f0; border-radius: 4px; padding-left: 8px; padding-right: 8px;">
                        <span class="info-label">মোট অর্থ:</span>
                        <span class="info-value" style="color: #f85606; font-size: 16px;">৳ ${order.pricing.total.toLocaleString()}</span>
                    </div>
                </div>

                <!-- Status Update Section -->
                <div class="order-section">
                    <div class="section-title"><i class="fas fa-sync"></i> স্থিতি আপডেট</div>
                    <div class="status-update-section">
                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 10px;">বর্তমান স্থিতি: <strong>${statusText}</strong></div>
                        <div class="status-controls">
                            <button class="btn-status ${order.status === 'processing' ? 'active' : ''}" onclick="updateOrderStatus('${order.orderId}', 'processing')">
                                <i class="fas fa-hourglass"></i> প্রক্রিয়াকরণ
                            </button>
                            <button class="btn-status ${order.status === 'shipped' ? 'active' : ''}" onclick="updateOrderStatus('${order.orderId}', 'shipped')">
                                <i class="fas fa-truck"></i> পাঠানো
                            </button>
                            <button class="btn-status ${order.status === 'delivered' ? 'active' : ''}" onclick="updateOrderStatus('${order.orderId}', 'delivered')">
                                <i class="fas fa-check"></i> ডেলিভারি
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Status History -->
                <div class="order-section">
                    <div class="section-title"><i class="fas fa-history"></i> স্থিতি ইতিহাস</div>
                    <div style="font-size: 12px;">
                        ${order.statusHistory.map(history => `
                            <div style="padding: 8px; border-left: 3px solid #f85606; margin-bottom: 8px; background: #f9fafb; padding-left: 10px;">
                                <strong>${history.status}</strong> - ${history.timestamp}
                                <div style="color: #6b7280; font-size: 11px; margin-top: 2px;">${history.note}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="order-section">
                    <div class="action-buttons">
                        <button class="btn-action btn-delete" onclick="deleteOrder('${order.orderId}')">
                            <i class="fas fa-trash"></i> অর্ডার মুছুন
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============ Status Management ============

function updateOrderStatus(orderId, newStatus) {
    if (OrderManager.updateOrderStatus(orderId, newStatus)) {
        loadOrders();
        renderOrders();
        updateStats();

        // Show confirmation toast if available
        showStatusUpdateToast(orderId, newStatus);
    } else {
        alert('স্থিতি আপডেট করতে ব্যর্থ। আবার চেষ্টা করুন।');
    }
}

function deleteOrder(orderId) {
    if (confirm('আপনি কি এই অর্ডারটি মুছে ফেলতে চান? এটি বাতিল করা যাবে না।')) {
        if (OrderManager.deleteOrder(orderId)) {
            loadOrders();
            renderOrders();
            updateStats();
            alert('অর্ডার সফলভাবে মুছে ফেলা হয়েছে।');
        } else {
            alert('অর্ডার মুছতে ব্যর্থ। আবার চেষ্টা করুন।');
        }
    }
}

// ============ Helper Functions ============

function getStatusText(status) {
    const statusMap = {
        'confirmed': 'নিশ্চিত',
        'processing': 'প্রক্রিয়াকরণ',
        'shipped': 'পাঠানো',
        'delivered': 'ডেলিভারি',
        'cancelled': 'বাতিল'
    };
    return statusMap[status] || status;
}

function getDeliveryAreaText(area) {
    const areaMap = {
        'dhaka-60': 'ঢাকার ভিতর (৳ ৬০)',
        'outside-130': 'ঢাকার বাহির (৳ ১৩০)'
    };
    return areaMap[area] || area;
}

// ============ Statistics ============

function updateStats() {
    const total = allOrders.length;
    const confirmed = allOrders.filter(o => o.status === 'confirmed').length;
    const shipped = allOrders.filter(o => o.status === 'shipped').length;
    const delivered = allOrders.filter(o => o.status === 'delivered').length;

    $('#totalOrders').text(total);
    $('#confirmedOrders').text(confirmed);
    $('#shippedOrders').text(shipped);
    $('#deliveredOrders').text(delivered);
}

// ============ Notifications/Toasts ============

function showStatusUpdateToast(orderId, newStatus) {
    // Simple alert-based notification
    const statusText = getStatusText(newStatus);
    console.log(`অর্ডার ${orderId} এর স্থিতি আপডেট হয়েছে: ${statusText}`);
}

// ============ Export/Print Functions ============

function exportOrdersToCSV() {
    let csv = 'অর্ডার নম্বর,গ্রাহক,ফোন,ঠিকানা,পণ্যের সংখ্যা,মোট মূল্য,স্থিতি,সময়\n';

    allOrders.forEach(order => {
        const row = [
            order.orderId,
            order.customer.name,
            order.customer.phone,
            order.customer.address,
            order.items.length,
            order.pricing.total,
            getStatusText(order.status),
            order.orderTime
        ].map(cell => `"${cell}"`).join(',');

        csv += row + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// ============ Real-time Sync ============

// Listen for cart/order changes from other pages
window.addEventListener('storage', function(e) {
    if (e.key === 'drop2wave_orders_v1') {
        loadOrders();
        renderOrders();
        updateStats();
    }
});

// Refresh orders every 30 seconds
setInterval(function() {
    loadOrders();
    updateStats();
    // Don't re-render unless there are new orders
    if (filteredOrders.length > 0) {
        // Silent update - only render if filters changed or new orders added
    }
}, 30000);

// ============ Initialize when page loads ============

$(document).ready(function() {
    // Check if user is authenticated
    const adminSession = localStorage.getItem('drop2wave_admin_session');
    if (!adminSession) {
        // Redirect to login or show warning
        console.warn('Admin session not found. Please log in.');
    }

    initAdminOrders();
});

