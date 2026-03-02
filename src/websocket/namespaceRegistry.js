// Registry to store namespace references and avoid circular dependencies
let webNamespace = null;
let desktopNamespace = null;

module.exports = {
    setWebNamespace(ns) {
        webNamespace = ns;
    },
    getWebNamespace() {
        return webNamespace;
    },
    setDesktopNamespace(ns) {
        desktopNamespace = ns;
    },
    getDesktopNamespace() {
        return desktopNamespace;
    }
};
