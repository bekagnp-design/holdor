# v1.0.95 — the public boards carry no Telegram ids (backend v27): a row says `mine` instead. The app with an older server (no v27 yet)
# still gets `tg_id` and keeps comparing it.
rep("function lbIsMe(p){return !!(p&&CLOUD.tg_id&&p.tg_id===CLOUD.tg_id&&((p.seat==null?0:+p.seat)===Math.max(0,seatNo())));}",
    "function lbIsMe(p){if(!p)return false;if(p.mine!==undefined)return !!p.mine;return !!(CLOUD.tg_id&&p.tg_id===CLOUD.tg_id&&((p.seat==null?0:+p.seat)===Math.max(0,seatNo())));}", 1, 'lbisme')
