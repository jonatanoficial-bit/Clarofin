import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clarofin — sua vida financeira, sem complicação',
  description: 'Controle receitas, despesas, contas e metas financeiras de forma clara e simples.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
