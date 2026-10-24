import './globals.css'
import type { Metadata } from 'next'
import { Bebas_Neue, Montserrat } from 'next/font/google'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-bebas' })
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' })

export const metadata: Metadata = {
  title: { default: 'Founders · Illinois Entrepreneurs', template: '%s · Founders' },
  description: 'Tools for Founders · Illinois Entrepreneurs events.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bebas.variable} ${montserrat.variable}`}>
      <body>
        <Navbar />
        <main className="container-page py-8 sm:py-12">{children}</main>
        <footer className="container-page pb-10 pt-6 text-sm text-ink-3 no-print">
          <span className="mono">Founders · Illinois Entrepreneurs</span>
          {' · '}
          <Link className="underline" href="/admin">
            Organizers
          </Link>
          {' · '}
          <a className="underline" href="https://github.com/amey-gupt/founders-tools">Source on GitHub</a>
        </footer>
      </body>
    </html>
  )
}
