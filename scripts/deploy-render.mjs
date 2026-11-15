#!/usr/bin/env node

/**
 * Triggers a Render deployment from this workspace using either:
 * 1) RENDER_DEPLOY_HOOK_URL (recommended: Render Dashboard -> Service -> Settings -> Deploy Hook)
 * 2) RENDER_API_KEY + RENDER_SERVICE_ID (Render REST API v1)
 */

const deployHookUrl = process.env.RENDER_DEPLOY_HOOK_URL?.trim();
const apiKey = process.env.RENDER_API_KEY?.trim();
const serviceId = process.env.RENDER_SERVICE_ID?.trim();

async function main() {
  if (deployHookUrl) {
    const res = await fetch(deployHookUrl, { method: 'POST' });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Render deploy hook failed (HTTP ${res.status}): ${text}`);
      process.exit(1);
    }
    console.log(`Render deploy hook triggered successfully (HTTP ${res.status}).`);
    if (text) console.log(text);
    return;
  }

  if (apiKey && serviceId) {
    const res = await fetch(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/deploys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clearCache: 'do_not_clear' }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Render API deploy failed (HTTP ${res.status}): ${text}`);
      process.exit(1);
    }
    console.log(`Render API deploy triggered for service ${serviceId} (HTTP ${res.status}).`);
    if (text) console.log(text);
    return;
  }

  console.error(
    [
      'Missing Render credentials in environment/Secrets.',
      'Add one of the following in AI Studio Settings -> Secrets:',
      '  - RENDER_DEPLOY_HOOK_URL (from Render -> Service -> Settings -> Deploy Hook)',
      '  - OR both RENDER_API_KEY and RENDER_SERVICE_ID',
    ].join('\n')
  );
  process.exit(1);
}

main().catch((err) => {
  console.error('Unexpected error triggering Render deploy:', err);
  process.exit(1);
});
