import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

export default async function SignUpPage() {
  const user = await currentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex justify-center py-24">
      <SignUp 
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        redirectUrl="/dashboard"
        afterSignUpUrl="/dashboard"
        afterSignInUrl="/dashboard"
      />
    </div>
  );
}
