import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt, sign, verify } from "hono/jwt";
import { Twitch } from "arctic";

type Bindings = {
  TWITCH_CLIENT_ID: string;
  TWITCH_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
};

type Variables = {
  jwtPayload: {
    sub: string;
    login: string;
    display_name: string;
    profile_image_url: string;
    exp: number;
  };
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS for frontend
app.use(
  "*",
  cors({
    origin: (origin, c) => c.env.FRONTEND_URL,
    credentials: true,
  })
);

// ============ AUTH ROUTES ============

// Redirect to Twitch OAuth
app.get("/auth/login", (c) => {
  const origin = new URL(c.req.url).origin;
  const twitch = new Twitch(
    c.env.TWITCH_CLIENT_ID,
    c.env.TWITCH_CLIENT_SECRET,
    `${origin}/auth/callback`
  );

  const state = crypto.randomUUID();
  const url = twitch.createAuthorizationURL(state, ["user:read:email"]);

  return c.redirect(url.toString());
});

// Twitch callback - exchange code, verify identity, issue JWT
app.get("/auth/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.redirect(`${c.env.FRONTEND_URL}?error=missing_code`);
  }

  const origin = new URL(c.req.url).origin;
  const twitch = new Twitch(
    c.env.TWITCH_CLIENT_ID,
    c.env.TWITCH_CLIENT_SECRET,
    `${origin}/auth/callback`
  );

  try {
    // Exchange code for Twitch tokens
    const tokens = await twitch.validateAuthorizationCode(code);

    // Get user info from Twitch
    const userRes = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`,
        "Client-Id": c.env.TWITCH_CLIENT_ID,
      },
    });

    if (!userRes.ok) {
      return c.redirect(`${c.env.FRONTEND_URL}?error=twitch_api_error`);
    }

    const userData = (await userRes.json()) as {
      data: Array<{
        id: string;
        login: string;
        display_name: string;
        profile_image_url: string;
      }>;
    };
    const user = userData.data[0];

    if (!user) {
      return c.redirect(`${c.env.FRONTEND_URL}?error=no_user`);
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: user.id,
      login: user.login,
      display_name: user.display_name,
      profile_image_url: user.profile_image_url,
    };

    // Issue access token (1 hour) and refresh token (90 days)
    const accessToken = await sign(
      { ...payload, exp: now + 60 * 60 },
      c.env.JWT_SECRET,
      "HS256"
    );
    const refreshToken = await sign(
      { ...payload, exp: now + 60 * 60 * 24 * 90 },
      c.env.JWT_SECRET,
      "HS256"
    );

    // Redirect back to frontend with tokens
    const params = new URLSearchParams({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return c.redirect(`${c.env.FRONTEND_URL}?${params}`);
  } catch (error) {
    console.error("Auth error:", error);
    return c.redirect(`${c.env.FRONTEND_URL}?error=auth_failed`);
  }
});

// Refresh access token using refresh token
app.post("/auth/refresh", async (c) => {
  const body = await c.req.json<{ refresh_token: string }>();

  if (!body.refresh_token) {
    return c.json({ error: "missing_refresh_token" }, 400);
  }

  try {
    const payload = await verify(body.refresh_token, c.env.JWT_SECRET, "HS256");

    const now = Math.floor(Date.now() / 1000);
    const accessToken = await sign(
      {
        sub: payload.sub,
        login: payload.login,
        display_name: payload.display_name,
        profile_image_url: payload.profile_image_url,
        exp: now + 60 * 60,
      },
      c.env.JWT_SECRET,
      "HS256"
    );

    return c.json({ access_token: accessToken });
  } catch {
    return c.json({ error: "invalid_refresh_token" }, 401);
  }
});

// Get current user from token
app.get("/auth/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const payload = await verify(token, c.env.JWT_SECRET, "HS256");
    return c.json({
      id: payload.sub,
      login: payload.login,
      display_name: payload.display_name,
      profile_image_url: payload.profile_image_url,
    });
  } catch {
    return c.json({ error: "invalid_token" }, 401);
  }
});

// ============ PROTECTED API ROUTES ============

const api = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// JWT middleware for protected routes
api.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const payload = await verify(token, c.env.JWT_SECRET, "HS256");
    c.set("jwtPayload", payload as Variables["jwtPayload"]);
    await next();
  } catch {
    return c.json({ error: "invalid_token" }, 401);
  }
});

// Example protected endpoint
api.post("/extract-character", async (c) => {
  const user = c.get("jwtPayload");
  const { message } = await c.req.json<{ message: string }>();

  console.log(`Request from ${user.login} (${user.sub}): ${message}`);

  // TODO: Call your LLM here
  // const character = await callGemini(message, c.env.GEMINI_API_KEY);

  return c.json({
    user: user.login,
    message,
    character: null, // placeholder
  });
});

app.route("/api", api);

export default app;
