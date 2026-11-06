import type { Metadata } from "next"
import { LegalPage } from "@/app/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service | CoffeeShopCRM",
  description: "Terms for using CoffeeShopCRM.",
}

const sections = [
  {
    title: "1. Using CoffeeShopCRM",
    paragraphs: [
      "These Terms govern your use of CoffeeShopCRM. By creating an account, you agree to these Terms. If you use the service for a business, you confirm that you have authority to act on its behalf.",
      "CoffeeShopCRM is a business management service. You must be at least 18 years old to create an account.",
    ],
  },
  {
    title: "2. Accounts and workspace access",
    paragraphs: [
      "Provide accurate account information, protect your sign-in credentials, and notify us if you suspect unauthorized access.",
      "Workspace owners are responsible for inviting appropriate people and managing their access. Employee records do not automatically create user accounts or grant workspace access.",
    ],
  },
  {
    title: "3. Your business information",
    paragraphs: [
      "You retain ownership of the content you submit. You give Third Generation Studios permission to host, process, transmit, and display that content as needed to operate and support the service.",
      "You are responsible for having the necessary permissions and lawful basis to enter information about customers, leads, employees, and other people. Provide any notices required for your business.",
      "Do not upload passwords, payment card details, government identification numbers, protected health information, classified information, or other information requiring safeguards the service has not expressly agreed to provide.",
    ],
  },
  {
    title: "4. Acceptable use",
    paragraphs: [
      "Do not use the service for unlawful activity, fraud, harassment, unsolicited bulk messaging, or infringement of another person’s rights.",
      "Do not attempt to access another workspace without authorization, bypass access controls or plan limits, introduce malicious code, or disrupt the service.",
      "Only invite people whom you are authorized to contact about joining your workspace.",
    ],
  },
  {
    title: "5. Plans and billing",
    paragraphs: [
      "Free and paid plans have different limits. Review the price, billing interval, and features displayed before purchasing a subscription.",
      "Paid subscriptions renew according to the terms shown at checkout unless canceled. Workspace owners can manage subscriptions through the billing controls. Contact support if you cannot access those controls.",
      "Cancellation timing, changes to an existing subscription, and any credits or refunds depend on the applicable purchase terms and law. Contact support with billing questions.",
    ],
  },
  {
    title: "6. Early access and availability",
    paragraphs: [
      "CoffeeShopCRM is offered in early access. Features may change, and interruptions or errors may occur. Planned features are not guarantees of future availability.",
      "You remain responsible for reviewing estimates, schedules, customer information, and other business records before relying on them. Keep independent copies of records important to your business.",
    ],
  },
  {
    title: "7. Suspension and ending use",
    paragraphs: [
      "We may restrict access when reasonably necessary to address abuse, security threats, nonpayment, legal requirements, or violations of these Terms.",
      "You can stop using the service and contact support to request account or workspace deletion. Canceling a paid subscription does not itself request deletion of your data.",
      "Removing a workspace membership does not necessarily delete business records associated with that person. Retention and deletion are described in the Privacy Notice.",
    ],
  },
  {
    title: "8. Service limitations",
    paragraphs: [
      "To the extent permitted by law, the service is provided as available without a guarantee that it will be uninterrupted, error-free, or suitable for every business purpose.",
      "Nothing in these Terms excludes rights or liabilities that cannot lawfully be excluded.",
    ],
  },
  {
    title: "9. Changes and contact",
    paragraphs: [
      "We may update these Terms as the service changes. Updated Terms will show a new version date. For material changes, we will provide notice and obtain further agreement where required.",
      "Questions about these Terms can be sent to ahenry@thirdgenerationstudios.com.",
    ],
  },
]

export default function TermsPage() {
  return <LegalPage title="Terms of Service" sections={sections} />
}
