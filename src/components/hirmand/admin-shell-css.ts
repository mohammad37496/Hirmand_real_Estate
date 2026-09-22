export const ADMIN_CSS = `
.admin-app{min-height:100vh;display:flex;background:#111315;color:#f7f5ef;font-family:var(--font,Vazirmatn,Tahoma,sans-serif)}
.admin-sidebar{width:240px;flex-shrink:0;border-left:1px solid rgba(244,239,230,.08);background:linear-gradient(180deg,#111315 0%,#111315 100%);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;z-index:30}
.admin-sidebar-brand .brand-logo-nav{width:44px;height:44px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 7px 18px rgba(247,245,239,.18))}
.admin-sidebar-brand{padding:22px 18px 18px;border-bottom:1px solid rgba(244,239,230,.08);display:flex;align-items:center;gap:12px}
.admin-sidebar-brand strong{display:block;font-size:.95rem;font-weight:700}
.admin-sidebar-brand small{color:rgb(247 245 239 / .56);font-size:.72rem}
.admin-sidebar-nav{padding:14px 10px;display:flex;flex-direction:column;gap:4px;flex:1}
.admin-nav-btn{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:12px;border:0;background:transparent;color:rgb(247 245 239 / .68);font:inherit;font-size:.9rem;font-weight:500;cursor:pointer;text-align:right;transition:background .15s,color .15s}
.admin-nav-btn:hover{background:rgba(255,255,255,.04);color:#f7f5ef}
.admin-nav-btn.is-active{background:rgba(247,245,239,.12);color:#f7f5ef}
.admin-nav-btn svg{flex-shrink:0;opacity:.85}
.admin-sidebar-foot{padding:14px 10px 18px;border-top:1px solid rgba(244,239,230,.08);display:flex;flex-direction:column;gap:4px}
.admin-main{flex:1;min-width:0;display:flex;flex-direction:column}
.admin-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;border-bottom:1px solid rgba(244,239,230,.08);background:rgba(7,9,13,.85);backdrop-filter:blur(12px);position:sticky;top:0;z-index:20}
.admin-topbar h1{font-size:1.15rem;font-weight:700;margin:0}
.admin-topbar p{margin:2px 0 0;color:rgb(247 245 239 / .56);font-size:.82rem}
.admin-topbar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.admin-content{padding:24px;flex:1;width:100%;max-width:1680px;margin:0 auto;box-sizing:border-box}
.admin-stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:24px}
.admin-stat-card{border:1px solid rgba(244,239,230,.1);background:rgba(16,20,26,.9);border-radius:16px;padding:18px 16px;cursor:pointer;transition:border-color .15s,background .15s}
.admin-stat-card:hover{border-color:rgba(247,245,239,.35)}
.admin-stat-card.is-active{border-color:rgba(247,245,239,.55);background:rgba(247,245,239,.08)}
.admin-stat-card span{display:block;color:rgb(247 245 239 / .56);font-size:.78rem;font-weight:600;margin-bottom:6px}
.admin-stat-card strong{font-size:1.55rem;font-weight:700;letter-spacing:-.02em}
.admin-stat-card[data-tone="green"] strong{color:#f7f5ef}
.admin-stat-card[data-tone="amber"] strong{color:#f7f5ef}
.admin-stat-card[data-tone="muted"] strong{color:rgb(247 245 239 / .52)}
.admin-stat-card[data-tone="gold"] strong{color:#f7f5ef}
.admin-panel{border:1px solid rgba(244,239,230,.1);background:rgba(16,20,26,.75);border-radius:20px;overflow:hidden}
.admin-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid rgba(244,239,230,.08);flex-wrap:wrap}
.admin-panel-head h2{margin:0;font-size:1.05rem;font-weight:700}
.admin-panel-head .kicker{display:block;color:#f7f5ef;font-size:.72rem;font-weight:600;letter-spacing:.1em;margin-bottom:4px}
.admin-list-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.admin-search{display:flex;align-items:center;gap:8px;border:1px solid rgba(244,239,230,.12);border-radius:12px;padding:8px 12px;background:rgba(7,9,13,.6);min-width:min(260px,100%)}
.admin-search input{border:0;background:transparent;color:inherit;outline:none;width:100%;font:inherit;font-size:.9rem}
.admin-property-list{display:flex;flex-direction:column}
.admin-property-card{display:grid;grid-template-columns:88px 1fr auto;gap:16px;align-items:center;padding:14px 20px;border-bottom:1px solid rgba(244,239,230,.06);transition:background .15s}
.admin-property-card:last-child{border-bottom:0}
.admin-property-card:hover{background:rgba(255,255,255,.025)}
.admin-property-thumb{width:88px;height:66px;border-radius:12px;overflow:hidden;background:#111315;flex-shrink:0}
.admin-property-thumb img{width:100%;height:100%;object-fit:cover}
.admin-property-meta{min-width:0}
.admin-property-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.admin-property-tags span{font-size:.72rem;font-weight:600;padding:3px 9px;border-radius:999px}
.admin-property-tags span[data-status="published"]{background:rgba(247,245,239,.18);color:#f7f5ef}
.admin-property-tags span[data-status="draft"]{background:rgba(247,245,239,.16);color:#f7f5ef}
.admin-property-tags span[data-status="archived"]{background:rgba(154,163,178,.16);color:rgb(247 245 239 / .52)}
.admin-property-tags span[data-featured]{background:rgba(247,245,239,.2);color:#f7f5ef}
.admin-property-meta h3{margin:0;font-size:.95rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.admin-property-meta p{margin:4px 0 0;color:rgb(247 245 239 / .56);font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.admin-property-actions{display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.admin-icon-btn{width:36px;height:36px;display:grid;place-items:center;border:1px solid rgba(244,239,230,.1);border-radius:10px;background:rgba(255,255,255,.03);color:rgb(247 245 239 / .68);cursor:pointer;transition:border-color .15s,color .15s,background .15s}
.admin-icon-btn:hover{border-color:rgba(247,245,239,.4);color:#f7f5ef;background:rgba(247,245,239,.08)}
.admin-icon-btn.danger:hover{border-color:rgba(247,245,239,.45);color:#f7f5ef;background:rgba(247,245,239,.1)}
.admin-nav-btn:focus-visible,.admin-icon-btn:focus-visible,.btn-gold:focus-visible,.btn-ghost:focus-visible{outline:2px solid rgba(247,245,239,.75);outline-offset:2px}
 .admin-nav-btn:disabled,.admin-icon-btn:disabled{opacity:.5;cursor:not-allowed}
.admin-empty{text-align:center;padding:56px 20px;color:rgb(247 245 239 / .56)}
.admin-empty svg{margin:0 auto 12px;opacity:.5}
.admin-empty strong{display:block;color:#f7f5ef;margin-bottom:6px;font-size:1.05rem}
.admin-form-wrap{display:flex;flex-direction:column;gap:0;padding-bottom:88px}
.admin-form-sections{display:flex;flex-direction:column;gap:16px}
.admin-section{border:1px solid rgba(244,239,230,.1);background:rgba(16,20,26,.7);border-radius:18px;padding:18px 20px}
.admin-section legend{padding:0 6px;font-size:.82rem;color:#f7f5ef;font-weight:700;letter-spacing:.04em}
.admin-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.admin-form-grid-dense{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}
.admin-span-2{grid-column:1/-1}
.admin-checks{display:flex;flex-wrap:wrap;gap:14px 22px;margin-top:14px}
.admin-checks label{display:flex;align-items:center;gap:8px;font-size:.9rem;cursor:pointer;color:rgb(247 245 239 / .68)}
.admin-checks input{accent-color:#f7f5ef;width:16px;height:16px}
.admin-money-hint{display:block;margin-top:4px;color:#f7f5ef;font-size:.78rem}
.admin-sticky-bar{position:fixed;bottom:0;left:0;right:0;z-index:40;padding:12px 24px;background:rgba(7,9,13,.92);backdrop-filter:blur(16px);border-top:1px solid rgba(244,239,230,.1);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.admin-sticky-bar-info{color:rgb(247 245 239 / .56);font-size:.85rem}
.admin-sticky-bar-info strong{color:#f7f5ef}
.admin-sticky-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.admin-login{min-height:100vh;display:grid;place-items:center;padding:24px;background:#111315}
.admin-login-card{width:min(100%,420px);border:1px solid rgba(244,239,230,.12);background:rgba(16,20,26,.95);border-radius:24px;padding:32px 28px;box-shadow:0 24px 60px rgba(0,0,0,.4)}
.admin-login-card .kicker{color:#f7f5ef;font-size:.75rem;font-weight:600;letter-spacing:.12em;display:block;margin-bottom:8px}
.admin-login-card h1{margin:0 0 6px;font-size:1.35rem;font-weight:700}
.admin-login-card p{margin:0 0 24px;color:rgb(247 245 239 / .56);font-size:.9rem}
.admin-key-row{display:flex;gap:8px}
.admin-key-row input{flex:1;min-height:48px;padding:10px 14px;border:1px solid rgba(244,239,230,.12);border-radius:12px;background:rgba(255,255,255,.03);outline:none;font:inherit}
.admin-key-row input:focus{border-color:rgba(247,245,239,.45);box-shadow:0 0 0 3px rgba(247,245,239,.12)}
.admin-mobile-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:35;background:rgba(7,9,13,.95);backdrop-filter:blur(14px);border-top:1px solid rgba(244,239,230,.1);padding:6px 8px calc(6px + env(safe-area-inset-bottom));justify-content:space-around}
.admin-mobile-nav button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 12px;border:0;background:transparent;color:rgb(247 245 239 / .56);font:inherit;font-size:.68rem;cursor:pointer}
.admin-mobile-nav button.is-active{color:#f7f5ef}
@keyframes admin-spin{to{transform:rotate(360deg)}}
.admin-spin{animation:admin-spin .8s linear infinite}
.admin-field label,.admin-section .field>span{display:block;color:rgb(247 245 239 / .68);font-size:.8rem;font-weight:600;margin-bottom:6px}
.admin-section .field input,.admin-section .field select,.admin-section .field textarea{width:100%;min-height:46px;padding:10px 12px;border:1px solid rgba(244,239,230,.1);border-radius:12px;background:rgba(255,255,255,.03);outline:none;font:inherit;color:inherit}
.admin-section .field textarea{min-height:110px;resize:vertical}
.admin-section .field input:focus,.admin-section .field select:focus,.admin-section .field textarea:focus{border-color:rgba(247,245,239,.4);box-shadow:0 0 0 3px rgba(247,245,239,.1)}
.btn-gold,.btn-ghost{min-height:44px;padding:9px 16px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:999px;font-size:.88rem;font-weight:600;border:1px solid transparent;cursor:pointer;transition:transform .12s,filter .12s,background .12s,border-color .12s}
.btn-gold{color:#111315;background:#f7f5ef;box-shadow:0 6px 18px rgba(247,245,239,.2)}
.btn-gold:hover{filter:brightness(1.06)}
.btn-gold:disabled{opacity:.55;cursor:not-allowed}
.btn-ghost{color:#f7f5ef;border-color:rgba(244,239,230,.12);background:rgba(255,255,255,.04)}
.btn-ghost:hover{border-color:rgba(247,245,239,.35);background:rgba(247,245,239,.08)}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.admin-consultant{display:flex;flex-direction:column;gap:12px}
.admin-consultant-hint{margin:0;color:rgb(247 245 239 / .52);font-size:.85rem}
.admin-consultant-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.admin-consultant-card{display:flex;align-items:center;gap:12px;padding:14px 14px;border-radius:14px;border:1px solid rgba(244,239,230,.12);background:rgba(15,18,24,.75);color:#f7f5ef;font:inherit;text-align:right;cursor:pointer;transition:border-color .15s,background .15s,transform .12s;position:relative}
.admin-consultant-card:hover{border-color:rgba(247,245,239,.45);background:rgba(247,245,239,.06)}
.admin-consultant-card.is-active{border-color:rgba(247,245,239,.75);background:rgba(247,245,239,.12);box-shadow:0 0 0 1px rgba(247,245,239,.25)}
.admin-consultant-icon{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(247,245,239,.14);color:#f7f5ef;flex-shrink:0}
.admin-consultant-meta{display:flex;flex-direction:column;gap:2px;min-width:0}
.admin-consultant-meta strong{font-size:.95rem;font-weight:700}
.admin-consultant-meta small{color:rgb(247 245 239 / .52);font-size:.78rem}
.admin-consultant-meta span{color:rgb(247 245 239 / .68);font-size:.8rem;direction:ltr}
.admin-consultant-check{position:absolute;top:10px;left:10px;width:24px;height:24px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(247,245,239,.9);color:#111315}
.admin-consultant-select select{width:100%;min-height:44px;border-radius:12px;border:1px solid rgba(244,239,230,.12);background:rgba(15,18,24,.85);color:#f7f5ef;padding:10px 12px;font:inherit}
.admin-media{display:flex;flex-direction:column;gap:10px}
.admin-media-drop{border:1.5px dashed rgba(247,245,239,.35);border-radius:16px;padding:22px 16px;text-align:center;cursor:pointer;background:rgba(15,18,24,.5);display:flex;flex-direction:column;align-items:center;gap:6px;color:rgb(247 245 239 / .52)}
.admin-media-drop strong{color:#f7f5ef}
.admin-media-drop.is-over{border-color:rgba(247,245,239,.7);background:rgba(247,245,239,.06)}
.admin-media-drop.is-busy{pointer-events:none;opacity:.75}
.admin-media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;margin-top:4px}
.admin-media-item{position:relative;aspect-ratio:4/3;border-radius:12px;overflow:hidden;background:#111315;cursor:grab;transition:transform .18s ease,opacity .18s ease,box-shadow .18s ease}.admin-media-item:active{cursor:grabbing}.admin-media-item.is-dragging{opacity:.55;transform:scale(.97);box-shadow:0 0 0 2px rgba(247,245,239,.55)}
.admin-media-item img,.admin-media-item video{width:100%;height:100%;object-fit:cover}
.admin-media-badge{position:absolute;top:6px;right:6px;background:rgba(0,0,0,.55);border-radius:8px;padding:3px 6px;color:#f7f5ef;display:flex}
.admin-media-remove{position:absolute;bottom:6px;left:6px;width:28px;height:28px;border:0;border-radius:8px;background:rgba(180,40,40,.85);color:#f7f5ef;display:flex;align-items:center;justify-content:center;cursor:pointer}

.admin-music-manager{display:flex;flex-direction:column;gap:16px}
.admin-music-head h2{margin:0;font-size:1.05rem}
.admin-music-head p{margin:6px 0 0;color:rgb(247 245 239 / .56);font-size:.82rem;line-height:1.8}
.admin-music-upload{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px;align-items:end}
.admin-music-upload .admin-music-file{display:flex;flex-direction:column;gap:6px}
.admin-music-file>span{color:rgb(247 245 239 / .68);font-size:.8rem;font-weight:600}
.admin-music-file input{width:100%;min-height:46px;padding:9px 10px;border:1px solid rgba(244,239,230,.1);border-radius:12px;background:rgba(255,255,255,.03);color:rgb(247 245 239 / .68);font:inherit}
.admin-music-file small{color:rgb(247 245 239 / .56);font-size:.74rem;line-height:1.6}
.admin-music-upload>.btn-gold{min-height:46px;width:max-content}
.admin-music-list{display:flex;flex-direction:column}
.admin-music-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 16px;border-bottom:1px solid rgba(244,239,230,.06)}
.admin-music-row:last-child{border-bottom:0}
.admin-music-main{min-width:0}
.admin-music-title-row{display:flex;align-items:center;gap:8px;min-width:0}
.admin-music-title-row strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.9rem}
.admin-music-main>span{display:block;margin-top:4px;color:rgb(247 245 239 / .56);font-size:.78rem}
.admin-music-active,.admin-music-inactive{display:inline-flex;flex-shrink:0;padding:2px 7px;border-radius:999px;font-size:.68rem;font-weight:700}
.admin-music-active{background:rgba(247,245,239,.16);color:#f7f5ef}
.admin-music-inactive{background:rgba(154,163,178,.14);color:rgb(247 245 239 / .52)}
.admin-music-progress{height:3px;margin-top:8px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.08)}
.admin-music-progress span{display:block;height:100%;border-radius:inherit;background:#f7f5ef;transition:width .12s linear}
@media (max-width:960px){
  .admin-music-upload{grid-template-columns:1fr}
  .admin-music-upload>.btn-gold{width:100%}
  .admin-music-row{grid-template-columns:40px minmax(0,1fr)}
  .admin-music-row>.admin-property-actions{grid-column:2;justify-content:flex-start;padding-top:0}
}


.admin-lead-manager{display:flex;flex-direction:column;gap:16px}
.admin-lead-list{display:flex;flex-direction:column}
.admin-lead-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;padding:16px 18px;border-bottom:1px solid rgba(244,239,230,.07)}
.admin-lead-card:last-child{border-bottom:0}
.admin-lead-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.admin-lead-title strong{font-size:.95rem}
.admin-lead-status{display:inline-flex;padding:3px 8px;border-radius:999px;font-size:.68rem;font-weight:700}
.admin-lead-status.status-new{background:rgba(247,245,239,.18);color:#f7f5ef}
.admin-lead-status.status-contacted{background:rgba(247,245,239,.16);color:rgb(247 245 239 / .72)}
.admin-lead-status.status-closed{background:rgba(247,245,239,.16);color:#f7f5ef}
.admin-lead-status.status-spam{background:rgba(247,245,239,.14);color:#f7f5ef}
.admin-lead-phone{display:inline-flex;align-items:center;gap:6px;margin-top:7px;color:#f7f5ef;text-decoration:none;direction:ltr}
.admin-lead-main>p{margin:6px 0;color:rgb(247 245 239 / .52);font-size:.8rem;line-height:1.8}
.admin-lead-main>small{display:block;margin-top:8px;color:rgb(247 245 239 / .48)}
.admin-lead-note{margin-top:8px;padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.03);color:rgb(247 245 239 / .68);font-size:.8rem;line-height:1.8}
.admin-lead-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.admin-lead-status-select{min-height:36px;border:1px solid rgba(244,239,230,.1);border-radius:10px;background:#111315;color:#f7f5ef;padding:7px 10px;font:inherit;font-size:.78rem}

@media (max-width:960px){
  .admin-sidebar{display:none}
  .admin-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .admin-property-card{grid-template-columns:72px 1fr;gap:12px}
  .admin-property-actions{grid-column:1/-1;justify-content:flex-start;padding-top:4px}
  .admin-form-grid{grid-template-columns:1fr}
  .admin-mobile-nav{display:flex}
  .admin-content{padding:16px 14px 88px}
  .admin-topbar{padding:12px 14px}
  .admin-sticky-bar{padding:10px 14px calc(10px + env(safe-area-inset-bottom))}
}
@media (max-width:520px){
  .admin-stats-grid{grid-template-columns:1fr 1fr;gap:10px}
  .admin-stat-card strong{font-size:1.3rem}
  .admin-consultant-grid{grid-template-columns:1fr}
}

.admin-dashboard{display:flex;flex-direction:column;gap:16px;max-width:1380px;margin:0 auto;direction:rtl}

.admin-dashboard-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.admin-dashboard-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.admin-dashboard-grid .admin-panel{min-width:0}

.admin-dashboard-stat{position:relative;display:grid;grid-template-columns:42px 1fr 16px;gap:10px;align-items:center;text-align:right;border:1px solid rgba(244,239,230,.1);background:rgba(16,20,26,.8);border-radius:16px;padding:15px 14px;color:#f7f5ef;font:inherit;cursor:pointer;transition:transform .15s,border-color .15s,background .15s}
.admin-dashboard-stat:hover{transform:translateY(-1px);border-color:rgba(247,245,239,.4);background:rgba(247,245,239,.05)}
.admin-dashboard-stat-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(247,245,239,.12);color:#f7f5ef}
.admin-dashboard-stat[data-tone="green"] .admin-dashboard-stat-icon{background:rgba(247,245,239,.12);color:#f7f5ef}
.admin-dashboard-stat[data-tone="amber"] .admin-dashboard-stat-icon{background:rgba(247,245,239,.12);color:#f7f5ef}
.admin-dashboard-stat[data-tone="blue"] .admin-dashboard-stat-icon{background:rgba(247,245,239,.12);color:rgb(247 245 239 / .72)}
.admin-dashboard-stat small{display:block;color:rgb(247 245 239 / .56);font-size:.76rem;margin-bottom:4px}
.admin-dashboard-stat strong{display:block;font-size:1.35rem}
.admin-dashboard-stat>svg{color:rgb(247 245 239 / .48)}
.admin-dashboard-grid{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr);gap:16px}
.admin-funnel{display:flex;flex-direction:column;gap:13px;padding:18px 20px 8px}
.admin-funnel-label{display:flex;justify-content:space-between;gap:10px;color:rgb(247 245 239 / .68);font-size:.8rem;margin-bottom:6px}
.admin-funnel-label strong{color:#f7f5ef}
.admin-funnel-track,.admin-breakdown-track{height:8px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}
.admin-funnel-track span,.admin-breakdown-track span{display:block;height:100%;min-width:5px;border-radius:inherit;background:#f7f5ef;transition:width .25s ease}
.admin-funnel-track span[data-tone="green"]{background:#f7f5ef}
.admin-funnel-track span[data-tone="blue"]{background:rgb(247 245 239 / .72)}
.admin-funnel-track span[data-tone="red"]{background:#f7f5ef}
.admin-dashboard-mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;padding:8px 20px 18px}
.admin-dashboard-mini-grid>div{border:1px solid rgba(244,239,230,.07);border-radius:12px;padding:10px 11px;background:rgba(255,255,255,.02)}
.admin-dashboard-mini-grid span{display:block;color:rgb(247 245 239 / .48);font-size:.72rem;margin-bottom:4px}
.admin-dashboard-mini-grid strong{font-size:.95rem}
.admin-breakdown{display:flex;flex-direction:column;gap:13px;padding:18px 20px 8px}
.admin-breakdown-row>div:first-child{display:flex;justify-content:space-between;gap:10px;color:rgb(247 245 239 / .68);font-size:.8rem;margin-bottom:6px}
.admin-breakdown-row strong{color:#f7f5ef}
.admin-breakdown-track span{background:rgb(247 245 239 / .60)}.admin-dashboard-summary{color:#f7f5ef;font-size:.78rem;font-weight:600}
.admin-lead-chart{height:220px;display:grid;grid-template-columns:repeat(7,1fr);gap:10px;align-items:end;padding:20px 22px 18px}
.admin-lead-chart-col{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:7px;min-width:0}
.admin-lead-chart-value{height:18px;color:rgb(247 245 239 / .68);font-size:.7rem}
.admin-lead-chart-bar-wrap{height:150px;width:min(28px,65%);display:flex;align-items:flex-end;background:rgba(255,255,255,.025);border-radius:10px;overflow:hidden}
.admin-lead-chart-bar-wrap span{width:100%;min-height:4px;border-radius:9px 9px 4px 4px;background:#f7f5ef;opacity:.9;transition:height .25s ease}
.admin-lead-chart-col small{color:rgb(247 245 239 / .56);font-size:.7rem}
.admin-recent-leads{display:flex;flex-direction:column}
.admin-recent-lead{display:grid;grid-template-columns:34px minmax(0,1fr) 36px;gap:10px;align-items:center;padding:12px 18px;border-bottom:1px solid rgba(244,239,230,.06)}
.admin-recent-lead:last-child{border-bottom:0}
.admin-recent-lead-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:rgba(247,245,239,.1);color:#f7f5ef}
.admin-recent-lead-main{min-width:0}
.admin-recent-lead-title{display:flex;align-items:center;gap:8px;min-width:0}
.admin-recent-lead-title strong{font-size:.86rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.admin-recent-lead-main small{display:block;margin-top:4px;color:rgb(247 245 239 / .56);font-size:.73rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.admin-dashboard-footer-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.admin-dashboard .admin-panel{box-shadow:0 10px 35px rgba(0,0,0,.12)}
.admin-dashboard-stat{min-width:0}

.admin-dashboard-footer-card{border:1px solid rgba(244,239,230,.08);border-radius:16px;background:rgba(16,20,26,.6);padding:15px}
.admin-dashboard-footer-card span{display:flex;align-items:center;gap:7px;color:rgb(247 245 239 / .68);font-size:.8rem}
.admin-dashboard-footer-card span svg{color:#f7f5ef}
.admin-dashboard-footer-card strong{display:block;font-size:1.05rem;margin-top:8px}
.admin-dashboard-footer-card small{display:block;color:rgb(247 245 239 / .48);font-size:.7rem;margin-top:3px}

.properties-index-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:18px}
.properties-loading-pill{flex-shrink:0;border:1px solid rgba(247,245,239,.25);color:#f7f5ef;background:rgba(247,245,239,.07);padding:7px 10px;border-radius:999px;font-size:.72rem}
.properties-filter-panel{grid-template-columns:2fr repeat(3,minmax(130px,1fr))}
.properties-filter-search,.properties-sort-field,.properties-range-field{display:flex;flex-direction:column;gap:5px}
.properties-filter-search{grid-column:span 2;flex-direction:row;align-items:center;padding:0 12px}
.properties-filter-search input{border:0!important;background:transparent!important;padding:10px 0!important}
.properties-range-field span,.properties-sort-field span{color:rgb(247 245 239 / .56);font-size:.68rem;font-weight:600}
.properties-range-field input,.properties-sort-field select{min-height:42px}
.properties-sort-field select{width:100%;border:1px solid rgba(244,239,230,.1);border-radius:12px;background:rgba(255,255,255,.03);color:#f7f5ef;padding:9px 10px;font:inherit}
.properties-result-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.properties-reset-btn{display:inline-flex;align-items:center;gap:6px;background:transparent;border:0;color:rgb(247 245 239 / .52);font:inherit;font-size:.78rem;cursor:pointer}
.properties-reset-btn:hover{color:#f7f5ef}
.properties-empty-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
.properties-load-more{display:flex;justify-content:center;margin-top:24px}
@media (max-width:1100px){
  .admin-dashboard-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .properties-filter-panel{grid-template-columns:repeat(2,minmax(0,1fr))}
  .properties-filter-search{grid-column:1/-1}
}
@media (max-width:700px){
  .admin-dashboard-grid{grid-template-columns:1fr}
  .admin-dashboard-stats{grid-template-columns:1fr 1fr}
  .admin-lead-chart{padding-inline:12px;gap:5px}
  .admin-lead-chart-bar-wrap{width:min(24px,70%)}
  .admin-dashboard-actions{justify-content:stretch}
  .admin-dashboard-actions>*{flex:1}
  .properties-filter-panel{grid-template-columns:1fr}
  .properties-filter-search{grid-column:auto}
  .properties-index-heading{align-items:flex-start;flex-direction:column}
}
.admin-pricing-panel{display:flex;flex-direction:column;gap:12px}
.admin-price-help{display:flex;align-items:flex-start;gap:8px;margin:0;padding:10px 12px;border:1px solid rgba(247,245,239,.14);border-radius:12px;background:rgba(247,245,239,.05);color:rgb(247 245 239 / .52);font-size:.76rem;line-height:1.8}
.admin-price-help svg{flex:0 0 auto;margin-top:2px;color:#f7f5ef}
.admin-price-calculator{padding:15px;border:1px solid rgba(247,245,239,.18);border-radius:15px;background:rgba(247,245,239,.04)}
.admin-price-calculator-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.admin-price-calculator-head>svg{color:#f7f5ef}
.admin-price-calculator-head .kicker{display:block;color:#f7f5ef;font-size:.68rem;margin-bottom:4px}
.admin-price-calculator-head strong{font-size:.9rem}
.admin-rate-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:12px}
.admin-rate-row>span{color:rgb(247 245 239 / .56);font-size:.75rem}
.admin-rate-row button{border:1px solid rgba(244,239,230,.1);background:rgba(255,255,255,.02);color:rgb(247 245 239 / .68);border-radius:10px;padding:6px 9px;font:inherit;font-size:.7rem;cursor:pointer}
.admin-rate-row button.is-active{border-color:rgba(247,245,239,.55);background:rgba(247,245,239,.12);color:#f7f5ef}
.admin-rate-row small{color:rgb(247 245 239 / .48);font-size:.68rem}
.admin-price-conversion-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:11px}
.admin-price-conversion-grid>div{padding:10px 11px;border:1px solid rgba(244,239,230,.07);border-radius:11px;background:rgba(255,255,255,.02)}
.admin-price-conversion-grid span{display:block;color:rgb(247 245 239 / .56);font-size:.7rem}
.admin-price-conversion-grid strong{display:block;margin-top:4px;font-size:.84rem}
.admin-price-calc-note{display:flex;align-items:flex-start;gap:6px;margin:10px 0 0;color:rgb(247 245 239 / .48);font-size:.68rem;line-height:1.7}
.admin-price-calc-note svg{flex:0 0 auto;margin-top:2px;color:#f7f5ef}
.admin-media-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;color:rgb(247 245 239 / .56);font-size:.72rem}
.admin-media-toolbar strong{color:#f7f5ef}
.admin-media-item.is-primary{box-shadow:0 0 0 1px rgba(247,245,239,.5),0 6px 18px rgba(0,0,0,.2)}
.admin-media-primary{position:absolute;left:6px;top:6px;padding:3px 7px;border-radius:999px;background:rgba(247,245,239,.9);color:#111315;font-size:.62rem;font-weight:800}
.admin-media-controls{position:absolute;left:6px;bottom:6px;display:flex;align-items:center;gap:4px}
.admin-media-controls .admin-media-remove,.admin-media-move{position:static;width:27px;height:27px;border:0;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.admin-media-move{background:rgba(0,0,0,.65);color:#f7f5ef}
.admin-media-move:disabled{opacity:.35;cursor:not-allowed}
.admin-media-controls .admin-media-remove{background:rgba(180,40,40,.85);color:#f7f5ef}
@media (max-width:720px){.admin-price-conversion-grid{grid-template-columns:1fr}}

.admin-lead-budget-badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;background:rgba(247,245,239,.13);color:#f7f5ef;font-size:.66rem;font-weight:700}
.admin-lead-budget{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px;padding:10px;border:1px solid rgba(247,245,239,.14);border-radius:12px;background:rgba(247,245,239,.035)}
.admin-lead-budget>div{min-width:0;padding:8px 9px;border-radius:9px;background:rgba(255,255,255,.025)}
.admin-lead-budget span{display:block;color:rgb(247 245 239 / .48);font-size:.64rem}
.admin-lead-budget strong{display:block;margin-top:3px;color:#f7f5ef;font-size:.76rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.admin-lead-matches{grid-column:1/-1;display:flex!important;gap:6px!important;flex-wrap:wrap}
.admin-lead-matches a{padding:5px 7px;border-radius:8px;background:rgba(255,255,255,.03);color:rgb(247 245 239 / .68);text-decoration:none;font-size:.68rem}
.admin-lead-matches a:hover{color:#f7f5ef;background:rgba(247,245,239,.08)}
.admin-budget-send{color:#f7f5ef!important}
.admin-lead-followup{display:inline-flex;align-items:center;gap:5px;margin-top:9px;padding:5px 10px;border-radius:9px;border:1px solid rgb(0 0 0 / .12);background:rgb(0 0 0 / .03);color:rgb(0 0 0 / .62);font-size:.72rem}
.admin-lead-followup strong{color:#111315}
.admin-lead-followup.is-due{border-color:rgba(178,88,32,.4);background:rgba(205,110,50,.1);color:#9c4a17}
.admin-lead-followup.is-due strong{color:#9c4a17}
.admin-lead-attribution{margin-top:8px;color:rgb(0 0 0 / .5);font-size:.7rem;line-height:1.7}
.admin-lead-attribution strong{color:rgb(0 0 0 / .78);font-weight:600}
@media (max-width:900px){.admin-lead-budget{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.admin-lead-budget{grid-template-columns:1fr 1fr}}

.admin-app{background:#111315;color:#f7f5ef}
.admin-sidebar{background:linear-gradient(180deg,#111315 0%,#111315 100%);border-color:rgba(244,247,246,.08)}
.admin-sidebar-brand{border-color:rgba(244,247,246,.08)}
.admin-sidebar-brand strong{color:#f7f5ef}
.admin-sidebar-brand small,.admin-topbar p{color:rgb(247 245 239 / .56)}
.admin-nav-btn{color:rgb(247 245 239 / .68)}
.admin-nav-btn:hover{background:rgba(247,245,239,.10);color:#f7f5ef}
.admin-nav-btn.is-active{background:rgba(247,245,239,.14);color:rgb(247 245 239 / .78)}
.admin-topbar{background:rgba(7,17,19,.88);border-color:rgba(244,247,246,.08)}
.admin-stat-card,.admin-panel,.admin-section,.admin-login-card{border-color:rgba(244,247,246,.10);background:rgba(14,24,27,.78)}
.admin-stat-card:hover{border-color:rgba(247,245,239,.42)}
.admin-stat-card.is-active{border-color:rgba(247,245,239,.64);background:rgba(247,245,239,.10)}
.admin-panel-head,.admin-property-card{border-color:rgba(244,247,246,.07)}
.admin-search,.admin-section .field input,.admin-section .field select,.admin-section .field textarea{border-color:rgba(244,247,246,.10);background:rgba(255,255,255,.025);color:#f7f5ef}
.admin-search:focus-within,.admin-section .field input:focus,.admin-section .field select:focus,.admin-section .field textarea:focus{border-color:rgba(247,245,239,.52);box-shadow:0 0 0 3px rgba(247,245,239,.12)}
.admin-section legend,.admin-panel-head .kicker,.admin-login-card .kicker{color:#f7f5ef}
.admin-icon-btn:hover{border-color:rgba(247,245,239,.48);color:rgb(247 245 239 / .78);background:rgba(247,245,239,.09)}
.admin-checks input{accent-color:#f7f5ef}
.admin-sticky-bar{background:rgba(7,17,19,.92);border-color:rgba(244,247,246,.08)}
.admin-consultant-card:hover{border-color:rgba(247,245,239,.45);background:rgba(247,245,239,.06)}
.admin-consultant-card.is-active{border-color:rgba(247,245,239,.74);background:rgba(247,245,239,.11)}
.admin-consultant-icon{background:rgba(247,245,239,.13);color:rgb(247 245 239 / .78)}
.admin-consultant-check{background:#f7f5ef;color:#f7f5ef}
.admin-media-drop{border-color:rgba(247,245,239,.35);background:rgba(247,245,239,.035)}
.admin-media-drop.is-over{border-color:rgba(247,245,239,.74);background:rgba(247,245,239,.09)}
.admin-music-progress span{background:#f7f5ef}
.btn-gold{color:#f7f5ef;background:linear-gradient(135deg,#f7f5ef,#111315);box-shadow:0 10px 26px rgba(247,245,239,.22)}
.btn-gold:hover{filter:none;background:linear-gradient(135deg,#f7f5ef,#f7f5ef)}
.admin-smart-tools{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:16px}
.admin-smart-card,.admin-seo-preview{border:1px solid rgba(247,245,239,.22);border-radius:18px;padding:18px;background:linear-gradient(145deg,rgba(247,245,239,.09),rgba(198,165,106,.035) 55%,rgba(255,255,255,.015))}
.admin-smart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
.admin-smart-head h3{margin:0;font-size:1rem}
.admin-smart-head p{margin:5px 0 0;color:rgb(247 245 239 / .56);font-size:.78rem;line-height:1.8}
.admin-quality{display:flex;align-items:center;gap:10px;margin-top:14px}
.admin-quality-bar{height:8px;flex:1;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
.admin-quality-bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#f7f5ef,rgb(247 245 239 / .72),#f7f5ef)}
.admin-quality-score{font-size:.78rem;color:#f7f5ef;font-weight:700;min-width:42px;text-align:center}
.admin-seo-preview small{display:block;color:rgb(247 245 239 / .56);font-size:.72rem;margin-bottom:6px}
.admin-seo-preview strong{display:block;color:rgb(247 245 239 / .78);font-size:.95rem;line-height:1.7}
.admin-seo-preview p{margin:8px 0 0;color:rgb(247 245 239 / .68);font-size:.78rem;line-height:1.85}
.admin-seo-preview-url{margin-top:8px;color:rgb(247 245 239 / .72);font-size:.7rem;direction:ltr;text-align:left;word-break:break-all}
.admin-filter-row{display:grid;grid-template-columns:1.25fr repeat(4,minmax(130px,1fr));gap:8px;width:100%}
.admin-filter-row select{min-height:40px;padding:8px 10px;border:1px solid rgba(244,247,246,.10);border-radius:10px;background:rgba(255,255,255,.025);color:#f7f5ef;font:inherit}
.admin-filter-row select:focus{outline:none;border-color:rgba(247,245,239,.5)}
.admin-results-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;color:rgb(247 245 239 / .56);font-size:.75rem}
@media (max-width:980px){.admin-smart-tools{grid-template-columns:1fr}.admin-filter-row{grid-template-columns:repeat(2,minmax(0,1fr))}.admin-filter-row select:first-child{grid-column:1/-1}}
@media (max-width:600px){.admin-filter-row{grid-template-columns:1fr}.admin-filter-row select:first-child{grid-column:auto}}

.admin-lead-status.status-follow_up{background:rgba(247,245,239,.14);color:#f7f5ef}
.admin-lead-status.status-visited{background:rgba(247,245,239,.14);color:rgb(247 245 239 / .72)}
.admin-lead-status.status-contract{background:rgba(247,245,239,.18);color:#f7f5ef}
.admin-dashboard-stat[data-tone="violet"] .admin-dashboard-stat-icon{background:rgba(247,245,239,.12);color:rgb(247 245 239 / .72)}
.admin-funnel-track span[data-tone="amber"]{background:#f7f5ef}
.admin-funnel-track span[data-tone="violet"]{background:rgb(247 245 239 / .72)}


/* Premium admin shell — navy / ivory / copper */
.admin-app{background:#f7f5ef;color:#111315}
.admin-sidebar{
  width:250px;
  background:linear-gradient(180deg,#111315 0%,#111315 100%);
  border-left:0;
  box-shadow:8px 0 30px rgba(16,24,39,.10);
}
.admin-sidebar-brand{border-bottom-color:rgba(255,255,255,.10);padding:20px 18px}
.admin-sidebar-brand strong{color:#f7f5ef}
.admin-sidebar-brand small{color:rgb(247 245 239 / .68)}
.admin-sidebar-brand .brand-logo-nav{filter:drop-shadow(0 8px 18px rgba(183,123,72,.18))}
.admin-nav-btn{color:rgb(247 245 239 / .72)}
.admin-nav-btn:hover{background:rgba(255,255,255,.07);color:#f7f5ef}
.admin-nav-btn.is-active{background:linear-gradient(135deg,rgba(183,123,72,.22),rgba(255,255,255,.06));color:#f7f5ef;box-shadow:inset 3px 0 0 #f7f5ef}
.admin-sidebar-foot{border-top-color:rgba(255,255,255,.09)}
.admin-main{background:#f7f5ef}
.admin-topbar{
  background:rgba(255,255,255,.90);
  color:#111315;
  border-bottom-color:rgba(23,32,51,.09);
  box-shadow:0 8px 24px rgba(23,32,51,.04);
}
.admin-topbar p{color:rgb(247 245 239 / .56)}
.admin-content{padding:26px}
.admin-stat-card,.admin-panel,.admin-section,.admin-login-card{
  background:#f7f5ef;
  border-color:rgba(23,32,51,.10);
  box-shadow:0 12px 30px rgba(23,32,51,.055);
  color:#111315;
}
.admin-stat-card:hover{border-color:rgba(183,123,72,.38)}
.admin-stat-card.is-active{border-color:rgba(183,123,72,.58);background:rgba(183,123,72,.055)}
.admin-stat-card span,.admin-property-meta p,.admin-empty{color:rgb(247 245 239 / .56)}
.admin-stat-card strong,.admin-property-meta h3,.admin-panel-head h2,.admin-empty strong{color:#111315}
.admin-stat-card[data-tone="green"] strong{color:#f7f5ef}
.admin-stat-card[data-tone="amber"] strong,.admin-stat-card[data-tone="gold"] strong{color:#f7f5ef}
.admin-stat-card[data-tone="muted"] strong{color:rgb(247 245 239 / .56)}
.admin-panel-head,.admin-property-card{border-color:rgba(23,32,51,.08)}
.admin-search{
  background:#f7f5ef;
  border-color:rgba(23,32,51,.11);
  color:#111315;
}
.admin-search input{color:#111315}
.admin-property-card:hover{background:#f7f5ef}
.admin-property-thumb{background:#f7f5ef}
.admin-property-tags span[data-status="published"]{background:rgba(24,122,88,.10);color:#f7f5ef}
.admin-property-tags span[data-status="draft"]{background:rgba(154,99,47,.11);color:#f7f5ef}
.admin-property-tags span[data-status="archived"]{background:rgba(103,113,132,.10);color:rgb(247 245 239 / .56)}
.admin-property-tags span[data-featured]{background:rgba(183,123,72,.13);color:#f7f5ef}
.admin-icon-btn{background:#f7f5ef;color:rgb(247 245 239 / .56);border-color:rgba(23,32,51,.11)}
.admin-icon-btn:hover{border-color:rgba(183,123,72,.45);color:#f7f5ef;background:rgba(183,123,72,.06)}
.admin-sticky-bar{background:rgba(255,255,255,.94);border-top-color:rgba(23,32,51,.10);box-shadow:0 -8px 24px rgba(23,32,51,.06)}
.admin-sticky-bar-info,.admin-topbar p{color:rgb(247 245 239 / .56)}
.admin-sticky-bar-info strong{color:#111315}
.admin-section legend,.admin-panel-head .kicker,.admin-login-card .kicker{color:#f7f5ef}
.admin-checks label,.admin-field label,.admin-section .field>span{color:rgb(247 245 239 / .56)}
.admin-checks input{accent-color:#f7f5ef}
.admin-section .field input,.admin-section .field select,.admin-section .field textarea,
.admin-key-row input{
  background:#f7f5ef;
  color:#111315;
  border-color:rgba(23,32,51,.11);
}
.admin-section .field input::placeholder,.admin-section .field textarea::placeholder{color:rgb(247 245 239 / .56)}
.admin-section .field input:focus,.admin-section .field select:focus,.admin-section .field textarea:focus,.admin-key-row input:focus{
  border-color:rgba(183,123,72,.55);
  box-shadow:0 0 0 3px rgba(183,123,72,.11);
}
.admin-consultant-card{background:#f7f5ef;color:#111315;border-color:rgba(23,32,51,.10)}
.admin-consultant-card:hover{border-color:rgba(183,123,72,.42);background:#f7f5ef}
.admin-consultant-card.is-active{border-color:rgba(183,123,72,.62);background:rgba(183,123,72,.07)}
.admin-consultant-meta strong{color:#111315}
.admin-consultant-meta small,.admin-consultant-meta span{color:rgb(247 245 239 / .56)}
.admin-consultant-icon{background:rgba(183,123,72,.10);color:#f7f5ef}
.admin-consultant-check{background:#f7f5ef;color:#f7f5ef}
.admin-media-drop{border-color:rgba(183,123,72,.30);background:rgba(183,123,72,.035)}
.admin-media-drop.is-over{border-color:rgba(183,123,72,.62);background:rgba(183,123,72,.08)}
.admin-music-progress span{background:#f7f5ef}
.admin-smart-card,.admin-seo-preview{border-color:rgba(183,123,72,.20);background:linear-gradient(145deg,rgba(183,123,72,.08),rgba(23,32,51,.02))}
.admin-smart-head p,.admin-seo-preview p{color:rgb(247 245 239 / .56)}
.admin-seo-preview strong{color:#f7f5ef}
.admin-seo-preview-url{color:#f7f5ef}
.admin-filter-row select{background:#f7f5ef;color:#111315;border-color:rgba(23,32,51,.11)}
.admin-filter-row select:focus{border-color:rgba(183,123,72,.48)}
.admin-results-meta{color:rgb(247 245 239 / .56)}
.btn-gold{background:linear-gradient(135deg,#f7f5ef,#111315);color:#f7f5ef;box-shadow:0 10px 25px rgba(116,70,34,.18)}
.btn-gold:hover{background:linear-gradient(135deg,#f7f5ef,#111315)}
.btn-ghost{background:#f7f5ef;color:#111315;border-color:rgba(23,32,51,.12)}
.btn-ghost:hover{border-color:rgba(183,123,72,.42);background:rgba(183,123,72,.05)}
.admin-login{background:radial-gradient(circle at 50% 0%,#111315 0%,#111315 44%,#111315 100%)}
.admin-login-card{color:#111315}
.admin-login-card h1{color:#111315}
.admin-login-card p{color:rgb(247 245 239 / .56)}
.admin-mobile-nav{background:rgba(255,255,255,.96);border-top-color:rgba(23,32,51,.10)}
.admin-mobile-nav button{color:rgb(247 245 239 / .56)}
.admin-mobile-nav button.is-active{color:#f7f5ef}
.admin-lead-budget-badge{background:rgba(183,123,72,.10);color:#f7f5ef}
.admin-lead-budget{background:rgba(183,123,72,.035);border-color:rgba(183,123,72,.14)}
.admin-lead-budget>div{background:#f7f5ef}
.admin-lead-budget span{color:rgb(247 245 239 / .56)}
.admin-lead-budget strong{color:#f7f5ef}
.admin-lead-matches a{background:#f7f5ef;color:rgb(247 245 239 / .56)}
.admin-lead-matches a:hover{color:#f7f5ef;background:#f7f5ef}
@media (max-width:980px){
  .admin-content{padding:18px}
  .admin-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .admin-property-card{grid-template-columns:72px minmax(0,1fr);gap:12px}
  .admin-property-actions{grid-column:1/-1;justify-content:flex-start}
}
@media (max-width:640px){
  .admin-sidebar{display:none}
  .admin-mobile-nav{display:flex}
  .admin-content{padding:12px 12px 92px}
  .admin-topbar{padding:12px 14px}
  .admin-topbar-actions{width:100%}
  .admin-topbar-actions>*{flex:1}
  .admin-stats-grid{grid-template-columns:1fr 1fr;gap:10px}
  .admin-stat-card{padding:14px 12px}
  .admin-form-grid{grid-template-columns:1fr}
  .admin-span-2{grid-column:auto}
  .admin-property-card{grid-template-columns:62px minmax(0,1fr);padding:12px}
  .admin-property-thumb{width:62px;height:50px}
  .admin-property-actions{gap:6px}
  .admin-section,.admin-panel{border-radius:16px}
  .admin-panel-head{padding:14px}
  .admin-panel-head h2{font-size:1rem}
  .admin-music-upload{grid-template-columns:1fr}
}
@media (max-width:390px){
  .admin-stats-grid{grid-template-columns:1fr}
  .admin-topbar-actions{display:grid;grid-template-columns:1fr 1fr}
}
/* Final monochrome enforcement: this stylesheet is injected after the global theme. */
.admin-app,.admin-main,.admin-content{background:#f7f5ef!important;color:#111315!important}
.admin-sidebar{background:#111315!important;color:#f7f5ef!important}
.admin-sidebar-brand,.admin-sidebar-foot{border-color:rgb(255 255 255 / .14)!important}
.admin-sidebar-brand strong{color:#f7f5ef!important}.admin-sidebar-brand small{color:rgb(255 255 255 / .62)!important}
.admin-sidebar-brand .brand-logo-nav{filter:grayscale(1) brightness(0) invert(1)!important}
.admin-nav-btn{color:rgb(255 255 255 / .72)!important}.admin-nav-btn:hover{background:rgb(255 255 255 / .08)!important;color:#f7f5ef!important}
.admin-nav-btn.is-active{background:#f7f5ef!important;color:#111315!important;box-shadow:inset 3px 0 0 #f7f5ef!important}
.admin-topbar,.admin-stat-card,.admin-panel,.admin-section,.admin-login-card,.admin-smart-card,.admin-seo-preview,.admin-price-help,.admin-price-calculator,.admin-lead-budget{background:#f7f5ef!important;color:#111315!important;border-color:rgb(0 0 0 / .12)!important}
.admin-topbar,.admin-sticky-bar,.admin-mobile-nav{box-shadow:0 8px 24px rgb(0 0 0 / .06)!important}
.admin-topbar p,.admin-stat-card span,.admin-property-meta p,.admin-empty,.admin-results-meta,.admin-smart-head p,.admin-seo-preview p,.admin-seo-preview small,.admin-section .field>span,.admin-field label,.admin-checks label{color:rgb(0 0 0 / .62)!important}
.admin-stat-card strong,.admin-property-meta h3,.admin-panel-head h2,.admin-empty strong,.admin-seo-preview strong,.admin-seo-preview-url,.admin-section legend,.admin-panel-head .kicker,.admin-login-card .kicker{color:#111315!important}
.admin-stat-card:hover,.admin-stat-card.is-active,.admin-property-card:hover,.admin-consultant-card:hover,.admin-consultant-card.is-active{border-color:#111315!important}
.admin-stat-card.is-active,.admin-property-card:hover{background:rgb(0 0 0 / .03)!important}
.admin-search,.admin-search input,.admin-section .field input,.admin-section .field select,.admin-section .field textarea,.admin-key-row input,.admin-filter-row select{background:#f7f5ef!important;color:#111315!important;border-color:rgb(0 0 0 / .14)!important}
.admin-search:focus-within,.admin-section .field input:focus,.admin-section .field select:focus,.admin-section .field textarea:focus,.admin-key-row input:focus,.admin-filter-row select:focus{border-color:#111315!important;box-shadow:0 0 0 3px rgb(0 0 0 / .07)!important}
.admin-icon-btn{background:#f7f5ef!important;color:#111315!important;border-color:rgb(0 0 0 / .14)!important}
.admin-icon-btn:hover,.admin-icon-btn.danger:hover{background:#111315!important;color:#f7f5ef!important;border-color:#111315!important}
.btn-gold{background:#111315!important;color:#f7f5ef!important;border-color:#111315!important;box-shadow:0 10px 24px rgb(0 0 0 / .16)!important}
.btn-gold:hover{background:#111315!important}
.btn-ghost{background:#f7f5ef!important;color:#111315!important;border-color:rgb(0 0 0 / .14)!important}
.btn-ghost:hover{background:rgb(0 0 0 / .045)!important;border-color:#111315!important}
.admin-property-tags span[data-status],.admin-property-tags span[data-featured],.admin-lead-status,.admin-lead-budget-badge{background:rgb(0 0 0 / .06)!important;color:#111315!important;border:1px solid rgb(0 0 0 / .12)!important}
.admin-property-tags span[data-featured]{background:#111315!important;color:#f7f5ef!important}
.admin-consultant-card{background:#f7f5ef!important;color:#111315!important;border-color:rgb(0 0 0 / .12)!important}
.admin-consultant-card:hover,.admin-consultant-card.is-active{background:#111315!important;color:#f7f5ef!important;border-color:#111315!important}
.admin-consultant-meta strong,.admin-consultant-meta span{color:inherit!important}
.admin-consultant-meta small{color:rgb(0 0 0 / .56)!important}.admin-consultant-card:hover .admin-consultant-meta small{color:rgb(255 255 255 / .62)!important}
.admin-consultant-icon,.admin-consultant-check,.admin-media-remove,.admin-media-primary,.admin-media-move{background:#111315!important;color:#f7f5ef!important}
.admin-media-drop{border-color:rgb(0 0 0 / .30)!important;background:rgb(0 0 0 / .02)!important;color:rgb(0 0 0 / .60)!important}
.admin-media-drop.is-over{border-color:#111315!important;background:rgb(0 0 0 / .05)!important}
.admin-music-progress span,.admin-quality-bar span,.admin-funnel-track span,.admin-breakdown-track span{background:#111315!important}
.admin-lead-budget{border-color:rgb(0 0 0 / .12)!important}.admin-lead-budget>div{background:rgb(0 0 0 / .03)!important}.admin-lead-budget span{color:rgb(0 0 0 / .62)!important}.admin-lead-budget strong{color:#111315!important}
.admin-lead-matches a{background:rgb(0 0 0 / .04)!important;color:#111315!important}.admin-lead-matches a:hover{background:#111315!important;color:#f7f5ef!important}
.admin-mobile-nav{background:rgb(255 255 255 / .97)!important;border-top-color:rgb(0 0 0 / .12)!important}.admin-mobile-nav button{color:rgb(0 0 0 / .56)!important}.admin-mobile-nav button.is-active{color:#111315!important}



/* ==========================================================================
   Final readability pass — desktop + admin
   High-contrast, light workspace for the admin content area.
   This block intentionally sits last because several child admin modules
   inject their own small style tags.
   ========================================================================== */
.admin-main,
.admin-content{background:#f6f8fb!important;color:#172033!important}
.admin-topbar{background:rgba(255,255,255,.96)!important;color:#172033!important;border-bottom:1px solid #d8e0e8!important}
.admin-topbar h1,.admin-topbar strong,.admin-panel-head h2,.admin-section legend{color:#101828!important}
.admin-topbar p{color:#475467!important}
.admin-stat-card,.admin-panel,.admin-section,.admin-smart-card,.admin-seo-preview,
.admin-music-manager,.admin-lead-manager,.admin-dashboard,.divar-wrap,
[class*="admin-partner"]{
  background:#ffffff!important;
  color:#172033!important;
  border-color:#d9e1ea!important;
  box-shadow:0 10px 30px rgba(16,24,40,.06)!important;
}
.admin-stat-card span,.admin-property-meta p,.admin-empty,.admin-results-meta,
.admin-smart-head p,.admin-seo-preview p,.admin-seo-preview small,
.admin-section .field>span,.admin-field label,.admin-checks label,
.admin-panel-head p,.admin-panel-head small{
  color:#475467!important;
}
.admin-stat-card strong,.admin-property-meta h3,.admin-empty strong,
.admin-seo-preview strong,.admin-seo-preview-url,.admin-panel-head .kicker{
  color:#101828!important;
}
.admin-panel-head,.admin-property-card,.admin-breakdown-row,.admin-dashboard-card,
.admin-lead-card,.admin-music-track,.admin-music-row{
  border-color:#e1e7ee!important;
}
.admin-search,.admin-search input,
.admin-section .field input,.admin-section .field select,.admin-section .field textarea,
.admin-key-row input,.admin-filter-row select,
.admin-main input,.admin-main select,.admin-main textarea{
  background:#ffffff!important;
  color:#101828!important;
  border:1px solid #cbd5e1!important;
  box-shadow:none!important;
}
.admin-main input::placeholder,.admin-main textarea::placeholder{color:#667085!important}
.admin-section .field input:focus,.admin-section .field select:focus,
.admin-section .field textarea:focus,.admin-key-row input:focus,
.admin-filter-row select:focus,.admin-main input:focus,.admin-main select:focus,
.admin-main textarea:focus,.admin-search:focus-within{
  border-color:#9a6a3a!important;
  box-shadow:0 0 0 3px rgba(154,106,58,.14)!important;
}
.admin-section .field>span,.admin-field label{font-weight:700!important;color:#344054!important}
.admin-main .admin-dashboard *,
.admin-main .admin-music-manager *,
.admin-main .admin-lead-manager *,
.admin-main .divar-wrap *,
.admin-main [class*="admin-partner"] *,
.admin-main .admin-section *,
.admin-main .admin-panel *{
  color:#172033;
}
.admin-main .admin-dashboard h1,.admin-main .admin-dashboard h2,.admin-main .admin-dashboard h3,
.admin-main .admin-music-manager h1,.admin-main .admin-music-manager h2,.admin-main .admin-music-manager h3,
.admin-main .admin-lead-manager h1,.admin-main .admin-lead-manager h2,.admin-main .admin-lead-manager h3,
.admin-main .divar-wrap h1,.admin-main .divar-wrap h2,.admin-main .divar-wrap h3,
.admin-main [class*="admin-partner"] h1,.admin-main [class*="admin-partner"] h2,.admin-main [class*="admin-partner"] h3{
  color:#101828!important;
}
.admin-main .admin-dashboard p,.admin-main .admin-dashboard small,
.admin-main .admin-music-manager p,.admin-main .admin-music-manager small,
.admin-main .admin-lead-manager p,.admin-main .admin-lead-manager small,
.admin-main .divar-wrap p,.admin-main .divar-wrap small,
.admin-main [class*="admin-partner"] p,.admin-main [class*="admin-partner"] small{
  color:#475467!important;
}
.admin-main .btn-gold,
.admin-main .admin-mobile-site,
.admin-main .admin-icon-btn:hover,
.admin-main .admin-icon-btn.danger:hover,
.admin-main .admin-media-remove,
.admin-main .admin-media-primary,
.admin-main .admin-media-move,
.admin-main .admin-consultant-card:hover,
.admin-main .admin-consultant-card.is-active,
.admin-main .admin-property-tags span[data-featured]{
  color:#ffffff!important;
}
.admin-main .btn-gold{background:#101828!important;border-color:#101828!important}
.admin-main .btn-ghost{background:#ffffff!important;color:#101828!important;border-color:#cbd5e1!important}
.admin-main .btn-ghost:hover{background:#f2f4f7!important;border-color:#98a2b3!important}
.admin-property-tags span[data-status],
.admin-property-tags span[data-featured],
.admin-lead-status,.admin-lead-budget-badge{
  background:#f2f4f7!important;
  color:#344054!important;
  border:1px solid #d0d5dd!important;
}
.admin-property-tags span[data-status="published"]{background:#ecfdf3!important;color:#027a48!important;border-color:#abefc6!important}
.admin-property-tags span[data-status="draft"]{background:#fffaeb!important;color:#b54708!important;border-color:#fedf89!important}
.admin-property-tags span[data-status="archived"]{background:#f2f4f7!important;color:#475467!important}
.admin-property-tags span[data-featured]{background:#101828!important;color:#ffffff!important;border-color:#101828!important}
.admin-lead-status.status-follow_up,.admin-lead-status.status-visited,
.admin-lead-status.status-contract{background:#eef4ff!important;color:#175cd3!important;border-color:#b2ccff!important}
.admin-music-progress,.admin-quality-bar,.admin-funnel-track,.admin-breakdown-track{
  background:#e7ecf2!important;
}
.admin-music-progress span,.admin-quality-bar span,.admin-funnel-track span,.admin-breakdown-track span{
  background:#9a6a3a!important;
}
.admin-mobile-nav{
  background:rgba(255,255,255,.98)!important;
  border-top:1px solid #d0d5dd!important;
}
.admin-mobile-nav button{color:#475467!important}
.admin-mobile-nav button.is-active{color:#101828!important;font-weight:800!important}
@media (min-width:961px){
  .admin-content{padding:30px 32px!important}
  .admin-stats-grid{gap:16px!important}
  .admin-stat-card{min-height:112px!important}
}
`;
