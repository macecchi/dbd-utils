import { verify } from 'hono/jwt';

export interface JwtPayload {
  sub: string;
  login: string;
  display_name: string;
  profile_image_url: string;
  exp: number;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const payload = await verify(token, secret, 'HS256');
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
