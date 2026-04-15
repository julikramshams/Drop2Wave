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

    document.addEventListener("DOMContentLoaded", function () {
        var layout = document.querySelector(".admin-layout");
        var toggle = document.getElementById("sidebarToggle");
        if (!layout) return;

        restoreSidebarState(layout);
        setupSidebarToggle(layout, toggle);
    });
})();
