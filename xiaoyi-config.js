/* Current site: local knowledge mode only. No online calls or API keys.
   Deployment hook reserved for a future explicitly enabled server proxy.
   Set this at deploy time (or replace this file outside the public repo) with:
   window.XIAOYI_CONFIG = { enableOnline: true, endpoint: '/api/chat' };
   Never put a DeepSeek/DashScope key in this file. */
window.XIAOYI_CONFIG = window.XIAOYI_CONFIG || {};
