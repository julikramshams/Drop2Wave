/**
 * Admin Dashboard - Stats and navigation
 */

$(document).ready(async function() {
    // Check authentication
    if (!AdminStore.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    
    await AdminStore.syncFromCloud();

    loadDashboardStats();
    setupLogout();
    
    function loadDashboardStats() {
        const categories = AdminStore.getCategories();
        const products = AdminStore.getProducts();
        const newProducts = products.filter(p => p.isNew === true);
        const totalProducts = products.filter(p => p.isNew !== true);
        const activeCategories = categories.filter(c => c.isActive !== false);
        const activeProducts = products.filter(p => p.isActive !== false);

        // Load orders if OrderManager is available
        let orders = [];
        let pendingOrders = 0;
        let deliveredOrders = 0;
        if (typeof OrderManager !== 'undefined') {
            orders = OrderManager.getAllOrders();
            pendingOrders = orders.filter(o => o.status === 'confirmed' || o.status === 'processing').length;
            deliveredOrders = orders.filter(o => o.status === 'delivered').length;
        }

        // Current dashboard HTML uses fixed stat IDs.
        if (document.getElementById('statCategories')) {
            $('#statCategories').text(categories.length);
            $('#statActiveCategories').text(activeCategories.length);
            $('#statProducts').text(products.length);
            $('#statActiveProducts').text(activeProducts.length);
            $('#statNewProducts').text(newProducts.length);
            
            // Update order stats if elements exist
            if (document.getElementById('statOrders')) {
                $('#statOrders').text(orders.length);
                $('#statPendingOrders').text(pendingOrders);
                $('#statDeliveredOrders').text(deliveredOrders);
            }
            return;
        }
        
        const statsHtml = `
            <div class="row">
                <div class="col-md-3 mb-3">
                    <div class="card stat-card">
                        <div class="card-body text-center">
                            <h3 class="text-primary">${categories.length}</h3>
                            <p class="text-muted mb-0">Total Categories</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card stat-card">
                        <div class="card-body text-center">
                            <h3 class="text-success">${newProducts.length}</h3>
                            <p class="text-muted mb-0">New Products</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card stat-card">
                        <div class="card-body text-center">
                            <h3 class="text-info">${totalProducts.length}</h3>
                            <p class="text-muted mb-0">Total Products</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card stat-card">
                        <div class="card-body text-center">
                            <h3 class="text-warning">${products.length}</h3>
                            <p class="text-muted mb-0">All Products</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const statsContainer = document.getElementById('dashboardStats');
        if (statsContainer) {
            statsContainer.innerHTML = statsHtml;
        }
    }

    // Refresh counters if data changes in another tab.
    window.addEventListener('storage', function (event) {
        if (event.key === AdminStore.STORE_KEY) {
            loadDashboardStats();
        }
    });
    
    function setupLogout() {
        $(document).on('click', '#logoutBtn', function() {
            if (confirm('Are you sure you want to logout?')) {
                AdminStore.clearSession();
                window.location.href = 'login.html';
            }
        });
    }
});

