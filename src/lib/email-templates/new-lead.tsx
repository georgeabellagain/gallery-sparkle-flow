import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface NewLeadEmailProps {
  siteName: string
  portfolioName: string
  leadsUrl: string
  /** The details the reader left, already labelled ("Email: …"). */
  lines: string[]
}

export const NewLeadEmail = ({ siteName, portfolioName, leadsUrl, lines }: NewLeadEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>New lead from {portfolioName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You have a new lead</Heading>
        <Text style={text}>A reader of {portfolioName} left their details:</Text>
        {lines.map((line) => (
          <Text key={line} style={detail}>{line}</Text>
        ))}
        <Button className="dm-btn" style={button} href={leadsUrl}>
          See all your leads
        </Button>
        <Text style={footer}>
          {siteName} sends this because this portfolio has a lead form. Every lead is also kept in the editor under
          Leads, where you can download them all.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default NewLeadEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Instrument Sans', Helvetica, Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 12px' }
const detail = { fontSize: '14px', color: '#111111', lineHeight: '1.5', margin: '0 0 6px' }
const button = {
  backgroundColor: '#000000',
  color: '#ffffff',
  fontSize: '14px',
  border: '1px solid #000000',
  borderRadius: '999px',
  padding: '12px 20px',
  textDecoration: 'none',
  marginTop: '18px',
}
const footer = { fontSize: '12px', color: '#999999', lineHeight: '1.5', margin: '30px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #ffffff !important; color: #000000 !important; }
  }
  [data-ogsc] .dm-btn { background-color: #ffffff !important; color: #000000 !important; }
  [data-ogsb] .dm-btn { background-color: #ffffff !important; color: #000000 !important; }
`
