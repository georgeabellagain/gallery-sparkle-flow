import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface PortfolioOpenedEmailProps {
  siteName: string
  portfolioName: string
  portfolioUrl: string
  settingsUrl: string
  /** When the open happened, already written for the reader ("22 Oct 2026, 14:05 UTC"). */
  when: string
  /** Where the visitor's network says it is, ready to follow "in" ("the United Kingdom"). */
  country?: string
  device: 'phone' | 'tablet' | 'computer'
  /** This open plus any since the last email. */
  opens: number
}

export const PortfolioOpenedEmail = ({
  siteName,
  portfolioName,
  portfolioUrl,
  settingsUrl,
  when,
  country,
  device,
  opens,
}: PortfolioOpenedEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Someone opened {portfolioName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Someone opened your portfolio</Heading>
        <Text style={text}>
          {portfolioName} was opened {when}, on a {device}
          {country ? ` in ${country}` : ''}.
        </Text>
        {opens > 1 && (
          <Text style={text}>
            That makes {opens} opens since our last email. We send at most one
            email every few hours, so later opens are added to the next one.
          </Text>
        )}
        <Button className="dm-btn" style={button} href={portfolioUrl}>
          View your portfolio
        </Button>
        <Text style={footer}>
          You asked {siteName} to tell you when this portfolio is opened. We
          never record the visitor's address. To stop these emails, turn off
          "Email me when someone opens it" in{' '}
          <Link href={settingsUrl} style={link}>
            your portfolio settings
          </Link>
          .
        </Text>
      </Container>
    </Body>
  </Html>
)

export default PortfolioOpenedEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Instrument Sans', Helvetica, Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#000000',
  color: '#ffffff',
  fontSize: '14px',
  border: '1px solid #000000',
  borderRadius: '999px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const link = { color: '#55575d', textDecoration: 'underline' }
const footer = { fontSize: '12px', color: '#999999', lineHeight: '1.5', margin: '30px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #ffffff !important; color: #000000 !important; }
  }
  [data-ogsc] .dm-btn { background-color: #ffffff !important; color: #000000 !important; }
  [data-ogsb] .dm-btn { background-color: #ffffff !important; color: #000000 !important; }
`
