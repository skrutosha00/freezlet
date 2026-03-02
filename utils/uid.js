const uid = () => {
  try {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export default uid;
