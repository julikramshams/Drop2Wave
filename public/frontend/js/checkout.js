/**
 * Checkout System for Drop2Wave E-Commerce
 * Adapted for existing checkout.html form
 */

// ============ Order Management Functions ============

function readOrdersRaw() {
    try {
        const data = localStorage.getItem('drop2wave_orders_v1');
        return data ? JSON.parse(data) : { orders: [] };
    } catch (e) {
        console.error('Error reading orders:', e);
        return { orders: [] };
    }
}

function saveOrdersRaw(data) {
    try {
        localStorage.setItem('drop2wave_orders_v1', JSON.stringify(data));
        if (window.UniversalData && typeof window.UniversalData.pushOrdersFromLocal === 'function') {
            window.UniversalData.pushOrdersFromLocal().catch(() => {});
        }
        return true;
    } catch (e) {
        console.error('Error saving orders:', e);
        return false;
    }
}

class OrderManager {
    static generateOrderId() {
        return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    static createOrder(customerData, cartItems, deliveryCharge, subtotal, total) {
        const sanitizeOrderImage = (rawImage) => {
            const value = String(rawImage || '').trim();
            // Data URLs make order storage huge over time. Keep listing fast by not persisting them.
            if (!value || value.startsWith('data:image/')) return '';
            return value;
        };

        const order = {
            orderId: this.generateOrderId(),
            orderDate: new Date().toISOString(),
            orderTimestamp: Date.now(),
            orderTime: new Date().toLocaleString('bn-BD', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            
            // Customer Information
            customer: {
                name: customerData.name,
                phone: customerData.phone,
                address: customerData.address,
                deliveryArea: customerData.deliveryArea,
                specialNotes: customerData.specialNotes || ''
            },

            // Order Items
            items: cartItems.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                total: item.price * item.quantity,
                image: sanitizeOrderImage(item.image),
                categoryId: item.categoryId
            })),

            // Pricing Details
            pricing: {
                subtotal: subtotal,
                deliveryCharge: deliveryCharge,
                total: total
            },

            // Order Status
            status: 'new', // new, complete, no_response, hold, cancelled, in_courier, delivered
            statusHistory: [
                {
                    status: 'new',
                    timestamp: new Date().toLocaleString('bn-BD'),
                    note: 'New order received'
                }
            ]
        };

        return order;
    }

    static addOrder(order) {
        const orders = readOrdersRaw();
        orders.orders.push(order);
        return saveOrdersRaw(orders);
    }

    static getAllOrders() {
        return readOrdersRaw().orders || [];
    }

    static getOrderById(orderId) {
        const orders = this.getAllOrders();
        return orders.find(order => order.orderId === orderId);
    }

    static updateOrderStatus(orderId, newStatus, note = '') {
        const orders = readOrdersRaw();
        const order = orders.orders.find(o => o.orderId === orderId);
        
        if (order) {
            const statusMap = {
                'new': 'New order received',
                'complete': 'Customer verified and order confirmed',
                'no_response': 'Customer did not answer call',
                'hold': 'Order put on hold',
                'cancelled': 'Order cancelled by customer',
                'in_courier': 'Order sent to courier',
                'delivered': 'Order delivered successfully'
            };

            order.status = newStatus;
            order.statusHistory.push({
                status: newStatus,
                timestamp: new Date().toLocaleString('bn-BD'),
                note: note || statusMap[newStatus] || newStatus
            });

            return saveOrdersRaw(orders);
        }
        return false;
    }

    static deleteOrder(orderId) {
        const orders = readOrdersRaw();
        orders.orders = orders.orders.filter(o => o.orderId !== orderId);
        return saveOrdersRaw(orders);
    }
}

const IncompleteOrderTracker = {
    KEY: 'drop2wave_incomplete_orders_v1',
    SESSION_ID_KEY: 'drop2wave_checkout_draft_id',

    getSessionId() {
        let id = sessionStorage.getItem(this.SESSION_ID_KEY);
        if (!id) {
            id = 'inc_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
            sessionStorage.setItem(this.SESSION_ID_KEY, id);
        }
        return id;
    },

    readList() {
        try {
            const parsed = JSON.parse(localStorage.getItem(this.KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    },

    saveList(list) {
        localStorage.setItem(this.KEY, JSON.stringify(Array.isArray(list) ? list : []));
    },

    getPayload() {
        const cartItems = getCartItemsFromStorage();
        const name = String(document.getElementById('customerName')?.value || '').trim();
        const phone = String(document.getElementById('customerPhone')?.value || '').trim();
        const address = String(document.getElementById('customerAddress')?.value || '').trim();
        const deliveryArea = String(document.getElementById('deliveryCharge')?.value || '');
        const notes = String(document.getElementById('specialNotes')?.value || '').trim();

        return {
            id: this.getSessionId(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            customer: {
                name,
                phone,
                address,
                deliveryArea,
                specialNotes: notes
            },
            items: cartItems.map(item => ({
                id: item.id,
                name: item.name,
                quantity: Number(item.quantity || 0) || 0,
                price: Number(item.price || 0) || 0
            }))
        };
    },

    hasMeaningfulDraft(payload) {
        const c = payload.customer || {};
        const typedAny = Boolean(c.name || c.phone || c.address || c.specialNotes);
        const hasItems = Array.isArray(payload.items) && payload.items.length > 0;
        return typedAny && hasItems;
    },

    upsertDraft() {
        const payload = this.getPayload();
        const list = this.readList();
        const idx = list.findIndex(item => String(item.id) === String(payload.id));

        if (!this.hasMeaningfulDraft(payload)) {
            if (idx !== -1) {
                list.splice(idx, 1);
                this.saveList(list);
            }
            return;
        }

        if (idx === -1) {
            list.push(payload);
        } else {
            payload.createdAt = Number(list[idx].createdAt || payload.createdAt);
            list[idx] = payload;
        }

        // Keep storage bounded.
        list.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
        this.saveList(list.slice(0, 300));
        if (window.UniversalData && typeof window.UniversalData.pushIncompleteFromLocal === 'function') {
            window.UniversalData.pushIncompleteFromLocal().catch(() => {});
        }
    },

    removeCurrentDraft() {
        const id = this.getSessionId();
        const list = this.readList().filter(item => String(item.id) !== String(id));
        this.saveList(list);
        sessionStorage.removeItem(this.SESSION_ID_KEY);
        if (window.UniversalData && typeof window.UniversalData.pushIncompleteFromLocal === 'function') {
            window.UniversalData.pushIncompleteFromLocal().catch(() => {});
        }
    },

    setup() {
        const run = () => this.upsertDraft();
        const debounced = (() => {
            let t = null;
            return () => {
                clearTimeout(t);
                t = setTimeout(run, 250);
            };
        })();

        ['customerName', 'customerPhone', 'customerAddress', 'specialNotes', 'deliveryCharge'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', debounced);
            el.addEventListener('change', debounced);
        });

        window.addEventListener('beforeunload', run);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') run();
        });

        run();
    }
};

// ============ Checkout Page Functions ============

function initCheckoutPage() {
    loadCartItems();
    setupFormSubmission();
    setupDeliveryAreaListener();
}

function getCartItemsFromStorage() {
    try {
        const parsed = JSON.parse(localStorage.getItem('drop2wave_cart_v1') || 'null');
        const rawItems = Array.isArray(parsed) ? parsed : (parsed?.items || []);

        return rawItems.map(item => {
            const quantity = Number(item.quantity ?? item.qty ?? 1) || 1;
            return {
                ...item,
                quantity,
                qty: quantity,
                price: Number(item.price || 0)
            };
        });
    } catch (e) {
        return [];
    }
}

function loadCartItems() {
    try {
        const items = getCartItemsFromStorage();

        if (items.length === 0) {
            alert('কার্ট খালি রয়েছে। অনুগ্রহ করে পণ্য যোগ করুন।');
            window.location.href = 'index.html';
            return;
        }

        let html = '';
        let subtotal = 0;

        items.forEach(item => {
            const qty = item.quantity || 1;
            const itemTotal = item.price * qty;
            subtotal += itemTotal;

            html += `
                <tr class="cart-item" id="productcart${item.id}">
                    <td class="product-image">
                        <a href="#" class="mr-3">
                            <img src="${item.image || 'https://via.placeholder.com/80'}" 
                                 style="width:80px;height:80px;object-fit:cover;border-radius:6px;" alt="${item.name}">
                        </a>
                    </td>
                    <td class="product-name">
                        <div style="margin-bottom:10px;"><strong>${item.name}</strong></div>
                        <div style="font-size:14px;color:#666;">পরিমাণ: <strong>${qty}</strong></div>
                        <div style="font-size:14px;color:#666;">মূল্য: <strong>৳ ${item.price}</strong></div>
                        <div style="font-size:14px;font-weight:bold;color:#f85606;">সর্বমোট: ৳ ${itemTotal}</div>
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-danger"
                            style="margin-top:10px;"
                            onclick="removeCheckoutItem('${item.id}')"
                            title="এই পণ্যটি সরান"
                        >
                            <i class="fas fa-trash"></i> বাদ দিন
                        </button>
                    </td>
                </tr>
            `;
        });

        // Insert cart items into table
        const table = document.querySelector('table.table.border-bottom');
        if (table) {
            table.innerHTML = html;
        }

        // Update pricing
        updateCheckoutSummary(subtotal);
        updateCartBadge(items);

    } catch (e) {
        console.error('Error loading cart items:', e);
        alert('কার্ট লোড করতে সমস্যা হয়েছে।');
    }
}

function saveCartItemsToStorage(items) {
    try {
        const raw = JSON.parse(localStorage.getItem('drop2wave_cart_v1') || 'null');
        if (Array.isArray(raw)) {
            localStorage.setItem('drop2wave_cart_v1', JSON.stringify(items));
            return;
        }

        const normalized = {
            ...(raw && typeof raw === 'object' ? raw : {}),
            items: items,
            updatedAt: Date.now()
        };
        localStorage.setItem('drop2wave_cart_v1', JSON.stringify(normalized));
    } catch (e) {
        localStorage.setItem('drop2wave_cart_v1', JSON.stringify({ items }));
    }
}

function updateCartBadge(items) {
    const badge = document.getElementById('cartNumber');
    if (!badge) return;

    const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity || item.qty || 1) || 1), 0);
    badge.textContent = totalQty;
}

function removeCheckoutItem(itemId) {
    const items = getCartItemsFromStorage();
    const filteredItems = items.filter(item => String(item.id) !== String(itemId));

    saveCartItemsToStorage(filteredItems);

    if (!filteredItems.length) {
        alert('কার্টে আর কোনো পণ্য নেই।');
        window.location.href = 'index.html';
        return;
    }

    loadCartItems();
}

function updateCheckoutSummary(subtotal) {
    const deliveryChargeSelect = document.getElementById('deliveryCharge');
    const deliveryCharge = parseInt(deliveryChargeSelect?.value || 60);
    const total = subtotal + deliveryCharge;

    // Update form field
    document.getElementById('ordersubtotalprice').value = subtotal;

    // Store for later use
    window.checkoutData = {
        subtotal: subtotal,
        deliveryCharge: deliveryCharge,
        total: total
    };

    // Update display elements if they exist
    const subtotalDisplay = document.getElementById('subtotalprice');
    const deliveryDisplay = document.getElementById('dinamicdalivery');
    const totalDisplay = document.getElementById('totalamount');

    if (subtotalDisplay) subtotalDisplay.textContent = subtotal;
    if (deliveryDisplay) deliveryDisplay.textContent = deliveryCharge;
    if (totalDisplay) totalDisplay.textContent = total;
}

function setupDeliveryAreaListener() {
    const deliverySelect = document.getElementById('deliveryCharge');
    if (deliverySelect) {
        deliverySelect.addEventListener('change', function() {
            const items = getCartItemsFromStorage();
            const subtotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
            updateCheckoutSummary(subtotal);
        });
    }
}

function validateCheckoutForm() {
    const name = document.getElementById('customerName')?.value?.trim();
    const phone = document.getElementById('customerPhone')?.value?.trim();
    const address = document.getElementById('customerAddress')?.value?.trim();

    if (!name || name.length < 2) {
        alert('অনুগ্রহ করে সঠিক নাম লিখুন');
        return false;
    }

    const phoneRegex = /^(\+88)?01[0-9]{9}$/;
    if (!phone || !phoneRegex.test(phone)) {
        alert('অনুগ্রহ করে সঠিক মোবাইল নম্বর লিখুন');
        return false;
    }

    if (!address || address.length < 5) {
        alert('অনুগ্রহ করে সম্পূর্ণ ঠিকানা লিখুন');
        return false;
    }

    return true;
}

function setupFormSubmission() {
    const form = document.querySelector('form.from-prevent-multiple-submits');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        processOrder();
    });
}

function processOrder() {
    if (!validateCheckoutForm()) return;

    try {
        // Show loading state
        const btn = document.getElementById('orderConfirm');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="spinner fa fa-spinner fa-spin"></i> প্রক্রিয়া চলছে...';

        // Get cart items
        const cartItems = getCartItemsFromStorage();

        if (cartItems.length === 0) {
            alert('কার্ট খালি রয়েছে');
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }

        // Get form data
        const customerData = {
            name: document.getElementById('customerName').value.trim(),
            phone: document.getElementById('customerPhone').value.trim(),
            address: document.getElementById('customerAddress').value.trim(),
            deliveryArea: document.getElementById('deliveryCharge')?.value || 'dhaka-60'
        };

        // Use stored checkout data
        const checkoutData = window.checkoutData || {
            subtotal: cartItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0),
            deliveryCharge: parseInt(document.getElementById('deliveryCharge')?.value || 60),
            total: 0
        };
        checkoutData.total = checkoutData.subtotal + checkoutData.deliveryCharge;

        // Create order
        const order = OrderManager.createOrder(
            customerData,
            cartItems,
            checkoutData.deliveryCharge,
            checkoutData.subtotal,
            checkoutData.total
        );

        // Save order
        const orderSaved = OrderManager.addOrder(order);

        if (orderSaved) {
            // Clear cart
            localStorage.removeItem('drop2wave_cart_v1');
            IncompleteOrderTracker.removeCurrentDraft();

            // Show success message
            setTimeout(() => {
                showSuccessMessage(order);
            }, 500);
        } else {
            alert('অর্ডার সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }

    } catch (e) {
        console.error('Error processing order:', e);
        alert('অর্ডার প্রক্রিয়া করতে একটি সমস্যা হয়েছে।');
        const btn = document.getElementById('orderConfirm');
        btn.disabled = false;
    }
}

function showSuccessMessage(order) {
    const article = document.querySelector('aside.card article.card-body');
    if (!article) return;

    const successHtml = `
        <div style="text-align: center; padding: 30px; background: #d4edda; border-radius: 8px; border: 1px solid #c3e6cb;">
            <div style="margin-bottom: 20px;">
                <i class="fas fa-check-circle" style="font-size: 60px; color: #28a745;"></i>
            </div>
            <h2 style="color: #155724; margin-bottom: 10px;">অর্ডার সফলভাবে সম্পন্ন!</h2>
            <p style="color: #155724; margin-bottom: 15px; font-size: 16px;">
                অর্ডার নম্বর: <strong>${order.orderId}</strong>
            </p>
            <p style="color: #155724; margin-bottom: 20px; font-size: 14px;">
                ${order.orderTime}
            </p>
            
            <div style="background: white; margin: 20px 0; padding: 15px; border-radius: 6px; text-align:left;">
                <h5 style="color: #155724;">বিস্তারিত:</h5>
                <p><strong>মোট পেমেন্ট:</strong> ৳ ${order.pricing.total}</p>
                <p><strong>পণ্য:</strong> ${order.items.length} টি</p>
                <p><strong>ঠিকানা:</strong> ${order.customer.address}</p>
            </div>

            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                আমাদের টিম শীঘ্রই যোগাযোগ করবে।
            </p>

            <a href="index.html" class="btn btn-primary">
                <i class="fas fa-home"></i> হোম পেজে ফিরুন
            </a>
        </div>
    `;

    article.innerHTML = successHtml;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ Initialize when page loads ============

document.addEventListener('DOMContentLoaded', function() {
    // Only run checkout page behavior when checkout form exists.
    // Admin pages also load this file for OrderManager utilities.
    const checkoutForm = document.querySelector('form.from-prevent-multiple-submits');
    if (!checkoutForm) {
        return;
    }

    // Check if cart exists
    const cartItems = getCartItemsFromStorage();
    if (!cartItems.length) {
        alert('কার্ট খালি রয়েছে। অনুগ্রহ করে পণ্য যোগ করুন।');
        window.location.href = 'index.html';
        return;
    }

    initCheckoutPage();
    if (window.UniversalData && typeof window.UniversalData.pullIncompleteToLocal === 'function') {
        window.UniversalData.pullIncompleteToLocal().catch(() => {});
    }
    IncompleteOrderTracker.setup();
});

