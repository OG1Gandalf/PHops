"use client";

/**
 * Last-resort boundary: renders when the root layout itself fails, so it cannot use providers, translations or the
 * app stylesheet. Plain inline styles, both languages, no error details.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fbf7f2", color: "#2a1a14" }}>
        <main role="alert" style={{ maxWidth: 420, margin: "0 auto", padding: "72px 20px", textAlign: "center" }}>
          <p aria-hidden="true" style={{ fontSize: 48, margin: 0 }}>
            🪔
          </p>
          <h1 style={{ fontSize: 24, margin: "12px 0 8px" }}>Something went wrong</h1>
          <p style={{ lineHeight: 1.45, margin: 0 }}>The page could not be loaded. Please try again in a moment.</p>
          <p lang="bn" style={{ lineHeight: 1.45, margin: "8px 0 0" }}>
            পাতাটি লোড করা যায়নি। একটু পরে আবার চেষ্টা করুন।
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 24, minHeight: 48, padding: "0 28px", borderRadius: 12, border: 0, background: "#a81d1d", color: "#fff", fontSize: 16, fontWeight: 600 }}
          >
            Try again / আবার চেষ্টা করুন
          </button>
        </main>
      </body>
    </html>
  );
}
