import './globals.css';

export const metadata = {
  title: 'Content Control Center',
  description: 'Phase-1 evidence-backed content operations'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
