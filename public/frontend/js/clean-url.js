(function () {
    "use strict";

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
