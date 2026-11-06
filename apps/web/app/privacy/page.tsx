import type { Metadata } from "next"
import { LegalPage } from "@/app/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Privacy Notice | CoffeeShopCRM",
  description: "How CoffeeShopCRM handles personal information.",
}

const sections = [
  {
    title: "1. Information covered by this notice",
    paragraphs: [
      "This notice explains how Third Generation Studios handles information when operating CoffeeShopCRM.",
      "For business records entered by a workspace, the business determines why that information is collected and how it is used. We process those records to provide the service. Questions about a business’s own use of your information should also be directed to that business.",
    ],
  },
  {
    title: "2. Information we process",
    paragraphs: [
      "Account information includes your name, email address, personal contact phone number, authentication information, and account preferences.",
      "Workspace information includes business contact details, memberships, roles, invitations, employee records, leads, customers, estimates, jobs, schedules, catalog content, uploaded images, and other information submitted to the service.",
      "Billing information includes subscription status, plan details, and payment-related identifiers. Stripe processes payment information entered through its payment interfaces.",
      "Our infrastructure providers may process technical information such as IP addresses, browser details, request logs, errors, and email delivery information when providing hosting, security, authentication, and email services.",
    ],
  },
  {
    title: "3. How information is used",
    paragraphs: [
      "We use information to create accounts and workspaces, authenticate users, enforce access permissions and plan limits, process subscriptions, store business records, and provide requested features.",
      "We also use information to respond to support requests, investigate errors and abuse, protect the service, and meet legal obligations.",
      "Service emails may include account confirmations, password recovery messages, workspace invitations, and operational notices. Creating an account is not agreement to receive unrelated marketing emails.",
    ],
  },
  {
    title: "4. Workspace visibility and service providers",
    paragraphs: [
      "Information entered into a workspace may be accessible to other authorized users according to their roles and the service’s access controls. Workspace owners manage memberships and access.",
      "We use Supabase for database, authentication, and file storage; Vercel for application hosting; Stripe for billing; Resend for email delivery; and Cloudflare Turnstile for abuse prevention. These providers process information needed to perform their services.",
      "Authorized operational access may be needed to provide support, maintain the service, investigate security issues, or comply with law.",
      "Information may also be disclosed when legally required or reasonably necessary to investigate fraud, protect people, or protect the service.",
    ],
  },
  {
    title: "5. Cookies and similar technology",
    paragraphs: [
      "The service uses authentication cookies and browser storage to maintain sessions and preferences. Security providers may use similar technology to help distinguish legitimate requests from abuse.",
      "Blocking these technologies may prevent sign-in or other features from working.",
    ],
  },
  {
    title: "6. Retention and deletion",
    paragraphs: [
      "Retention depends on the type of record, workspace use, operational needs, and applicable legal requirements. Deleting a record from an active interface may not immediately remove all related logs, backups, billing records, or copies retained by service providers.",
      "Records in Recently Deleted remain stored until permanently deleted. Canceling a subscription or removing a membership does not automatically delete a workspace’s business records.",
      "Contact ahenry@thirdgenerationstudios.com to request account or workspace deletion or information about retention. We may need to verify your identity and authority. Some records may need to be retained for legal, security, or financial reasons.",
    ],
  },
  {
    title: "7. Your requests and choices",
    paragraphs: [
      "You can update available account and workspace details through the application. Contact us to request access, correction, deletion, or other handling of your personal information.",
      "If your information was entered by a business using CoffeeShopCRM, contact that business about its records. We can help route a request when appropriate.",
      "Privacy rights vary by location. We will handle requests according to applicable law.",
    ],
  },
  {
    title: "8. Security and processing locations",
    paragraphs: [
      "The service uses authentication and workspace access controls to limit access to information. No online service can guarantee absolute security.",
      "Information may be processed in the United States and other locations where our service providers operate.",
    ],
  },
  {
    title: "9. Children",
    paragraphs: [
      "CoffeeShopCRM accounts are intended for adults conducting business. The service is not directed to children under 13. Contact us if you believe a child has submitted account information.",
    ],
  },
  {
    title: "10. Updates and contact",
    paragraphs: [
      "Updates to this notice will show a new version date. We will provide additional notice or obtain consent for changes where required.",
      "For privacy questions, contact Third Generation Studios at ahenry@thirdgenerationstudios.com.",
    ],
  },
]

export default function PrivacyPage() {
  return <LegalPage title="Privacy Notice" sections={sections} />
}
