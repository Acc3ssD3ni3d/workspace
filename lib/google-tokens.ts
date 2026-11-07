import { connectDB } from "@/lib/db";
import { GoogleConnection } from "@/lib/models";
import { getGoogleOAuthClient } from "@/lib/google-oauth";
import { decryptGoogleToken, encryptGoogleToken } from "@/lib/google-crypto";

export async function getGoogleClient(userId: string) {
  await connectDB();

  // Find this employee's Google connection.
  const connection = await GoogleConnection.findOne({
    user: userId,
  }).select("+accessTokenEncrypted +refreshTokenEncrypted");

  if (!connection) {
    throw new Error(
      "Google account is not connected. Please connect your Google account first.",
    );
  }

  if (!connection.refreshTokenEncrypted) {
    throw new Error(
      "Google refresh token is missing. Please reconnect your Google account.",
    );
  }

  // Decrypt the employee's tokens.
  const refreshToken = decryptGoogleToken(connection.refreshTokenEncrypted);

  const accessToken = connection.accessTokenEncrypted
    ? decryptGoogleToken(connection.accessTokenEncrypted)
    : undefined;

  // Create an OAuth client for this employee.
  const client = getGoogleOAuthClient();

  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: connection.tokenExpiresAt
      ? connection.tokenExpiresAt.getTime()
      : undefined,
  });

  try {
    // Refresh the access token when necessary.
    await client.getAccessToken();

    const credentials = client.credentials;

    // Save refreshed credentials securely.
    const update: Record<string, unknown> = {};

    if (credentials.access_token) {
      update.accessTokenEncrypted = encryptGoogleToken(
        credentials.access_token,
      );
    }

    if (credentials.refresh_token) {
      update.refreshTokenEncrypted = encryptGoogleToken(
        credentials.refresh_token,
      );
    }

    if (credentials.expiry_date) {
      update.tokenExpiresAt = new Date(credentials.expiry_date);
    }

    if (Object.keys(update).length > 0) {
      await GoogleConnection.updateOne(
        { _id: connection._id },
        { $set: update },
      );
    }

    return client;
  } catch (error) {
    console.error("Google token refresh failed for employee:", userId, error);

    throw new Error(
      "Google authentication expired or was revoked. Please reconnect your Google account.",
    );
  }
}
