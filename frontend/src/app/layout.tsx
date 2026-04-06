import "./globals.css";
import { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Navigation } from "@/components/navigation";

export const metadata = {
  title: "Attendance ",
  description: "Responsive & Touch-First Attendance Tracker"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="scrolling-touch">
        <main className="mx-auto min-h-screen max-w-7xl px-4 pb-24 pt-6 md:px-8 md:pb-12">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex aspect-square h-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-500/30">
                <p className="text-xl font-black">A</p>
              </div>
              <p className="hidden text-xl font-bold tracking-tight sm:block">Attendance </p>
              <Navigation />
            </div>
            <ThemeToggle />
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
