import React from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import "./Privacy.css";

const Terms: React.FC = () => {
  usePageMeta({
    title: "Terms of Service - 4Stash",
    description:
      "Read the 4Stash Terms of Service. Understand the rules governing your use of the app.",
    canonical: "https://4stash.com/terms",
  });

  return (
    <div className="privacy-page">
      <div className="privacy-container">
        <header className="privacy-header">
          <div className="privacy-logo">4Stash</div>
          <h1>Terms of Service</h1>
          <p className="privacy-effective">Effective date: April 7, 2026</p>
        </header>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using 4Stash ("the Service", "we", "our", or "us"),
            you agree to be bound by these Terms of Service. If you do not agree
            to these terms, do not use the Service.
          </p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>
            4Stash is a personal content-saving application that allows you to
            save, organize, and revisit links, tweets, TikToks, Instagram posts,
            Reddit threads, Threads posts, and other media content. The Service
            is provided for personal, non-commercial use.
          </p>
        </section>

        <section>
          <h2>3. User Accounts</h2>
          <p>
            You must create an account to use the Service. You are responsible
            for maintaining the confidentiality of your account credentials and
            for all activity that occurs under your account. You agree to notify
            us immediately of any unauthorized use of your account.
          </p>
          <p>
            You must provide accurate information when creating your account. We
            reserve the right to suspend or terminate accounts that violate
            these Terms.
          </p>
        </section>

        <section>
          <h2>4. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe the intellectual property rights of others</li>
            <li>
              Attempt to gain unauthorized access to the Service or its
              infrastructure
            </li>
            <li>
              Use the Service for any commercial purpose without our prior
              written consent
            </li>
            <li>
              Interfere with or disrupt the integrity or performance of the
              Service
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Content You Save</h2>
          <p>
            4Stash allows you to save references (URLs and metadata) to
            third-party content. You are solely responsible for ensuring that
            your use of third-party content complies with applicable copyright
            and platform terms. We do not host, reproduce, or redistribute
            third-party content — we only store references and metadata that
            you choose to save.
          </p>
        </section>

        <section>
          <h2>6. Intellectual Property</h2>
          <p>
            The 4Stash name, logo, and application design are our intellectual
            property. Nothing in these Terms grants you a right to use our
            trademarks or branding. Content you save remains subject to the
            terms and ownership rules of its original source.
          </p>
        </section>

        <section>
          <h2>7. Disclaimer of Warranties</h2>
          <p>
            The Service is provided "as is" and "as available" without warranty
            of any kind, express or implied. We do not warrant that the Service
            will be uninterrupted, error-free, or free of harmful components. We
            make no guarantees about the availability, accuracy, or reliability
            of any content metadata fetched by the Service.
          </p>
        </section>

        <section>
          <h2>8. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by applicable law, we shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages arising from your use of or inability to use the
            Service, even if we have been advised of the possibility of such
            damages.
          </p>
        </section>

        <section>
          <h2>9. Termination</h2>
          <p>
            You may stop using the Service and delete your account at any time
            from within the app. We reserve the right to suspend or terminate
            your access to the Service at any time for conduct that violates
            these Terms or is otherwise harmful to other users, us, or third
            parties.
          </p>
        </section>

        <section>
          <h2>10. Changes to These Terms</h2>
          <p>
            We may update these Terms of Service from time to time. Changes will
            be posted on this page with a new effective date. Your continued use
            of the Service after changes are posted constitutes your acceptance
            of the revised Terms.
          </p>
        </section>

        <section>
          <h2>11. Governing Law</h2>
          <p>
            These Terms are governed by and construed in accordance with
            applicable law. Any disputes arising from these Terms or your use of
            the Service shall be resolved through good-faith negotiation or, if
            necessary, through the courts of competent jurisdiction.
          </p>
        </section>

        <section>
          <h2>12. Contact</h2>
          <p>
            If you have questions about these Terms of Service, please email us
            at <a href="mailto:support@4stash.com">support@4stash.com</a>.
          </p>
        </section>

        <footer className="privacy-footer">
          <a href="/privacy">Privacy Policy</a>
          {" · "}
          <a href="mailto:support@4stash.com">support@4stash.com</a>
          {" · "}
          <a href="/login">Back to 4Stash</a>
        </footer>
      </div>
    </div>
  );
};

export default Terms;
