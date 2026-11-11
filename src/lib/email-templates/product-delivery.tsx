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

interface ProductDeliveryEmailProps {
  productTitle: string
  /** The buyer's private link. Exists only in this email: it is never stored or logged. */
  link: string
}

/** Feature F: sent to one buyer, once per order, with their own private link to the full edition. */
export const ProductDeliveryEmail = ({ productTitle, link }: ProductDeliveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Your copy of {productTitle} is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your copy of {productTitle}</Heading>
        <Text style={text}>Thank you for your order. Your edition opens in the browser, on any device.</Text>
        <Button className="dm-btn" style={button} href={link}>
          Open your edition
        </Button>
        <Text style={text}>If the button does not work, copy this address into your browser:</Text>
        <Text style={detail}>{link}</Text>
        <Text style={text}>Keep this link private. Anyone with it can open your edition.</Text>
        <Text style={footer}>
          For help with your order, reply to the seller through your shop. Portfolia hosts the reader; your purchase was
          handled by the seller.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ProductDeliveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Instrument Sans', Helvetica, Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 12px' }
const detail = { fontSize: '12px', color: '#111111', lineHeight: '1.5', margin: '0 0 12px', wordBreak: 'break-all' as const }
const button = {
  backgroundColor: '#000000',
  color: '#ffffff',
  fontSize: '14px',
  border: '1px solid #000000',
  borderRadius: '999px',
  padding: '12px 20px',
  textDecoration: 'none',
  margin: '6px 0 18px',
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
