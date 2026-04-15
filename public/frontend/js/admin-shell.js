(function () {
    "use strict";

    var storageKey = "drop2wave_admin_sidebar_collapsed";

    function restoreSidebarState(layout) {
        try {
            if (localStorage.getItem(storageKey) === "1") {
                layout.classList.add("sidebar-collapsed");
            }
        } catch (err) {
            // Ignore storage issues and keep the default expanded layout.
        }
    }

    function setupSidebarToggle(layout, toggle) {
        if (!layout || !toggle) return;

        toggle.addEventListener("click", function () {
            layout.classList.toggle("sidebar-collapsed");
            try {
                localStorage.setItem(storageKey, layout.classList.contains("sidebar-collapsed") ? "1" : "0");
            } catch (err) {
                // Ignore storage issues.
            }
        });
    }

    function getAdminRootPath() {
        var path = window.location.pathname || "";
        var lower = path.toLowerCase();
        var marker = "/admin/";
        var idx = lower.lastIndexOf(marker);
        if (idx === -1) return "/admin/";
        return path.slice(0, idx + marker.length);
    }

    function buildProductsLinks() {
        var adminRoot = getAdminRootPath();
        return {
            manage: adminRoot + "products/manage.html",
            categories: adminRoot + "products/categories.html"
        };
    }

    function buildOrdersLinks() {
        var adminRoot = getAdminRootPath();
        return {
            create: adminRoot + "order/create.html",
            all: adminRoot + "order/all.html",
            newOrders: adminRoot + "order/new.html",
            complete: adminRoot + "order/complete.html",
            noResponse: adminRoot + "order/no-response.html",
            hold: adminRoot + "order/hold.html",
            cancelled: adminRoot + "order/cancel.html",
            inCourier: adminRoot + "order/in-courier.html"
        };
    }

    function buildReviewsLinks() {
        var adminRoot = getAdminRootPath();
        return {
            all: adminRoot + "review/all.html",
            create: adminRoot + "review/create.html",
            pending: adminRoot + "review/pending.html"
        };
    }

    function isManagePage() {
        var path = window.location.pathname.toLowerCase();
        return path.endsWith("/admin/products/manage.html") || path.endsWith("/admin/products.html");
    }

    function isCategoriesPage() {
        var path = window.location.pathname.toLowerCase();
        return path.endsWith("/admin/products/categories.html") || path.endsWith("/admin/categories.html");
    }

    function getOrderViewFromUrl() {
        try {
            var params = new URLSearchParams(window.location.search || "");
            return String(params.get("view") || "all").toLowerCase();
        } catch (err) {
            return "all";
        }
    }

    function isOrdersPage() {
        var path = window.location.pathname.toLowerCase();
        return path.endsWith("/admin/orders.html");
    }

    function isReviewsPage() {
        var path = window.location.pathname.toLowerCase();
        return path.endsWith("/admin/reviews.html");
    }

    function isIncompletePage() {
        var path = window.location.pathname.toLowerCase();
        return path.endsWith("/admin/incomplete.html");
    }

    function getReviewViewFromUrl() {
        try {
            var params = new URLSearchParams(window.location.search || "");
            return String(params.get("view") || "all").toLowerCase();
        } catch (err) {
            return "all";
        }
    }

    function setupProductsDropdown(layout) {
        var nav = document.querySelector(".side-scroll .nav.flex-column");
        if (!nav || nav.querySelector(".nav-group.products-group")) return;

        var categoriesItem = nav.querySelector('a[href="categories.html"]');
        var productsItem = nav.querySelector('a[href="products.html"]');
        if (!categoriesItem || !productsItem) return;

        var categoriesLi = categoriesItem.closest("li");
        var productsLi = productsItem.closest("li");
        if (!categoriesLi || !productsLi) return;

        var links = buildProductsLinks();
        var groupLi = document.createElement("li");
        groupLi.className = "nav-item nav-group products-group";
        groupLi.innerHTML =
            '<button type="button" class="nav-link nav-group-toggle" aria-expanded="false">' +
                '<i class="fas fa-box-open nav-icon"></i>' +
                '<span class="nav-label">Products</span>' +
                '<i class="fas fa-angle-down nav-caret"></i>' +
            "</button>" +
            '<ul class="nav flex-column nav-submenu">' +
                '<li class="nav-item"><a class="nav-link nav-sublink" data-product-sub="manage" href="' + links.manage + '"><i class="fas fa-cube nav-icon"></i><span class="nav-label">Product Manage</span></a></li>' +
                '<li class="nav-item"><a class="nav-link nav-sublink" data-product-sub="categories" href="' + links.categories + '"><i class="fas fa-th-large nav-icon"></i><span class="nav-label">Categories</span></a></li>' +
            "</ul>";

        var insertAfter = categoriesLi;
        insertAfter.insertAdjacentElement("afterend", groupLi);
        categoriesLi.remove();
        productsLi.remove();

        var toggle = groupLi.querySelector(".nav-group-toggle");
        toggle.addEventListener("click", function () {
            groupLi.classList.toggle("open");
            toggle.setAttribute("aria-expanded", groupLi.classList.contains("open") ? "true" : "false");
        });

        var manageLink = groupLi.querySelector('[data-product-sub="manage"]');
        var categoriesLink = groupLi.querySelector('[data-product-sub="categories"]');
        if (isManagePage()) {
            groupLi.classList.add("open");
            manageLink.classList.add("active");
            toggle.setAttribute("aria-expanded", "true");
        } else if (isCategoriesPage()) {
            groupLi.classList.add("open");
            categoriesLink.classList.add("active");
            toggle.setAttribute("aria-expanded", "true");
        }

        if (layout.classList.contains("sidebar-collapsed")) {
            groupLi.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
        }
    }

    function setupOrdersDropdown(layout) {
        var nav = document.querySelector(".side-scroll .nav.flex-column");
        if (!nav || nav.querySelector(".nav-group.orders-group")) return;

        var ordersItem = nav.querySelector('a[href="orders.html"]');
        if (!ordersItem) return;

        var ordersLi = ordersItem.closest("li");
        if (!ordersLi) return;

        var links = buildOrdersLinks();
        var groupLi = document.createElement("li");
        groupLi.className = "nav-item nav-group orders-group";
        groupLi.innerHTML =
            '<button type="button" class="nav-link nav-group-toggle" aria-expanded="false">' +
                '<i class="fas fa-shopping-bag nav-icon"></i>' +
                '<span class="nav-label">Orders</span>' +
                '<i class="fas fa-angle-down nav-caret"></i>' +
            "</button>" +
            '<ul class="nav flex-column nav-submenu">' +
                '<li class="nav-item"><a class="nav-link nav-sublink" data-order-sub="create" href="' + links.create + '"><i class="fas fa-plus-circle nav-icon"></i><span class="nav-label">Create Order</span></a></li>' +
                '<li class="nav-item"><a class="nav-link nav-sublink" data-order-sub="all" href="' + links.all + '"><i class="fas fa-list nav-icon"></i><span class="nav-label">All Orders</span></a></li>' +
                '<li class="nav-item"><a class="nav-link nav-sublink" data-order-sub="new" href="' + links.newOrders + '"><i class="fas fa-bell nav-icon"></i><span class="nav-label">New Order</span></a></li>' +
                '<li class="nav-item"><a class="nav-link nav-sublink" data-order-sub="complete" href="' + links.complete + '"><i class="fas fa-check-circle nav-icon"></i><span class="nav-label">Complete Orders</span></a></li>' +
                '<li class="nav-item"><a class="nav-link nav-sublink" data-order-sub="no_response" href="' + links.noResponse + '"><i class="fas fa-phone-slash nav-icon"></i><span class="nav-label">No Response</span></a></li>' +
                '<li class="nav-item"><a class="nav-link nav-sublink" data-order-sub="hold" href="' + links.hold + '"><i class="fas fa-pause-circle nav-icon"></i><span class="nav-label">Hold Orders</span></a></li>' +
                '<li class="nav-item"><a class="nav-link nav-sublink" data-order-sub="cancelled" href="' + links.cancelled + '"><i class="fas fa-times-circle nav-icon"></i><span class="nav-label">Cancel Orders</span></a></li>' +
                '<li class="nav-item"><a class="nav-link nav-sublink" data-order-sub="in_courier" href="' + links.inCourier + '"><i class="fas fa-shipping-fast nav-icon"></i><span class="nav-label">In Courier</span></a></li>' +
            "</ul>";

        ordersLi.insertAdjacentElement("afterend", groupLi);
        ordersLi.remove();

        var toggle = groupLi.querySelector(".nav-group-toggle");
        toggle.addEventListener("click", function () {
            groupLi.classList.toggle("open");
            toggle.setAttribute("aria-expanded", groupLi.classList.contains("open") ? "true" : "false");
        });

        if (isOrdersPage()) {
            var currentView = getOrderViewFromUrl();
            var activeItem = groupLi.querySelector('[data-order-sub="' + currentView + '"]') || groupLi.querySelector('[data-order-sub="all"]');
            if (activeItem) activeItem.classList.add("active");
            groupLi.classList.add("open");
            toggle.setAttribute("aria-expanded", "true");
        }

        if (layout.classList.contains("sidebar-collapsed")) {
            groupLi.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
        }
    }

    function setupReviewsDropdown(layout) {
        var nav = document.querySelector(".side-scroll .nav.flex-column");
        if (!nav || nav.querySelector(".nav-group.reviews-group")) return;

        var reviewsItem = nav.querySelector('a[href="reviews.html"]');
        if (!reviewsItem) return;

        var reviewsLi = reviewsItem.closest("li");
        if (!reviewsLi) return;

        var links = buildReviewsLinks();
        var groupLi = document.createElement("li");
        groupLi.className = "nav-item nav-group reviews-group";
        groupLi.innerHTML =
            '<button type="button" class="nav-link nav-group-toggle" aria-expanded="false">' +
                '<i class="fas fa-star nav-icon"></i>' +
                '<span class="nav-label">Reviews</span>' +
                '<i class="fas fa-angle-down nav-caret"></i>' +
            "</button>" +
            '<ul class="nav flex-column nav-submenu">' +
                '<li class="nav-item"><a class="nav-link nav-sublink" data-review-sub="all" href="' + links.all + '"><i class="fas fa-list nav-icon"></i><span class="nav-label">All Reviews</span></a></li>' +
                '<li class="nav-item"><a class="nav-link nav-sublink" data-review-sub="create" href="' + links.create + '"><i class="fas fa-plus-circle nav-icon"></i><span class="nav-label">Create Review</span></a></li>' +
                '<li class="nav-item"><a class="nav-link nav-sublink" data-review-sub="pending" href="' + links.pending + '"><i class="fas fa-hourglass-half nav-icon"></i><span class="nav-label">Pending Reviews</span></a></li>' +
            "</ul>";

        reviewsLi.insertAdjacentElement("afterend", groupLi);
        reviewsLi.remove();

        var toggle = groupLi.querySelector(".nav-group-toggle");
        toggle.addEventListener("click", function () {
            groupLi.classList.toggle("open");
            toggle.setAttribute("aria-expanded", groupLi.classList.contains("open") ? "true" : "false");
        });

        if (isReviewsPage()) {
            var currentView = getReviewViewFromUrl();
            var activeItem = groupLi.querySelector('[data-review-sub="' + currentView + '"]') || groupLi.querySelector('[data-review-sub="all"]');
            if (activeItem) activeItem.classList.add("active");
            groupLi.classList.add("open");
            toggle.setAttribute("aria-expanded", "true");
        }

        if (layout.classList.contains("sidebar-collapsed")) {
            groupLi.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
        }
    }

    function setupIncompleteLink() {
        var nav = document.querySelector('.side-scroll .nav.flex-column');
        if (!nav || nav.querySelector('.nav-link[data-nav="incomplete"]')) return;

        var adminRoot = getAdminRootPath();
        var incompleteLi = document.createElement('li');
        incompleteLi.className = 'nav-item';
        incompleteLi.innerHTML =
            '<a class="nav-link' + (isIncompletePage() ? ' active' : '') + '" data-nav="incomplete" href="' + adminRoot + 'incomplete.html">' +
                '<i class="fas fa-clipboard-list nav-icon"></i>' +
                '<span class="nav-label">Incomplete</span>' +
            '</a>';

        var ordersGroup = nav.querySelector('.orders-group');
        if (ordersGroup) {
            ordersGroup.insertAdjacentElement('beforebegin', incompleteLi);
            return;
        }

        nav.appendChild(incompleteLi);
    }

    document.addEventListener("DOMContentLoaded", function () {
        var layout = document.querySelector(".admin-layout");
        var toggle = document.getElementById("sidebarToggle");
        if (!layout) return;

        setupProductsDropdown(layout);
        setupOrdersDropdown(layout);
        setupReviewsDropdown(layout);
        setupIncompleteLink();
        restoreSidebarState(layout);
        setupSidebarToggle(layout, toggle);
    });
})();
