const http = require('http');
const { URL } = require('url');

const dashboardPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Simp Control Room</title>
<style>
:root{color-scheme:dark;--bg:#0e1218;--panel:#171e27;--line:#2a3542;--text:#f4f7fa;--muted:#9caaba;--accent:#e8c547;--green:#6bd6a5}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 12% 0,#30424a 0,transparent 34%),var(--bg);color:var(--text);font:15px/1.5 system-ui,sans-serif}main{width:min(1100px,calc(100% - 32px));margin:auto;padding:44px 0 64px}header{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:30px}.eyebrow{margin:0 0 8px;color:var(--accent);font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{margin:0;font:700 clamp(2.2rem,6vw,4.6rem)/.95 Georgia,serif}.status{color:var(--muted);text-align:right}.dot{display:inline-block;width:9px;height:9px;margin-right:7px;border-radius:50%;background:#e5a84b}.dot.ok{background:var(--green);box-shadow:0 0 12px var(--green)}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.panel{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:21px}.metric{min-height:126px}.label{color:var(--muted);font-size:13px}.value{margin-top:10px;font-size:2.4rem;font-weight:750;letter-spacing:-.04em}.wide{grid-column:span 2}h2{margin:0 0 17px;font-size:16px}dl{display:grid;grid-template-columns:1fr auto;gap:10px;margin:0}dt{color:var(--muted)}dd{margin:0;font-weight:700}table{width:100%;border-collapse:collapse}th,td{padding:9px 0;border-bottom:1px solid var(--line);text-align:left}th{color:var(--muted);font-size:11px;letter-spacing:.1em;text-transform:uppercase}td:last-child,th:last-child{text-align:right}.empty{color:var(--muted)}@media(max-width:700px){header{display:block}.status{margin-top:18px;text-align:left}.grid{grid-template-columns:1fr 1fr}.wide{grid-column:span 2}}@media(max-width:450px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}}
</style></head><body><main><header><div><p class="eyebrow">Simp operations</p><h1>Control room</h1></div><div class="status"><span id="dot" class="dot"></span><span id="state">Connecting</span><br><span id="updated">Refreshing every 10 seconds</span></div></header>
<section class="grid"><article class="panel metric"><div class="label">Servers</div><div id="guilds" class="value">-</div></article><article class="panel metric"><div class="label">Members</div><div id="members" class="value">-</div></article><article class="panel metric"><div class="label">Commands</div><div id="commands" class="value">-</div></article><article class="panel metric"><div class="label">Economy users</div><div id="users" class="value">-</div></article>
<article class="panel wide"><h2>Bot health</h2><dl><dt>Uptime</dt><dd id="uptime">-</dd><dt>Discord latency</dt><dd id="latency">-</dd><dt>Memory</dt><dd id="memory">-</dd><dt>Node.js</dt><dd id="node">-</dd></dl></article>
<article class="panel wide"><h2>Economy totals</h2><dl><dt>Credits</dt><dd id="credits">-</dd><dt>Tokens</dt><dd id="tokens">-</dd><dt>Coins</dt><dd id="coins">-</dd><dt>Messages</dt><dd id="messages">-</dd></dl></article>
<article class="panel wide"><h2>Recent commands</h2><table><thead><tr><th>Command</th><th>User</th><th>Time</th></tr></thead><tbody id="activity"><tr><td colspan="3" class="empty">Waiting for database...</td></tr></tbody></table></article></section></main>
<script>const n=v=>Number(v||0).toLocaleString(),set=(id,v)=>document.getElementById(id).textContent=v;async function refresh(){try{const r=await fetch('/api/summary');if(!r.ok)throw Error();const d=await r.json(),b=d.bot,e=d.database;set('state',b.ready?'Online':'Starting');document.getElementById('dot').classList.toggle('ok',b.ready);set('guilds',n(b.guilds));set('members',n(b.members));set('commands',n(b.commands));set('users',n(e.users));set('uptime',b.uptime);set('latency',b.latency);set('memory',b.memory);set('node',b.node);set('credits',n(e.credits));set('tokens',n(e.tokens));set('coins',n(e.coins));set('messages',n(e.messages));document.getElementById('activity').innerHTML=d.activity.length?d.activity.map(x=>'<tr><td>'+String(x.commandName||'-')+'</td><td>'+String(x.userId||'unknown')+'</td><td>'+new Date(String(x.timestamp).replace(' ','T')+'Z').toLocaleString()+'</td></tr>').join(''):'<tr><td colspan="3" class="empty">No commands recorded yet</td></tr>';set('updated','Updated '+new Date().toLocaleTimeString())}catch(e){set('state','Waiting for bot');document.getElementById('dot').classList.remove('ok')}}refresh();setInterval(refresh,10000)</script></body></html>`;

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row || {})));
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows || [])));
}

function formatUptime(seconds) {
  const total = Math.floor(Math.max(0, seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

async function getSummary(client, db) {
  const bot = {
    ready: Boolean(client.user),
    guilds: client.guilds?.cache?.size || 0,
    members: client.guilds?.cache?.reduce((total, guild) => total + (guild.memberCount || 0), 0) || 0,
    commands: client.commands?.size || 0,
    uptime: formatUptime(process.uptime()),
    latency: client.ws?.ping >= 0 ? `${Math.round(client.ws.ping)}ms` : 'N/A',
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
    node: process.version
  };
  try {
    const database = await dbGet(db, 'SELECT COUNT(*) AS users, COALESCE(SUM(credits), 0) AS credits, COALESCE(SUM(tokens), 0) AS tokens, COALESCE(SUM(coins), 0) AS coins, COALESCE(SUM(messageCount), 0) AS messages FROM users');
    const activity = await dbAll(db, 'SELECT commandName, userId, timestamp FROM processed_commands ORDER BY timestamp DESC LIMIT 8');
    return { bot, database, activity };
  } catch {
    return { bot, database: {}, activity: [] };
  }
}

function startDashboard({ client, db, port = process.env.PORT || 3000, host = process.env.DASHBOARD_HOST || '0.0.0.0', token = process.env.DASHBOARD_TOKEN } = {}) {
  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const authorized = !token || requestUrl.searchParams.get('token') === token || request.headers.authorization === `Bearer ${token}`;
    if (!authorized) {
      response.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Dashboard authentication required');
      return;
    }
    if (requestUrl.pathname === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    if (requestUrl.pathname === '/api/summary') {
      response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(await getSummary(client, db)));
      return;
    }
    if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(dashboardPage);
      return;
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });
  server.listen(Number(port), host, () => console.log(`Dashboard listening on ${host}:${port}`));
  return server;
}

module.exports = { startDashboard, getSummary };