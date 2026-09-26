function y1() {
            const [A, tt] = jt.useState(null), b = (S, f) => {
                tt({
                    fbUrl: S,
                    fbKey: f
                })
            }, handleConnectAll = (accs) => {
                if (!accs || accs.length === 0) return;
                tt({
                    accounts: accs,
                    fbUrl: accs[0].url,
                    fbKey: accs[0].key,
                    isMerged: !0
                })
            }, d = () => {
                tt(null)
            };
            return A ? r.jsx(p1, {
                fbUrl: A.fbUrl,
                fbKey: A.fbKey,
                accounts: A.accounts,
                isMerged: A.isMerged,
                onLogout: d
            }) : r.jsx(s1, {
                onConnect: b,
                onConnectAll: handleConnectAll
            })
        }
        Y0.createRoot(document.getElementById("root")).render(r.jsx(y1, {}));
    