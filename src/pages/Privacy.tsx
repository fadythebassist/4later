import React from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import "./Privacy.css";

const Privacy: React.FC = () => {
  usePageMeta({
    title: "Privacy Policy - 4Stash",
    description:
      "Read the 4Stash Privacy Policy. Learn what data we collect, how we use it, and your rights as a user.",
    canonical: "https://4stash.com/privacy",
  });

  return (
    <div className="privacy-page">
      <div className="privacy-container">
        <header className="privacy-header">
          <div className="privacy-logo">4Stash</div>
          <h1>Privacy Policy</h1>
          <p className="privacy-effective">Effective date: March 18, 2026</p>
        </header>

        <section>
          <h2>1. Introduction</h2>
          <p>
            Welcome to 4Stash ("we", "our", or "us"). 4Stash is a personal
            content-saving app that lets you save links, tweets, TikToks,
            Instagram posts, Reddit threads, Threads posts, and other media so
            you can revisit them later. This Privacy Policy explains what data
            we collect, how we use it, and your rights.
          </p>
        </section>

        <section>
          <h2>2. Data We Collect</h2>

          <h3>Account Information</h3>
          <p>
            When you sign in with Google, Facebook, or email/password, we
            receive basic profile information (name, email address, profile
            photo) from the authentication provider. We store this in Firebase
            Authentication.
          </p>

          <h3>Content You Save</h3>
          <p>
            URLs, titles, descriptions, thumbnails, and metadata of the content
            you choose to save are stored in Firebase Firestore under your
            account. This data is private to you and not shared with other
            users.
          </p>

          <h3>Threads Content</h3>
          <p>
            4Stash supports saving and previewing Threads posts by URL. When you
            save a Threads post, we fetch and store its metadata (title,
            description, and preview image) using the public Threads embed API.
            We do not require you to connect or log in to a Threads account, and
            we do not post, like, follow, or take any action on the Threads
            platform on your behalf.
          </p>

          <h3>Usage Data</h3>
          <p>
            If you consent, we use Google Analytics to measure aggregate app
            usage such as page views, navigation patterns, and feature
            engagement. We do not use Google Analytics to read the private
            content you save. Firebase Authentication may also use essential
            cookies for session management.
          </p>
        </section>

        <section>
          <h2>3. How We Use Your Data</h2>
          <ul>
            <li>To authenticate you and maintain your session</li>
            <li>To store and retrieve the content you save</li>
            <li>
              If you opt in, to understand overall app usage and improve the
              product experience
            </li>
            <li>
              To fetch metadata (title, description, preview image) for URLs you
              save — this is done server-side and the URL is sent to our Vite
              proxy endpoint
            </li>
            <li>
              To display rich previews of Threads posts using the public Threads
              embed API
            </li>
          </ul>
          <p>We do not sell, rent, or share your data with third parties.</p>
        </section>

        <section>
          <h2>4. Third-Party Services</h2>
          <ul>
            <li>
              <strong>Firebase (Google)</strong> — Authentication and database
              hosting.{" "}
              <a
                href="https://firebase.google.com/support/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Firebase Privacy
              </a>
            </li>
            <li>
              <strong>Google Analytics</strong> — Used to understand app usage
              and improve product performance.{" "}
              <a
                href="https://support.google.com/analytics/answer/7318509"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Analytics Privacy
              </a>
            </li>
            <li>
              <strong>Meta Threads Embed API</strong> — Used to render Threads
              post previews when you save a Threads URL. No account connection
              or login is required.{" "}
              <a
                href="https://privacycenter.instagram.com/policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Meta Privacy
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Data Retention</h2>
          <p>
            Your saved content and account data are retained for as long as your
            account exists. You can delete your account at any time from the app
            settings, which permanently removes all your data from our database.
          </p>
        </section>

        <section>
          <h2>6. Security</h2>
          <p>
            All data is transmitted over HTTPS. Firebase Firestore security
            rules ensure that only authenticated users can read or write their
            own data. Access tokens for social connections are stored in your
            private Firestore document and are never exposed to other users.
          </p>
        </section>

        <section>
          <h2>7. Children's Privacy</h2>
          <p>
            4Stash is not directed at children under 13. We do not knowingly
            collect personal information from children under 13.
          </p>
        </section>

        <section>
          <h2>8. Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your
            personal data at any time by contacting us or deleting your account
            in-app.
          </p>
        </section>

        <section>
          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be
            posted on this page with a new effective date.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>
            If you have questions about this Privacy Policy, please email us at{" "}
            <a href="mailto:support@4stash.com">support@4stash.com</a>.
          </p>
        </section>

        <footer className="privacy-footer">
          <a href="/terms">Terms of Service</a>
          {" · "}
          <a href="mailto:support@4stash.com">support@4stash.com</a>
          {" · "}
          <a href="/login">Back to 4Stash</a>
        </footer>
      </div>
    </div>
  );
};

export default Privacy;
