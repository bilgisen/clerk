import { NextResponse } from "next/server";
import { verifyGithubOidc } from "@/lib/auth/github-oidc";
import { getSession, updateSession } from "@/lib/store/redis";
import { signCombinedToken } from "@/lib/auth/combined";
import { randomUUID } from "crypto";

export const dynamic = 'force-dynamic';

type AttestRequest = {
  sessionId: string;
  nonce: string;
};

export async function POST(req: Request) {
  try {
    // Verify GitHub OIDC token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header", code: "MISSING_AUTH_HEADER" },
        { status: 401 }
      );
    }
    
    const idToken = authHeader.slice("Bearer ".length);
    const ghClaims = await verifyGithubOidc(idToken);
    
    // Parse request body
    const { sessionId, nonce } = (await req.json()) as AttestRequest;
    if (!sessionId || !nonce) {
      return NextResponse.json(
        { error: "Missing required fields", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }
    
    // Get and validate the session
    const session = await getSession(sessionId);
    if (!session || session.status !== "pending-runner" || session.nonce !== nonce) {
      return NextResponse.json(
        { error: "Invalid session or nonce", code: "INVALID_SESSION" },
        { status: 400 }
      );
    }
    
    // Generate a new Combined Token
    const combinedToken = await signCombinedToken({
      sub: session.userId,
      sid: session.id,
      scope: "publish",
      gh: {
        repository: ghClaims.repository!,
        run_id: ghClaims.run_id!,
        run_number: ghClaims.run_number?.toString(),
        workflow: ghClaims.workflow!,
        sha: ghClaims.sha,
        actor: ghClaims.actor,
      },
    });
    
    // Update the session with GitHub context and the combined token
    await updateSession(sessionId, {
      status: "runner-attested",
      gh: {
        repository: ghClaims.repository,
        run_id: ghClaims.run_id,
        run_number: ghClaims.run_number?.toString(),
        workflow: ghClaims.workflow,
        sha: ghClaims.sha,
      },
      combinedToken,
    });
    
    // Return the combined token to the GitHub Actions runner
    return NextResponse.json({ combinedToken });
    
  } catch (error) {
    console.error("Attestation error:", error);
    
    if (error instanceof jose.errors.JOSEError) {
      return NextResponse.json(
        { error: `Token verification failed: ${error.message}`, code: "TOKEN_VERIFICATION_FAILED" },
        { status: 401 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Attestation failed: ${errorMessage}`, code: "ATTESTATION_FAILED" },
      { status: 500 }
    );
  }
}
