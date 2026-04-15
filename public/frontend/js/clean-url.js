(function () {
    "use strict";

    function isLocalHost(hostname) {
        var host = String(hostname || "").toLowerCase();
        if (!host) return true;
        if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    }

    function shouldApplyCleanUrl() {
        // Keep clean URL conversion opt-in to avoid reload 404 on basic static servers.
        if (window.D2W_ENABLE_CLEAN_URL !== true) return false;

        try {
            var hostname = (window.location && window.location.hostname) || "";
            return !isLocalHost(hostname);
        } catch (err) {
            return false;
        }
    }

    function toCleanPath(pathname) {
        var match = String(pathname || "").match(/^(.*\/)([^\/?#]+)\.html$/i);
        if (!match) return pathname;

        var dir = match[1] || "/";
        var file = (match[2] || "").toLowerCase();

        if (file === "index") {
            return dir;
        }

        return dir + file;
    }

    function applyCleanUrl() {
        if (!shouldApplyCleanUrl()) return;

        try {
            var current = new URL(window.location.href);
            var cleanPath = toCleanPath(current.pathname);
            if (cleanPath === current.pathname) return;
            window.history.replaceState(null, "", cleanPath + current.search + current.hash);
        } catch (err) {
            // Keep navigation working even if URL cleanup fails.
        }
    }

    applyCleanUrl();
})();
