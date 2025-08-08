// This file is needed to configure the page as dynamic
export const dynamic = 'force-dynamic';

export default function BooksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
