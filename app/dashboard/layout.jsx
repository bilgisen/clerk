import Navbar01Page from '@/components/navbar-01/navbar-01';
import { ThemeProvider } from 'next-themes';
export default function DashboardLayout({ children, }) {
    return (<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="flex min-h-screen flex-col">
        <Navbar01Page />
        <main className="flex-1">{children}</main>
      </div>
    </ThemeProvider>);
}
