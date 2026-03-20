type SessionLike = { user?: { id?: string } | null } | null;

type SessionClient = {
  auth: {
    getSession: () => Promise<{ data: { session: SessionLike } }>;
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getSessionWithRecovery(client: SessionClient, attempts = 4, delayMs = 250) {
  for (let i = 0; i < attempts; i += 1) {
    const { data } = await client.auth.getSession();
    if (data.session) return data.session;
    if (i < attempts - 1) {
      await sleep(delayMs);
    }
  }

  return null;
}
