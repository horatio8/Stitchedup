/* =========================================================================
   STITCHED UP — campaign site logic
   Ported from the Claude Design prototype (Stitched Up.dc.html).
   Vanilla JS, no build step. Senator data is illustrative — swap in the
   real 76-senator database (name, party, state, email, photo, position)
   before launch, and wire onSubmit() to the real serverless endpoint.
   ========================================================================= */
(function () {
  "use strict";

  // ---- config (was DC props: startingPledges / liveTicker) ----
  var CONFIG = {
    startingPledges: 248913,
    liveTicker: true
  };

  // ---- helpers ----
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var fmt = function (n) { return n.toLocaleString("en-AU"); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  // ---- static-ish reference data ----
  var FIRSTS = ["Margaret","David","Sarah","James","Helen","Peter","Karen","Andrew","Michelle","Robert","Linda","Tony","Jennifer","Mark","Susan","Brian","Catherine","Paul","Rebecca","Gary","Fiona","Stephen","Wendy","Greg","Donna","Wayne","Janet","Craig","Neil","Kerry","Glenn","Sandra","Trevor","Lisa","Bruce","Amanda","Dean","Vanessa","Colin","Megan","Russell","Kylie","Barry","Priya","Marcus","Joanne","Hamish","Leila"];
  var LASTS = ["Whitlam","Hargreave","Brennan","Okafor","Nguyen","Patel","McKenzie","Fitzgerald","Castellano","O'Brien","Donnelly","Marsh","Petrakis","Hollingsworth","Calderon","Ashford","Tanaka","Beaumont","Rahman","Sinclair","Vasquez","Pemberton","Kowalski","Hartigan","Mortimer","Bianchi","Spencer","Larsson","Forsythe","Delacroix","Kapoor","Whitmore","Salib","Eriksen","Montague","Ferreira","Holloway","Dunmore","Castle","Vereen"];
  var PARTIES = ["ALP","ALP","ALP","LIB","LIB","NAT","GRN","ONP","IND"];

  var STATUS_META = {
    IN:    { label: "In on it",          color: "#ef5350", bg: "rgba(185,28,28,.16)" },
    FIGHT: { label: "Fighting it",       color: "#4ade80", bg: "rgba(22,128,61,.16)" },
    UNK:   { label: "We don't know yet", color: "#F59E0B", bg: "rgba(245,158,11,.12)" }
  };

  var STATE_ORDER = ["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"];
  var STATE_FULL = { NSW:"New South Wales", VIC:"Victoria", QLD:"Queensland", WA:"Western Australia", SA:"South Australia", TAS:"Tasmania", ACT:"ACT", NT:"Northern Territory" };
  var STATE_FULL_EMAIL = { NSW:"New South Wales", VIC:"Victoria", QLD:"Queensland", WA:"Western Australia", SA:"South Australia", TAS:"Tasmania", ACT:"the ACT", NT:"the Northern Territory" };

  // ---- deterministic 76-senator generator (matches prototype) ----
  function makeSenators() {
    var states = [["NSW",12],["VIC",12],["QLD",12],["WA",12],["SA",12],["TAS",12],["ACT",2],["NT",2]];
    var seed = 73;
    var rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
    var arr = [];
    var id = 0;
    for (var si = 0; si < states.length; si++) {
      var st = states[si][0], n = states[si][1];
      for (var i = 0; i < n; i++) {
        var fn = pick(FIRSTS);
        var ln = pick(LASTS);
        var p = pick(PARTIES);
        var r = rnd();
        var status;
        if (p === "ALP")                      status = r < 0.68 ? "IN"    : (r < 0.86 ? "UNK" : "FIGHT");
        else if (p === "LIB" || p === "NAT")  status = r < 0.70 ? "FIGHT" : (r < 0.90 ? "UNK" : "IN");
        else if (p === "GRN")                 status = r < 0.45 ? "FIGHT" : "UNK";
        else                                  status = r < 0.60 ? "UNK"   : (r < 0.82 ? "FIGHT" : "IN");
        arr.push({
          id: id++,
          name: fn + " " + ln,
          first: fn, last: ln,
          party: p, state: st,
          status: status,
          count: 480 + Math.floor(rnd() * 5400),
          photo: "", // drop a parliamentary headshot URL here per senator
          caseNo: st + "-" + String(i + 1).padStart(2, "0")
        });
      }
    }
    return arr;
  }

  // ---- postcode -> state ----
  function postcodeState(pc) {
    var n = parseInt(pc, 10);
    if (isNaN(n)) return null;
    if (n >= 200 && n <= 299) return "ACT";
    if ((n >= 2600 && n <= 2618) || (n >= 2900 && n <= 2920)) return "ACT";
    if (n >= 800 && n <= 999) return "NT";
    if (n >= 1000 && n <= 2999) return "NSW";
    var d = Math.floor(n / 1000);
    if (d === 3) return "VIC";
    if (d === 4) return "QLD";
    if (d === 5) return "SA";
    if (d === 6) return "WA";
    if (d === 7) return "TAS";
    if (d === 0) return "NT";
    return null;
  }

  // =======================================================================
  // App state
  // =======================================================================
  var senators = makeSenators();
  var counts = {};
  senators.forEach(function (s) { counts[s.id] = s.count; });

  var state = {
    openStates: {},
    national: CONFIG.startingPledges,
    target: null,
    form: { firstName: "", lastName: "", email: "", mobile: "", postcode: "" },
    formError: "",
    submitted: false,
    conf: null
  };

  // restore persisted national count
  try {
    var saved = parseInt(localStorage.getItem("su_national") || "", 10);
    if (!isNaN(saved) && saved > state.national) state.national = saved;
  } catch (e) {}

  // =======================================================================
  // Rendering
  // =======================================================================
  function renderNational() {
    $("[data-national]").textContent = fmt(state.national);
  }

  function renderTimeline() {
    var timeline = [
      { n:"01", title:"The Promise",     date:"Mar 2025", note:"“We have no intention of changing CGT or negative gearing.”" },
      { n:"02", title:"The Election",    date:"May 2025", note:"Re-elected on that promise. You believed them." },
      { n:"03", title:"The Budget",      date:"May 2026", note:"CGT discount scrapped. Negative gearing restricted." },
      { n:"04", title:"The Bill",        date:"Jun 2026", note:"Tax Reform No.1 Bill 2026 introduced to Parliament." },
      { n:"05", title:"The Senate Vote", date:"Soon",     note:"76 senators decide. Are they in on it?" }
    ];
    $("[data-timeline]").innerHTML = timeline.map(function (t) {
      return '' +
        '<div class="su-titem su-tcon" style="position:relative;text-align:center;">' +
          '<div class="su-tdot" style="width:30px;height:30px;border-radius:50%;background:#141312;border:2.5px solid #B91C1C;margin:0 auto 14px;position:relative;z-index:1;display:flex;align-items:center;justify-content:center;font-family:\'Space Mono\',monospace;font-size:12px;color:#F59E0B;">' + esc(t.n) + '</div>' +
          '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:18px;text-transform:uppercase;color:#ece9e3;letter-spacing:.5px;">' + esc(t.title) + '</div>' +
          '<div style="font-family:\'Space Mono\',monospace;font-size:10px;color:#8a8680;margin-top:4px;">' + esc(t.date) + '</div>' +
          '<div style="font-size:13px;color:#9b968d;margin-top:8px;line-height:1.4;">' + esc(t.note) + '</div>' +
        '</div>';
    }).join("");
  }

  function senatorCardHTML(s) {
    var m = STATUS_META[s.status];
    var c = counts[s.id] || s.count;
    var hue = 18 + (s.id * 13) % 26;
    var sat = 12 + (s.id * 7) % 10;
    var lt  = 40 + (s.id * 17) % 20;
    var headColor = "hsl(" + hue + "," + sat + "%," + lt + "%)";
    var hairColor = "hsl(" + hue + "," + sat + "%," + Math.max(16, lt - 24) + "%)";
    var photo = s.photo
      ? '<img src="' + esc(s.photo) + '" alt="' + esc(s.name) + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;z-index:2;">'
      : '';
    return '' +
      '<div style="background:#1a1816;border:1px solid #2a2724;overflow:hidden;display:flex;flex-direction:column;">' +
        '<div style="position:relative;height:150px;background:linear-gradient(180deg,#2c2825,#201d1a);overflow:hidden;filter:grayscale(.5) contrast(1.04);">' +
          '<div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);width:64px;height:64px;border-radius:50%;background:' + headColor + ';z-index:1;"></div>' +
          '<div style="position:absolute;bottom:-58px;left:50%;transform:translateX(-50%);width:110px;height:82px;border-radius:54% 54% 0 0;background:' + hairColor + ';z-index:1;"></div>' +
          photo +
          '<div style="position:absolute;inset:0;background-image:repeating-linear-gradient(180deg, transparent 0 23px, rgba(255,255,255,.04) 23px 24px);z-index:3;"></div>' +
          '<div style="position:absolute;top:7px;left:8px;font-family:\'Space Mono\',monospace;font-size:9px;color:#F59E0B;letter-spacing:1px;z-index:4;">' + esc(s.caseNo) + '</div>' +
        '</div>' +
        '<div style="padding:4px 9px;font-family:\'Space Mono\',monospace;font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:' + m.color + ';background:' + m.bg + ';border-top:2px solid ' + m.color + ';">' + esc(m.label) + '</div>' +
        '<div style="padding:10px 11px 11px;flex:1;display:flex;flex-direction:column;">' +
          '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:16px;line-height:1.04;color:#ece9e3;text-transform:uppercase;">' + esc(s.name) + '</div>' +
          '<div style="font-family:\'Space Mono\',monospace;font-size:9px;color:#8a8680;margin-top:3px;letter-spacing:.5px;">' + esc(s.party) + ' · ' + esc(s.state) + '</div>' +
          '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #332f2b;font-size:10px;color:#9b968d;line-height:1.35;"><strong style="color:#F59E0B;font-family:\'Space Mono\',monospace;" data-count="' + s.id + '">' + fmt(c) + '</strong> have asked.</div>' +
          '<button data-ask="' + s.id + '" class="su-askbtn" style="margin-top:10px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:13px;letter-spacing:1.2px;text-transform:uppercase;background:transparent;color:#ece9e3;border:1.5px solid #4a463f;padding:9px 0;cursor:pointer;width:100%;">Ask them →</button>' +
        '</div>' +
      '</div>';
  }

  function renderWall() {
    var html = STATE_ORDER.map(function (st) {
      var list = senators.filter(function (s) { return s.state === st; });
      var n = list.length || 1;
      var cnt = { IN: 0, FIGHT: 0, UNK: 0 };
      list.forEach(function (s) { cnt[s.status]++; });
      var open = !!state.openStates[st];
      var inPct = Math.round(cnt.IN / n * 100) + "%";
      var unkPct = Math.round(cnt.UNK / n * 100) + "%";
      var fightPct = Math.round(cnt.FIGHT / n * 100) + "%";

      var senatorsHTML = open ?
        '<div style="padding:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:12px;border-top:1px solid #2a2724;background:#161412;">' +
          list.map(senatorCardHTML).join("") +
        '</div>' : '';

      return '' +
        '<div style="border:1px solid #2a2724;background:#1a1816;overflow:hidden;">' +
          '<button data-toggle="' + st + '" class="su-statehead" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;background:transparent;border:none;cursor:pointer;padding:15px 16px;text-align:left;">' +
            '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;min-width:0;">' +
              '<span style="font-family:\'Anton\',sans-serif;font-size:25px;color:#ece9e3;text-transform:uppercase;letter-spacing:.5px;">' + esc(st) + '</span>' +
              '<span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:600;font-size:14px;color:#8a8680;text-transform:uppercase;letter-spacing:1px;">' + esc(STATE_FULL[st]) + ' · ' + list.length + '</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:11px;flex-shrink:0;">' +
              '<span style="font-family:\'Space Mono\',monospace;font-size:12px;font-weight:700;color:#ef5350;" title="In on it">' + cnt.IN + '</span>' +
              '<span style="font-family:\'Space Mono\',monospace;font-size:12px;font-weight:700;color:#F59E0B;" title="Unknown">' + cnt.UNK + '</span>' +
              '<span style="font-family:\'Space Mono\',monospace;font-size:12px;font-weight:700;color:#4ade80;" title="Fighting it">' + cnt.FIGHT + '</span>' +
              '<span style="font-family:\'Anton\',sans-serif;font-size:24px;color:#F59E0B;line-height:1;width:18px;text-align:center;">' + (open ? "–" : "+") + '</span>' +
            '</div>' +
          '</button>' +
          '<div style="display:flex;height:4px;width:100%;">' +
            '<div style="width:' + inPct + ';background:#B91C1C;"></div>' +
            '<div style="width:' + unkPct + ';background:#F59E0B;"></div>' +
            '<div style="width:' + fightPct + ';background:#16803d;"></div>' +
          '</div>' +
          senatorsHTML +
        '</div>';
    }).join("");
    $("[data-wall]").innerHTML = html;
  }

  function renderDashboard() {
    var totals = {};
    senators.forEach(function (s) { totals[s.state] = (totals[s.state] || 0) + (counts[s.id] || s.count); });
    var max = Math.max.apply(null, STATE_ORDER.map(function (o) { return totals[o] || 0; }).concat([1]));
    $("[data-dashboard]").innerHTML = STATE_ORDER.map(function (st) {
      var pct = Math.round(((totals[st] || 0) / max) * 100) + "%";
      return '' +
        '<div style="display:grid;grid-template-columns:54px 1fr 88px;align-items:center;gap:14px;">' +
          '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:18px;color:#ece9e3;text-transform:uppercase;">' + esc(st) + '</div>' +
          '<div style="height:22px;background:#1f1d1a;position:relative;overflow:hidden;">' +
            '<div style="position:absolute;left:0;top:0;bottom:0;width:' + pct + ';background:repeating-linear-gradient(45deg,#F59E0B 0 12px,#d98a08 12px 24px);"></div>' +
          '</div>' +
          '<div style="font-family:\'Space Mono\',monospace;font-size:13px;color:#bdb8af;text-align:right;">' + fmt(totals[st] || 0) + '</div>' +
        '</div>';
    }).join("");
  }

  function renderEvidence() {
    var evidence = [
      { promiseDate:"Apr 2025", promise:"We have no intention of making any changes to negative gearing.", promiseSrc:"PM, doorstop interview",
        budgetDate:"May 2026", budget:"Negative gearing restricted to one property; grandfathering removed.", budgetSrc:"Budget Paper No. 2" },
      { promiseDate:"Mar 2025", promise:"The capital gains tax discount is staying exactly as it is.", promiseSrc:"Treasurer, press conference",
        budgetDate:"May 2026", budget:"50% CGT discount abolished for assets held under 10 years.", budgetSrc:"Budget Paper No. 2" },
      { promiseDate:"2025 campaign", promise:"No new taxes. Not now, not after the election.", promiseSrc:"Campaign launch speech",
        budgetDate:"2026", budget:"Division 296 super tax, trust distribution tax, CGT floor.", budgetSrc:"Treasury Laws Amendment Bill" }
    ];
    $("[data-evidence]").innerHTML = evidence.map(function (e) {
      return '' +
        '<div style="position:relative;border:1px solid #2a2724;background:#1a1816;">' +
          '<div class="su-split" style="display:grid;grid-template-columns:1fr 1fr;">' +
            '<div class="su-splitL" style="padding:24px;border-right:1px solid #2a2724;">' +
              '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:1px;color:#16a34a;text-transform:uppercase;margin-bottom:10px;">The promise · ' + esc(e.promiseDate) + '</div>' +
              '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:600;font-size:22px;line-height:1.12;color:#ece9e3;">"' + esc(e.promise) + '"</div>' +
              '<div style="font-family:\'Space Mono\',monospace;font-size:11px;color:#8a8680;margin-top:12px;">— ' + esc(e.promiseSrc) + '</div>' +
            '</div>' +
            '<div style="padding:24px;">' +
              '<div style="font-family:\'Space Mono\',monospace;font-size:11px;letter-spacing:1px;color:#B91C1C;text-transform:uppercase;margin-bottom:10px;">The budget · ' + esc(e.budgetDate) + '</div>' +
              '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:600;font-size:22px;line-height:1.12;color:#ece9e3;">' + esc(e.budget) + '</div>' +
              '<div style="font-family:\'Space Mono\',monospace;font-size:11px;color:#8a8680;margin-top:12px;">— ' + esc(e.budgetSrc) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="su-stamp" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-11deg);font-family:\'Anton\',sans-serif;font-size:clamp(26px,4.5vw,44px);color:#B91C1C;border:4px solid #B91C1C;padding:4px 16px;letter-spacing:2px;text-transform:uppercase;opacity:.92;background:rgba(20,19,18,.35);pointer-events:none;text-shadow:0 2px 6px rgba(0,0,0,.5);">Stitched Up</div>' +
        '</div>';
    }).join("");
  }

  function renderFighters() {
    var fighters = [
      { who:"The Coalition", tag:"Committed to repeal", detail:"Has publicly committed to repealing the bill in full if it passes the Senate." },
      { who:"David Pocock", tag:"Pushing to split the bill", detail:"Independent senator pushing to split the bill so each measure is voted on separately." },
      { who:"Jacqui Lambie", tag:"Position TBC · pressure target", detail:"Position not yet declared. A key crossbench vote. Ask her: are you in on it?" }
    ];
    $("[data-fighters]").innerHTML = fighters.map(function (f) {
      return '' +
        '<div style="border:1px solid #2a2724;border-top:3px solid #16803d;background:#1a1816;padding:22px;">' +
          '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:22px;text-transform:uppercase;color:#ece9e3;line-height:1.05;">' + esc(f.who) + '</div>' +
          '<div style="font-family:\'Space Mono\',monospace;font-size:11px;color:#4ade80;letter-spacing:1px;text-transform:uppercase;margin-top:6px;">' + esc(f.tag) + '</div>' +
          '<p style="color:#bdb8af;font-size:14px;line-height:1.5;margin:14px 0 0;">' + esc(f.detail) + '</p>' +
        '</div>';
    }).join("");
  }

  // ---- form area (form view <-> confirmation view) ----
  var INPUT_STYLE = "background:#0f0e0c;border:1.5px solid #332f2b;color:#ece9e3;padding:13px 14px;font-family:'IBM Plex Sans',sans-serif;font-size:15px;outline:none;";
  var LABEL_SPAN = "font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1px;color:#8a8680;text-transform:uppercase;";

  function renderForm() {
    var f = state.form;
    var area = $("[data-form-area]");

    if (state.submitted && state.conf) {
      area.innerHTML = '' +
        '<div style="text-align:center;">' +
          '<div style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:4px;color:#16a34a;text-transform:uppercase;margin-bottom:14px;">✓ Question sent</div>' +
          '<h2 style="font-family:\'Anton\',sans-serif;font-weight:400;font-size:clamp(34px,6vw,58px);text-transform:uppercase;margin:0 0 18px;color:#ece9e3;line-height:.96;">It\'s in their inbox.</h2>' +
          '<p style="color:#cbc6bd;font-size:16px;line-height:1.6;margin:0 auto 26px;max-width:520px;">Your question has been sent to <strong style="color:#F59E0B;">' + esc(state.conf.names) + '</strong>. Are they in on it? We\'ll find out — and we\'ll remember.</p>' +
          '<div style="text-align:left;background:#0f0e0c;border:1px solid #2a2724;margin:0 auto 26px;max-width:560px;">' +
            '<div style="background:#1a1816;padding:9px 14px;border-bottom:1px solid #2a2724;font-family:\'Space Mono\',monospace;font-size:11px;color:#8a8680;letter-spacing:1px;">CASE FILE · SENT EMAIL</div>' +
            '<div style="padding:18px;font-family:\'Space Mono\',monospace;font-size:12px;line-height:1.65;color:#bdb8af;white-space:pre-wrap;">' + esc(state.conf.body) + '</div>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">' +
            '<button data-share="x" class="su-share" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;background:transparent;border:1.5px solid #4a463f;color:#ece9e3;padding:11px 18px;cursor:pointer;">Share on X</button>' +
            '<button data-share="fb" class="su-share" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;background:transparent;border:1.5px solid #4a463f;color:#ece9e3;padding:11px 18px;cursor:pointer;">Share on Facebook</button>' +
            '<button data-reset style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;background:#F59E0B;color:#141312;border:none;padding:11px 18px;cursor:pointer;">Ask another</button>' +
          '</div>' +
        '</div>';
      return;
    }

    var targetBanner = state.target ?
      '<div style="background:#1a1816;border:1px solid #B91C1C;border-left-width:4px;padding:14px 16px;margin-bottom:22px;display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
        '<div style="font-size:14px;color:#ece9e3;">You\'re asking <strong>' + esc(state.target.name) + '</strong> <span style="color:#8a8680;font-family:\'Space Mono\',monospace;font-size:12px;">(' + esc(state.target.party + " · " + state.target.state) + ')</span> directly.</div>' +
        '<button data-cleartarget style="background:transparent;border:none;color:#8a8680;font-family:\'Space Mono\',monospace;font-size:12px;cursor:pointer;text-decoration:underline;">clear</button>' +
      '</div>' : '';

    var errorBox = state.formError ?
      '<div style="background:rgba(185,28,28,.14);border:1px solid #B91C1C;padding:11px 14px;font-family:\'Space Mono\',monospace;font-size:12px;color:#f0a0a0;">' + esc(state.formError) + '</div>' : '';

    var submitLabel = state.target ? "Ask " + state.target.last.toUpperCase() + " — are you in on it?" : "Send my question →";

    area.innerHTML = '' +
      '<div>' +
        '<div style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:4px;color:#F59E0B;text-transform:uppercase;margin-bottom:14px;text-align:center;">Ask the question</div>' +
        '<h2 style="font-family:\'Anton\',sans-serif;font-weight:400;font-size:clamp(38px,7vw,68px);text-transform:uppercase;margin:0 0 12px;color:#ece9e3;text-align:center;line-height:.95;">Send it to your senators.</h2>' +
        '<p style="text-align:center;color:#bdb8af;font-size:16px;line-height:1.5;margin:0 0 28px;">Enter your postcode and we\'ll email every senator for your state — by name — asking the only question that matters.</p>' +
        targetBanner +
        '<form data-pledge style="display:flex;flex-direction:column;gap:14px;">' +
          '<div class="su-grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">' +
            '<label style="display:flex;flex-direction:column;gap:6px;"><span style="' + LABEL_SPAN + '">First name *</span>' +
              '<input name="firstName" class="su-input" value="' + esc(f.firstName) + '" placeholder="Jane" style="' + INPUT_STYLE + '"></label>' +
            '<label style="display:flex;flex-direction:column;gap:6px;"><span style="' + LABEL_SPAN + '">Last name *</span>' +
              '<input name="lastName" class="su-input" value="' + esc(f.lastName) + '" placeholder="Citizen" style="' + INPUT_STYLE + '"></label>' +
          '</div>' +
          '<label style="display:flex;flex-direction:column;gap:6px;"><span style="' + LABEL_SPAN + '">Email *</span>' +
            '<input name="email" class="su-input" type="email" value="' + esc(f.email) + '" placeholder="jane@email.com" style="' + INPUT_STYLE + '"></label>' +
          '<div class="su-grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">' +
            '<label style="display:flex;flex-direction:column;gap:6px;"><span style="' + LABEL_SPAN + '">Mobile</span>' +
              '<input name="mobile" class="su-input" value="' + esc(f.mobile) + '" placeholder="04XX XXX XXX" style="' + INPUT_STYLE + '"></label>' +
            '<label style="display:flex;flex-direction:column;gap:6px;"><span style="' + LABEL_SPAN + '">Postcode *</span>' +
              '<input name="postcode" class="su-input" inputmode="numeric" maxlength="4" value="' + esc(f.postcode) + '" placeholder="3000" style="' + INPUT_STYLE + '"></label>' +
          '</div>' +
          errorBox +
          '<button type="submit" style="margin-top:6px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:22px;letter-spacing:1.5px;text-transform:uppercase;background:#F59E0B;color:#141312;border:none;padding:18px;cursor:pointer;box-shadow:6px 6px 0 #B91C1C;">' + esc(submitLabel) + '</button>' +
          '<p style="font-size:11px;color:#6b6760;text-align:center;font-family:\'Space Mono\',monospace;line-height:1.5;margin:4px 0 0;">Your details email your state\'s senators only. We never sell your data. See privacy policy.</p>' +
        '</form>' +
      '</div>';
  }

  // =======================================================================
  // Interactions
  // =======================================================================
  function scrollToForm() {
    var el = $("#form-section");
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
  }

  function askThem(s) {
    state.target = s;
    state.submitted = false;
    state.formError = "";
    state.conf = null;
    renderForm();
    scrollToForm();
  }

  function toggleStateGroup(st) {
    state.openStates[st] = !state.openStates[st];
    renderWall();
  }

  function submit(formEl) {
    var f = state.form;
    if (!f.firstName.trim() || !f.lastName.trim() || !f.email.trim() || !f.postcode.trim()) {
      state.formError = "Fill in your name, email and postcode to ask the question."; renderForm(); return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) {
      state.formError = "That email doesn't look right. Check it and try again."; renderForm(); return;
    }
    if (!/^\d{4}$/.test(f.postcode.trim())) {
      state.formError = "Postcode must be 4 digits (e.g. 3000)."; renderForm(); return;
    }
    var st = postcodeState(f.postcode.trim());
    if (!st) {
      state.formError = "We couldn't match that postcode to a state. Check it and try again."; renderForm(); return;
    }

    var recipients = senators.filter(function (s) { return s.state === st; });
    var target = state.target;
    if (target && target.state !== st && !recipients.some(function (r) { return r.id === target.id; })) {
      recipients = [target].concat(recipients);
    }

    // bump counts (national + per-senator)
    recipients.forEach(function (r) { counts[r.id] = (counts[r.id] || r.count) + 1; });
    state.national = state.national + 1;
    try { localStorage.setItem("su_national", String(state.national)); } catch (e) {}

    var primary = target || recipients[0];
    var stFull = STATE_FULL_EMAIL[st] || st;
    var total = fmt(state.national);
    var body =
"Subject: Are you in on it, Senator " + primary.last + "?\n\n" +
"Dear Senator " + primary.last + ",\n\n" +
"My name is " + f.firstName + " " + f.lastName + ". I am a voter in " + stFull + ".\n\n" +
"Before the last election, the Prime Minister promised — on the record — that he would not change negative gearing or capital gains tax. He broke that promise in the 2026 Budget.\n\n" +
"The Treasury Laws Amendment (Tax Reform No. 1) Bill 2026 is now before the Senate. You will be asked to vote on it.\n\n" +
"I have one question: are you in on it?\n\n" +
"Did you know before the election that these changes were planned? Will you vote for a bill that was never taken to the Australian people?\n\n" +
"I am one of " + total + " Australians who have pledged not to vote for any senator or party that supports this bill. We are watching. We are counting. And we will remember how you vote.\n\n" +
"Are you in on it, Senator " + primary.last + "? The people of " + stFull + " deserve an answer.\n\n" +
"Yours sincerely,\n" +
f.firstName + " " + f.lastName + "\n" +
f.postcode.trim() + ", " + st;

    var names = recipients.slice(0, 4).map(function (r) { return "Senator " + r.last; });
    var more = recipients.length > 4 ? " and " + (recipients.length - 4) + " more" : "";

    state.submitted = true;
    state.conf = { names: names.join(", ") + more, body: body, state: st };

    // NOTE: in production, POST {form, recipients} to the serverless endpoint
    // here, which records the entry and sends the personalised emails.

    renderForm();
    renderNational();
    renderWall();
    renderDashboard();
    setTimeout(scrollToForm, 30);
  }

  function resetForm() {
    state.submitted = false;
    state.conf = null;
    state.target = null;
    state.formError = "";
    state.form = { firstName: "", lastName: "", email: "", mobile: "", postcode: "" };
    renderForm();
  }

  function shareX() {
    var t = encodeURIComponent("I just asked my senators: are you in on it? They lied about CGT and negative gearing. Don't let them stitch us up.");
    window.open("https://twitter.com/intent/tweet?text=" + t + "&url=https://stitchedup.com.au", "_blank");
  }
  function shareFb() {
    window.open("https://www.facebook.com/sharer/sharer.php?u=https://stitchedup.com.au", "_blank");
  }

  // ---- delegated event handling ----
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-scroll-form],[data-toggle],[data-ask],[data-share],[data-reset],[data-cleartarget]");
    if (!t) return;
    if (t.hasAttribute("data-scroll-form")) { scrollToForm(); return; }
    if (t.hasAttribute("data-toggle")) { toggleStateGroup(t.getAttribute("data-toggle")); return; }
    if (t.hasAttribute("data-ask")) {
      var s = senators.find(function (x) { return x.id === parseInt(t.getAttribute("data-ask"), 10); });
      if (s) askThem(s);
      return;
    }
    if (t.hasAttribute("data-share")) { (t.getAttribute("data-share") === "x" ? shareX : shareFb)(); return; }
    if (t.hasAttribute("data-reset")) { resetForm(); return; }
    if (t.hasAttribute("data-cleartarget")) { state.target = null; renderForm(); return; }
  });

  document.addEventListener("input", function (ev) {
    var el = ev.target;
    if (!el.name || !(el.name in state.form)) return;
    if (el.name === "postcode") el.value = el.value.replace(/[^0-9]/g, "").slice(0, 4);
    state.form[el.name] = el.value;
    if (state.formError) { state.formError = ""; var box = $("[data-pledge]"); /* keep typing smooth: clear silently */ }
  });

  document.addEventListener("submit", function (ev) {
    if (ev.target && ev.target.matches("[data-pledge]")) {
      ev.preventDefault();
      submit(ev.target);
    }
  });

  // ---- live ticker ----
  function startTicker() {
    if (!CONFIG.liveTicker) return;
    setInterval(function () {
      var inc = 2 + Math.floor(Math.random() * 11);
      state.national += inc;
      try { localStorage.setItem("su_national", String(state.national)); } catch (e) {}
      for (var k = 0; k < 3; k++) {
        var rs = senators[Math.floor(Math.random() * senators.length)];
        counts[rs.id] = (counts[rs.id] || rs.count) + Math.floor(Math.random() * 3);
        // update any visible per-senator count without re-rendering the wall
        var cell = document.querySelector('[data-count="' + rs.id + '"]');
        if (cell) cell.textContent = fmt(counts[rs.id]);
      }
      renderNational();
      renderDashboard();
    }, 2200);
  }

  // ---- boot ----
  renderNational();
  renderTimeline();
  renderWall();
  renderDashboard();
  renderEvidence();
  renderFighters();
  renderForm();
  startTicker();
})();
