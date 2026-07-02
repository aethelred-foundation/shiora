// DELETE /api/webauthn/credentials/{id} — remove a passkey (GAP-12)
import { NextRequest } from 'next/server';
import { successResponse, notFoundResponse } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { deleteCredential } from '@/lib/api/webauthn-service';
import { audit } from '@/lib/api/audit';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;
  const auth = requireAuth(request);
  if ('status' in auth) return auth;
  const { id } = await context.params;
  const removed = await deleteCredential(auth.walletAddress!, id);
  if (!removed) return notFoundResponse('Passkey', id);
  audit({ action: 'MFA_DISABLE', actor: auth.walletAddress!, success: true, metadata: { credentialId: id } });
  return successResponse({ deleted: true, id });
}
