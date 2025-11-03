
const KEY = 'nss:settings';

export async function getSettings() {
  const s = (await chrome.storage.local.get(KEY))[KEY];
  return { enabled: true, blockHighRisk: false, ...s };
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export async function scanUrl(url) {
  return {
    url,
    overall: 50,
    metrics: {
      domainReputation: 50,
      domainSignals: 50,
      certificateTrust: 50,
      connectionSecurity: 50,
      credentialSafety: 50,
      pageContent: 50
    },
    verdict: 'Caution'
  };
}
