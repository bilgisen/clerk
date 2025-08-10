import { SignIn } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="flex h-screen w-full">
      {/* Left Column */}
      <div 
        className="w-1/2 relative flex flex-col justify-center items-start p-12 text-white"
        style={{
          backgroundImage: 'url(/sign.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative'
        }}
      >
        <div className="absolute inset-0 bg-black/50 z-0" />
        <div className="relative z-10 max-w-md">
          <h1 className="text-5xl font-bold mb-4">Publish your first book free</h1>
          <p className="text-xl text-gray-200">Please login or sign-up to get started</p>
        </div>
      </div>

      {/* Right Column */}
      <div className="w-1/2 flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-md">
          <SignIn 
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'w-full shadow-none',
                headerTitle: 'text-2xl font-bold',
                headerSubtitle: 'text-muted-foreground',
                socialButtonsBlockButton: 'border-border hover:bg-muted/50',
                dividerLine: 'bg-border',
                dividerText: 'text-muted-foreground',
                formFieldLabel: 'text-foreground',
                formFieldInput: 'border-border focus:ring-primary',
                footerActionText: 'text-muted-foreground',
                footerActionLink: 'text-primary hover:text-primary/80',
                formButtonPrimary: 'bg-primary hover:bg-primary/90',
              },
              variables: {
                colorPrimary: '#000000',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
