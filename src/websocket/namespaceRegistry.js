// Registry to store namespace references and avoid circular dependencies
let webNamespace = null;

module.exports = {
    setWebNamespace(ns) {
        webNamespace = ns;
    },
    getWebNamespace() {
        return webNamespace;
    }
};
