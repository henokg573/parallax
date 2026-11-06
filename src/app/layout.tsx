export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-zinc-950 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}