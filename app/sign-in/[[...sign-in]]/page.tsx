'use client';

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function SignInPage() {
  const searchParams = useSearchParams();
  
  // Get the redirect URL from query params or default to /dashboard
  const getRedirectUrl = () => {
    const redirectUrl = searchParams.get('redirect_url');
    console.log('[SignIn] Redirect URL from params:', redirectUrl);
    return redirectUrl || '/dashboard';
  };

  const redirectUrl = getRedirectUrl();

  useEffect(() => {
    console.log('[SignIn] Component mounted with redirectUrl:', redirectUrl);
  }, [redirectUrl]);

  return (
    <div className="flex justify-center py-24">
      <div className="w-full max-w-md">
        <SignIn 
          signInFallbackRedirectUrl={redirectUrl}
          signUpFallbackRedirectUrl={redirectUrl}
          forceRedirectUrl={redirectUrl}
          afterSignInUrl={redirectUrl}
          afterSignUpUrl={redirectUrl}
          redirectUrl={redirectUrl}
        />
      </div>
    </div>
  );
}
