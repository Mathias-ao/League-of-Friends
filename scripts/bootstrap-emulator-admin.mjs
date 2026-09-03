const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const projectId = readArg("--project");
const steamName = readArg("--steam");
const discordName = readArg("--discord") ?? null;

if (!projectId || !steamName) {
  console.error(
    "Usage: node scripts/bootstrap-emulator-admin.mjs --project <project-id> --steam \"<steam-name>\" [--discord \"<discord-name>\"]",
  );
  process.exit(1);
}

const email = "emperor@league.local";
const password = "league-emulator-admin-only";
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";

async function authRequest(path, body) {
  const response = await fetch(`${authBase}/${path}?key=fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  return { response, payload };
}

async function getOrCreateUser() {
  const signUp = await authRequest("accounts:signUp", {
    email,
    password,
    returnSecureToken: true,
  });

  if (signUp.response.ok) {
    return signUp.payload;
  }

  if (signUp.payload?.error?.message !== "EMAIL_EXISTS") {
    throw new Error(`Auth emulator signup failed: ${JSON.stringify(signUp.payload)}`);
  }

  const signIn = await authRequest("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });

  if (!signIn.response.ok) {
    throw new Error(`Auth emulator sign-in failed: ${JSON.stringify(signIn.payload)}`);
  }

  return signIn.payload;
}

async function bootstrapAdmin(authUser) {
  const url = `http://127.0.0.1:5001/${projectId}/europe-west1/bootstrapEmulatorAdmin`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      authUid: authUser.localId,
      steamName,
      discordName,
    }),
  });

  const payload = await response.json();
  if (!response.ok && response.status !== 409) {
    throw new Error(`Admin bootstrap failed: ${JSON.stringify(payload)}`);
  }

  if (response.status === 409 && payload.error !== "This auth user is already linked.") {
    throw new Error(`Admin bootstrap failed: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function verifyHealth(idToken) {
  const url = `http://127.0.0.1:5001/${projectId}/europe-west1/backendHealth`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: {} }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Backend health check failed: ${JSON.stringify(payload)}`);
  }
  return payload;
}

try {
  const authUser = await getOrCreateUser();
  const bootstrap = await bootstrapAdmin(authUser);
  const health = await verifyHealth(authUser.idToken);

  console.log("Emulator administrator is ready.");
  console.log(`Auth user: ${email}`);
  console.log(`Auth UID: ${authUser.localId}`);
  if (bootstrap.playerId) console.log(`Player ID: ${bootstrap.playerId}`);
  console.log("Backend health:", JSON.stringify(health));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
