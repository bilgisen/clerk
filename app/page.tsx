import { SignIn } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="flex h-screen w-full">
      {/* Left Column */}
      <div className="hidden md:flex md:w-1/2 items-center justify-center bg-primary p-8 dark:bg-primary/90">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">BooksHall</h1>
          <p className="text-xl">Your powerful document management system</p>
        </div>
      </div>

      {/* Right Column */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-background p-6 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center md:hidden mb-8">
            <h1 className="text-3xl font-bold">BooksHall</h1>
            <p className="text-muted-foreground mt-2">Your powerful document management system</p>
          </div>
          
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <SignIn 
              path="/"
              routing="path"
              signUpUrl="/sign-up"
              redirectUrl="/dashboard"
              afterSignInUrl="/dashboard"
              afterSignUpUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'w-full shadow-none border-0 p-0',
                  headerTitle: 'text-2xl font-bold text-center',
                  headerSubtitle: 'text-muted-foreground text-center',
                  socialButtonsBlockButton: 'border-border hover:bg-muted/50',
                  dividerLine: 'bg-border',
                  dividerText: 'text-muted-foreground',
                  formFieldLabel: 'text-foreground',
                  formFieldInput: 'border-border focus:ring-primary',
                  footerActionText: 'text-muted-foreground text-sm',
                  footerActionLink: 'text-primary hover:text-primary/80 font-medium',
                  formButtonPrimary: 'bg-primary hover:bg-primary/90',
                },
                variables: {
                  colorPrimary: 'hsl(var(--primary))',
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
