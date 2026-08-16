import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { Providers } from '../components/providers'
import { BottomFloatingBar } from '../components/bottom-floating-bar'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#2B1D17' },
      { title: 'Tomny Coffee — Vận hành' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="app-root pb-20 md:pb-6 print:pb-0">
          <Providers>{children}</Providers>
          <BottomFloatingBar />
        </div>
        <Scripts />
      </body>
    </html>
  )
}
