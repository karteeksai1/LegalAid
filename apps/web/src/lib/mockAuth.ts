// LegalAid mock auth: local-only session storage for demo routing; replace with a real auth provider before production use.
export type MockSession = {
  email: string;
  name: string;
  mode: "login" | "signup";
  signedInAt: string;
};

const SESSION_KEY = "legalaid_mock_session";

export function createMockSession(session: Omit<MockSession, "signedInAt">) {
  const nextSession: MockSession = { ...session, signedInAt: new Date().toISOString() };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  return nextSession;
}

export function getMockSession(): MockSession | null {
  const stored = window.localStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as MockSession;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearMockSession() {
  window.localStorage.removeItem(SESSION_KEY);
}
