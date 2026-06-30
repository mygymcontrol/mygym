import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyGym - Sistema de Gestão para Academias',
  description: 'Sistema completo para controle de alunos, matrículas, finanças e presença.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <meta name="theme-color" content="#16a34a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/force-trainning-logo.jpeg" />
      </head>
      <body className="bg-black min-h-screen">{children}</body>
    </html>
  );
}
