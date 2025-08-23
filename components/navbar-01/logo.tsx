import Link from "next/link";
import { Library } from "lucide-react";

export function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2">
      <Library className="h-6 w-6 text-primary" />
      <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
        BooksHall
      </span>
    </Link>
  );
}
