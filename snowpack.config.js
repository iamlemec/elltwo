export default {
    mount: {
        static: '/',
        "node_modules/gum.js/bin": {
            url: "/css/gum",
            static: true,
            resolve: false,
        },
        "node_modules/katex/dist": {
            url: "/css/katex",
            static: true,
            resolve: false,
        }
    },
    devOptions: {
        open: 'none',
    },
}
