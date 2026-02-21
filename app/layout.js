import "./globals.css";

export const metadata = {
  title: "ChiChi Ad Generator",
  description: "Generate on-brand static ads for ChiChi Foods",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <nav className="border-b border-peach/20 bg-vanilla">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <a href="/" className="font-heading text-2xl text-chocolate">
              ChiChi Ad Generator
            </a>
            <div className="flex gap-6 text-sm font-medium">
              <a href="/" className="text-chocolate/70 hover:text-chocolate transition-colors">
                Generate
              </a>
              <a href="/brand-kit" className="text-chocolate/70 hover:text-chocolate transition-colors">
                Brand Kit
              </a>
              <a href="/gallery" className="text-chocolate/70 hover:text-chocolate transition-colors">
                Gallery
              </a>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
