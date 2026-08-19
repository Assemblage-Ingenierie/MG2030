import type { Metadata } from "next";
import "./globals.css";
import { themeVars } from "@/lib/tokens";
import { getMessages } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/i18n/i18n-context";
import en from "@/messages/en.json";

export const metadata: Metadata = {
  title: en.app.title,
  description: `${en.app.subtitle} — ${en.app.owner}`,
};

/**
 * Layout racine : thème et internationalisation, rien de plus.
 *
 * Le cadre applicatif (sidebar, header) et le garde d'accès vivent dans le
 * groupe de routes `(app)`. La page de connexion et les retours
 * d'authentification sont donc rendus SANS chrome et sans garde — sinon la
 * connexion serait protégée par elle-même.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { locale, messages, fallback } = await getMessages();

  return (
    <html lang={locale} className="h-full">
      {/* Les variables CSS viennent de lib/tokens.ts : source unique. */}
      <body className="min-h-full" style={themeVars}>
        <I18nProvider locale={locale} messages={messages} fallback={fallback}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
