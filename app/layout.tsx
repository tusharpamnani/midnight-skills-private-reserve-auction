import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0f0f23] text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
